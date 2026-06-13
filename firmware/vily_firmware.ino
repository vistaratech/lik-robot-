/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                   VILY Firmware v2.0                        ║
 * ║         ESP32 WiFi Robot — Inspired by LOOI Robot           ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Custom WebSockets server for controlling a phone-mounted robot.
 * Features:
 *   - WiFi connection with automatic Access Point fallback
 *   - WebSocket server on port 80 for low-latency browser control
 *   - Dual DC motor control via L298N driver
 *   - RGB LED control
 *   - Battery voltage monitoring
 *   - Pre-programmed movement animations
 *   - Sequence-based command protocol (LOOI-inspired)
 * 
 * Hardware:
 *   - ESP32 DevKit V1
 *   - L298N Motor Driver
 *   - 2x DC Motors
 *   - RGB LED (common cathode)
 *   - Voltage divider on battery line
 */

#include <WiFi.h>
#include <ESPmDNS.h>
#include <mbedtls/sha1.h>
#include <base64.h>
#include "config.h"

struct AnimKeyframe {
    bool motorA_fwd;
    uint8_t motorA_spd;
    bool motorB_fwd;
    uint8_t motorB_spd;
    uint16_t duration;
};

// ═══════════════════════════════════════════════
//  Global State
// ═══════════════════════════════════════════════

// WiFi & WebSocket
WiFiServer server(WEBSOCKET_PORT);
WiFiClient wsClient;

bool wsConnected        = false;
bool handshakeComplete  = false;
unsigned long connectTime    = 0;
unsigned long lastPingTime   = 0;
unsigned long lastBatteryRead = 0;

uint8_t lastSeq = 0xFF;  // Last received sequence number
bool firstPacket = true;  // First packet flag (no seq check)

// Motor state
int motorASpeed = 0;
int motorBSpeed = 0;
bool motorAForward = true;
bool motorBForward = true;

// Animation state
bool animPlaying   = false;
uint8_t animId     = 0;
int animStep       = 0;
unsigned long animStepTime = 0;

// LED blink state
bool ledBlinking       = false;
uint8_t ledBlinkCount  = 0;
uint8_t ledBlinkRate   = 0;
unsigned long ledBlinkTime = 0;
bool ledBlinkState     = false;
uint8_t ledR = 0, ledG = 0, ledB = 0;

// Forward Declarations
void setLED(uint8_t r, uint8_t g, uint8_t b);
void stopMotors();
void processCommand(uint8_t* data, size_t length);

// ═══════════════════════════════════════════════
//  WebSocket Framing Functions
// ═══════════════════════════════════════════════

void sendWebSocketFrame(const uint8_t* payload, size_t length, uint8_t opcode = 0x02) {
    if (!wsConnected || !wsClient.connected()) return;
    
    wsClient.write(0x80 | opcode); // Fin bit set + opcode
    
    if (length <= 125) {
        wsClient.write((uint8_t)length);
    } else if (length <= 65535) {
        wsClient.write(126);
        uint16_t len16 = __builtin_bswap16((uint16_t)length);
        wsClient.write((const uint8_t*)&len16, 2);
    } else {
        wsClient.write(127);
        uint64_t len64 = __builtin_bswap64((uint64_t)length);
        wsClient.write((const uint8_t*)&len64, 8);
    }
    
    if (length > 0 && payload != nullptr) {
        wsClient.write(payload, length);
    }
}

bool performWebSocketHandshake(WiFiClient& client) {
    String secKey = "";
    
    // Read HTTP request headers
    unsigned long timeout = millis();
    Serial.println("[WS] Handshake request headers:");
    while (client.connected() && millis() - timeout < 2000) {
        if (client.available()) {
            String line = client.readStringUntil('\n');
            line.trim();
            Serial.println("  " + line);
            if (line.length() == 0) {
                // Empty line indicates end of headers
                break;
            }
            
            String lineLower = line;
            lineLower.toLowerCase();
            if (lineLower.startsWith("sec-websocket-key:")) {
                secKey = line.substring(18);
                secKey.trim();
            }
        }
    }
    
    if (secKey.length() == 0) {
        Serial.println("[WS] Error: Sec-WebSocket-Key not found!");
        client.println("HTTP/1.1 400 Bad Request");
        client.println("Connection: close");
        client.println();
        return false;
    }
    
    // Calculate Accept Key
    String concat = secKey + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    uint8_t sha1Result[20];
    
    mbedtls_sha1((const unsigned char*)concat.c_str(), concat.length(), sha1Result);
    
    String acceptKey = base64::encode(sha1Result, 20);
    acceptKey.trim();
    
    // Send Switching Protocols response
    client.println("HTTP/1.1 101 Switching Protocols");
    client.println("Upgrade: websocket");
    client.println("Connection: Upgrade");
    client.print("Sec-WebSocket-Accept: ");
    client.println(acceptKey);
    client.println();
    
    return true;
}

void handleWebSocketClient(WiFiClient& client) {
    if (!client.available()) return;
    
    uint8_t header1 = client.read();
    uint8_t header2 = client.read();
    
    uint8_t opcode = header1 & 0x0F;
    bool isMasked = (header2 & 0x80) != 0;
    uint32_t payloadLen = header2 & 0x7F;
    
    if (payloadLen == 126) {
        uint8_t extraLenBytes[2];
        client.readBytes(extraLenBytes, 2);
        payloadLen = (extraLenBytes[0] << 8) | extraLenBytes[1];
    } else if (payloadLen == 127) {
        uint8_t extraLenBytes[8];
        client.readBytes(extraLenBytes, 8);
        payloadLen = 0;
        for (int i = 0; i < 8; i++) {
            payloadLen = (payloadLen << 8) | extraLenBytes[i];
        }
    }
    
    uint8_t maskKey[4];
    if (isMasked) {
        client.readBytes(maskKey, 4);
    }
    
    uint8_t* payload = new uint8_t[payloadLen];
    client.readBytes(payload, payloadLen);
    
    if (isMasked) {
        for (uint32_t i = 0; i < payloadLen; i++) {
            payload[i] ^= maskKey[i % 4];
        }
    }
    
    // Handle Opcode
    if (opcode == 0x08) { // Connection Close
        Serial.println("[WS] Connection close received");
        client.stop();
        wsConnected = false;
    } else if (opcode == 0x09) { // Ping
        // Send Pong
        sendWebSocketFrame(nullptr, 0, 0x0A);
    } else if (opcode == 0x02 || opcode == 0x01) { // Binary or Text
        if (payloadLen == COMMAND_PACKET_SIZE) {
            processCommand(payload, payloadLen);
        } else {
            Serial.printf("[WS] Invalid packet size: %d\n", payloadLen);
        }
    }
    
    delete[] payload;
}

// ═══════════════════════════════════════════════
//  Motor Control Functions
// ═══════════════════════════════════════════════

void setupMotors() {
    // Configure motor direction pins
    pinMode(MOTOR_A_IN1, OUTPUT);
    pinMode(MOTOR_A_IN2, OUTPUT);
    pinMode(MOTOR_B_IN3, OUTPUT);
    pinMode(MOTOR_B_IN4, OUTPUT);
    
    // Configure PWM channels for speed control
    ledcSetup(MOTOR_PWM_CH_A, MOTOR_PWM_FREQ, MOTOR_PWM_RES);
    ledcSetup(MOTOR_PWM_CH_B, MOTOR_PWM_FREQ, MOTOR_PWM_RES);
    ledcAttachPin(MOTOR_A_ENA, MOTOR_PWM_CH_A);
    ledcAttachPin(MOTOR_B_ENB, MOTOR_PWM_CH_B);
    
    stopMotors();
    Serial.println("[MOTOR] Motors initialized");
}

void setMotorA(bool forward, uint8_t speed) {
    motorAForward = forward;
    motorASpeed = speed;
    
    if (speed == 0) {
        digitalWrite(MOTOR_A_IN1, LOW);
        digitalWrite(MOTOR_A_IN2, LOW);
        ledcWrite(MOTOR_PWM_CH_A, 0);
    } else {
        digitalWrite(MOTOR_A_IN1, forward ? HIGH : LOW);
        digitalWrite(MOTOR_A_IN2, forward ? LOW : HIGH);
        ledcWrite(MOTOR_PWM_CH_A, SPEED_TO_PWM(constrain(speed, 0, 100)));
    }
}

void setMotorB(bool forward, uint8_t speed) {
    motorBForward = forward;
    motorBSpeed = speed;
    
    if (speed == 0) {
        digitalWrite(MOTOR_B_IN3, LOW);
        digitalWrite(MOTOR_B_IN4, LOW);
        ledcWrite(MOTOR_PWM_CH_B, 0);
    } else {
        digitalWrite(MOTOR_B_IN3, forward ? HIGH : LOW);
        digitalWrite(MOTOR_B_IN4, forward ? LOW : HIGH);
        ledcWrite(MOTOR_PWM_CH_B, SPEED_TO_PWM(constrain(speed, 0, 100)));
    }
}

void stopMotors() {
    setMotorA(true, 0);
    setMotorB(true, 0);
    Serial.println("[MOTOR] Stopped");
}

void moveForward(uint8_t speed) {
    setMotorA(true, speed);
    setMotorB(true, speed);
    Serial.printf("[MOTOR] Forward @ %d%%\n", speed);
}

void moveBackward(uint8_t speed) {
    setMotorA(false, speed);
    setMotorB(false, speed);
    Serial.printf("[MOTOR] Backward @ %d%%\n", speed);
}

void turnLeft(uint8_t speed) {
    setMotorA(true, speed / 3);    // Slow left motor
    setMotorB(true, speed);         // Full right motor
    Serial.printf("[MOTOR] Turn Left @ %d%%\n", speed);
}

void turnRight(uint8_t speed) {
    setMotorA(true, speed);         // Full left motor
    setMotorB(true, speed / 3);    // Slow right motor
    Serial.printf("[MOTOR] Turn Right @ %d%%\n", speed);
}

void spinLeft(uint8_t speed) {
    setMotorA(false, speed);   // Left backward
    setMotorB(true, speed);    // Right forward
    Serial.printf("[MOTOR] Spin Left @ %d%%\n", speed);
}

void spinRight(uint8_t speed) {
    setMotorA(true, speed);    // Left forward
    setMotorB(false, speed);   // Right backward
    Serial.printf("[MOTOR] Spin Right @ %d%%\n", speed);
}

// ═══════════════════════════════════════════════
//  LED Control Functions
// ═══════════════════════════════════════════════

void setupLEDs() {
    pinMode(LED_ONBOARD, OUTPUT);
    pinMode(LED_R, OUTPUT);
    pinMode(LED_G, OUTPUT);
    pinMode(LED_B, OUTPUT);
    
    setLED(0, 0, 0);
    Serial.println("[LED] LEDs initialized");
}

void setLED(uint8_t r, uint8_t g, uint8_t b) {
    ledR = r; ledG = g; ledB = b;
    analogWrite(LED_R, r);
    analogWrite(LED_G, g);
    analogWrite(LED_B, b);
}

void startBlinkLED(uint8_t rate, uint8_t count) {
    ledBlinking = true;
    ledBlinkRate = rate;
    ledBlinkCount = count * 2;  // Each blink = on + off
    ledBlinkTime = millis();
    ledBlinkState = true;
}

void updateLEDBlink() {
    if (!ledBlinking) return;
    
    unsigned long interval = map(ledBlinkRate, 1, 255, 500, 50);
    
    if (millis() - ledBlinkTime >= interval) {
        ledBlinkTime = millis();
        ledBlinkState = !ledBlinkState;
        
        if (ledBlinkState) {
            setLED(ledR, ledG, ledB);
        } else {
            analogWrite(LED_R, 0);
            analogWrite(LED_G, 0);
            analogWrite(LED_B, 0);
        }
        
        if (ledBlinkCount > 0) {
            ledBlinkCount--;
            if (ledBlinkCount == 0) {
                ledBlinking = false;
                setLED(0, 0, 0);
            }
        }
    }
}

// ═══════════════════════════════════════════════
//  Battery Monitoring
// ═══════════════════════════════════════════════

void setupBattery() {
    pinMode(BATTERY_PIN, INPUT);
    analogSetAttenuation(ADC_11db);  // Full 0-3.3V range
    Serial.println("[BATT] Battery monitor initialized");
}

uint8_t readBatteryPercent() {
    int raw = analogRead(BATTERY_PIN);
    float voltage = (raw / 4095.0) * 3.3 * BATTERY_DIVIDER_R;
    
    float percent = ((voltage - BATTERY_MIN_V) / (BATTERY_MAX_V - BATTERY_MIN_V)) * 100.0;
    percent = constrain(percent, 0, 100);
    
    Serial.printf("[BATT] Voltage: %.2fV — %d%%\n", voltage, (int)percent);
    return (uint8_t)percent;
}

void updateBattery() {
    if (millis() - lastBatteryRead < BATTERY_READ_INTERVAL_MS) return;
    lastBatteryRead = millis();
    
    uint8_t percent = readBatteryPercent();
    
    if (wsConnected && handshakeComplete) {
        uint8_t data[1] = { percent };
        sendWebSocketFrame(data, 1, 0x02); // 1-byte binary frame for battery
    }
}



// SHAKE animation — quick back-and-forth
const AnimKeyframe ANIM_SHAKE_FRAMES[] = {
    { true,  80, true,  80, 150 },   // Forward burst
    { false, 80, false, 80, 150 },   // Backward burst
    { true,  80, true,  80, 150 },   // Forward burst
    { false, 80, false, 80, 150 },   // Backward burst
    { true,  0,  true,  0,  100 },   // Stop
};
const int ANIM_SHAKE_LEN = 5;

// NOD animation — forward-backward "yes" motion
const AnimKeyframe ANIM_NOD_FRAMES[] = {
    { true,  50, true,  50, 200 },   // Gentle forward
    { false, 50, false, 50, 200 },   // Gentle back
    { true,  50, true,  50, 200 },   // Forward again
    { true,  0,  true,  0,  200 },   // Stop and settle
};
const int ANIM_NOD_LEN = 4;

// DANCE animation — random fun movements
const AnimKeyframe ANIM_DANCE_FRAMES[] = {
    { true,  70, false, 70, 300 },   // Spin right
    { false, 70, true,  70, 300 },   // Spin left
    { true,  90, true,  90, 200 },   // Forward burst
    { false, 90, false, 90, 200 },   // Back burst
    { true,  60, false, 60, 400 },   // Spin right slow
    { false, 60, true,  60, 400 },   // Spin left slow
    { true,  100, true, 100, 150 },  // ZOOM forward
    { false, 100, false,100, 150 },  // ZOOM back
    { true,  0,  true,  0,  200 },   // Stop
};
const int ANIM_DANCE_LEN = 9;

// EXCITED animation — fast shake + quick spins
const AnimKeyframe ANIM_EXCITED_FRAMES[] = {
    { true,  100, true,  100, 100 },
    { false, 100, false, 100, 100 },
    { true,  100, true,  100, 100 },
    { false, 100, false, 100, 100 },
    { true,  80,  false, 80,  250 },  // Full spin
    { false, 80,  true,  80,  250 },  // Reverse spin
    { true,  100, true,  100, 100 },
    { false, 100, false, 100, 100 },
    { true,  0,   true,  0,   200 },
};
const int ANIM_EXCITED_LEN = 9;

// SHY animation — slow retreat
const AnimKeyframe ANIM_SHY_FRAMES[] = {
    { false, 30, false, 30, 400 },   // Slow back
    { true,  0,  true,  0,  300 },   // Pause
    { false, 20, false, 20, 300 },   // Tiny back
    { true,  0,  true,  0,  500 },   // Long pause
};
const int ANIM_SHY_LEN = 4;

const AnimKeyframe* getAnimFrames(uint8_t id, int& len) {
    switch (id) {
        case ANIM_SHAKE:   len = ANIM_SHAKE_LEN;   return ANIM_SHAKE_FRAMES;
        case ANIM_NOD:     len = ANIM_NOD_LEN;     return ANIM_NOD_FRAMES;
        case ANIM_DANCE:   len = ANIM_DANCE_LEN;   return ANIM_DANCE_FRAMES;
        case ANIM_EXCITED: len = ANIM_EXCITED_LEN;  return ANIM_EXCITED_FRAMES;
        case ANIM_SHY:     len = ANIM_SHY_LEN;     return ANIM_SHY_FRAMES;
        default:           len = 0;                  return nullptr;
    }
}

void startAnimation(uint8_t id) {
    int len;
    const AnimKeyframe* frames = getAnimFrames(id, len);
    if (frames == nullptr) {
        Serial.printf("[ANIM] Unknown animation ID: 0x%02X\n", id);
        return;
    }
    
    animPlaying = true;
    animId = id;
    animStep = 0;
    animStepTime = millis();
    
    setMotorA(frames[0].motorA_fwd, frames[0].motorA_spd);
    setMotorB(frames[0].motorB_fwd, frames[0].motorB_spd);
    
    Serial.printf("[ANIM] Playing animation 0x%02X (%d frames)\n", id, len);
}

void updateAnimation() {
    if (!animPlaying) return;
    
    int len;
    const AnimKeyframe* frames = getAnimFrames(animId, len);
    if (frames == nullptr) {
        animPlaying = false;
        return;
    }
    
    if (millis() - animStepTime >= frames[animStep].duration) {
        animStep++;
        
        if (animStep >= len) {
            animPlaying = false;
            stopMotors();
            Serial.println("[ANIM] Animation complete");
            return;
        }
        
        animStepTime = millis();
        setMotorA(frames[animStep].motorA_fwd, frames[animStep].motorA_spd);
        setMotorB(frames[animStep].motorB_fwd, frames[animStep].motorB_spd);
    }
}

// ═══════════════════════════════════════════════
//  Command Processor
// ═══════════════════════════════════════════════

uint8_t calculateCRC(uint8_t* data, int len) {
    uint8_t crc = 0;
    for (int i = 0; i < len; i++) {
        crc ^= data[i];
    }
    return crc;
}

void sendStatus(uint8_t statusCode) {
    if (!wsConnected) return;
    
    uint8_t status[4] = {
        statusCode,
        (uint8_t)(motorAForward ? 1 : 0),
        (uint8_t)motorASpeed,
        (uint8_t)motorBSpeed
    };
    sendWebSocketFrame(status, 4, 0x02); // 4-byte binary status frame
}

void processCommand(uint8_t* data, size_t length) {
    if (length != COMMAND_PACKET_SIZE) {
        Serial.printf("[CMD] Invalid packet size: %d (expected %d)\n", length, COMMAND_PACKET_SIZE);
        sendStatus(STATUS_INVALID_CMD);
        return;
    }
    
    uint8_t seq    = data[0];
    uint8_t cmd    = data[1];
    uint8_t param1 = data[2];
    uint8_t param2 = data[3];
    uint8_t value  = data[4];
    uint8_t dura   = data[5];
    uint8_t flags  = data[6];
    uint8_t crc    = data[7];
    
    uint8_t expectedCRC = calculateCRC(data, 7);
    if (crc != expectedCRC) {
        Serial.printf("[CMD] CRC mismatch: got 0x%02X, expected 0x%02X\n", crc, expectedCRC);
        sendStatus(STATUS_INVALID_CRC);
        return;
    }
    
    if (!firstPacket && cmd != CMD_HANDSHAKE && cmd != CMD_PING) {
        if (seq == lastSeq) {
            Serial.printf("[CMD] Duplicate SEQ: 0x%02X — dropped\n", seq);
            sendStatus(STATUS_SEQ_DUPLICATE);
            return;
        }
    }
    lastSeq = seq;
    firstPacket = false;
    
    if (cmd == CMD_HANDSHAKE) {
        handshakeComplete = true;
        lastPingTime = millis();
        
        String info = String(DEVICE_NAME) + "|" + String(DEVICE_VERSION);
        sendWebSocketFrame((const uint8_t*)info.c_str(), info.length(), 0x01); // String text response
        
        Serial.println("[CMD] Handshake complete!");
        digitalWrite(LED_ONBOARD, HIGH);  // Solid LED indicates handshake complete
        sendStatus(STATUS_OK);
        return;
    }
    
    if (cmd == CMD_PING) {
        lastPingTime = millis();
        sendStatus(STATUS_OK);
        return;
    }
    
    if (!handshakeComplete) {
        Serial.println("[CMD] Command rejected — handshake not complete");
        sendStatus(STATUS_NOT_HANDSHAKED);
        return;
    }
    
    lastPingTime = millis();
    
    switch (cmd) {
        case CMD_MOVE_FORWARD:
            animPlaying = false;
            moveForward(value);
            break;
            
        case CMD_MOVE_BACKWARD:
            animPlaying = false;
            moveBackward(value);
            break;
            
        case CMD_TURN_LEFT:
            animPlaying = false;
            turnLeft(value);
            break;
            
        case CMD_TURN_RIGHT:
            animPlaying = false;
            turnRight(value);
            break;
            
        case CMD_STOP:
            animPlaying = false;
            stopMotors();
            break;
            
        case CMD_SPIN_LEFT:
            animPlaying = false;
            spinLeft(value);
            break;
            
        case CMD_SPIN_RIGHT:
            animPlaying = false;
            spinRight(value);
            break;
            
        case CMD_LED_SET:
            ledBlinking = false;
            setLED(param1, param2, flags);  // R, G, B
            Serial.printf("[LED] Set RGB(%d, %d, %d)\n", param1, param2, flags);
            break;
            
        case CMD_LED_BLINK:
            startBlinkLED(param1, param2);
            Serial.printf("[LED] Blink rate=%d count=%d\n", param1, param2);
            break;
            
        case CMD_LED_OFF:
            ledBlinking = false;
            setLED(0, 0, 0);
            Serial.println("[LED] Off");
            break;
            
        case CMD_ANIM_PLAY:
            startAnimation(param1);
            break;
            
        case CMD_ANIM_STOP:
            animPlaying = false;
            stopMotors();
            Serial.println("[ANIM] Stopped");
            break;
            
        default:
            Serial.printf("[CMD] Unknown command: 0x%02X\n", cmd);
            sendStatus(STATUS_INVALID_CMD);
            return;
    }
    
    sendStatus(STATUS_OK);
}

// ═══════════════════════════════════════════════
//  WiFi Setup
// ═══════════════════════════════════════════════

void setupWiFi() {
    Serial.println("[WIFI] Initializing...");
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    Serial.print("[WIFI] Connecting to Station ");
    Serial.print(WIFI_SSID);
    
    unsigned long startAttemptTime = millis();
    bool connected = false;
    
    while (millis() - startAttemptTime < 10000) {
        if (WiFi.status() == WL_CONNECTED) {
            connected = true;
            break;
        }
        delay(500);
        Serial.print(".");
        digitalWrite(LED_ONBOARD, !digitalRead(LED_ONBOARD));
    }
    Serial.println();
    
    if (connected) {
        Serial.print("[WIFI] Connected! IP Address: ");
        Serial.println(WiFi.localIP());
        
        if (MDNS.begin(MDNS_HOSTNAME)) {
            Serial.printf("[WIFI] mDNS responder started: http://%s.local\n", MDNS_HOSTNAME);
            MDNS.addService("ws", "tcp", WEBSOCKET_PORT);
        } else {
            Serial.println("[WIFI] Error setting up mDNS!");
        }
    } else {
        Serial.println("[WIFI] Connection failed. Switching to AP mode...");
        
        WiFi.mode(WIFI_AP);
        WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD);
        
        Serial.print("[WIFI] Access Point started. SSID: ");
        Serial.println(WIFI_AP_SSID);
        Serial.print("[WIFI] AP IP Address: ");
        Serial.println(WiFi.softAPIP());
    }
    
    server.begin();
    Serial.printf("[WIFI] WebSocket Server started on port %d\n", WEBSOCKET_PORT);
}

// ═══════════════════════════════════════════════
//  Connection Watchdog
// ═══════════════════════════════════════════════

void checkConnectionHealth() {
    if (!wsConnected) return;
    
    if (!handshakeComplete) {
        if (millis() - connectTime > HANDSHAKE_TIMEOUT_MS) {
            Serial.println("[WS] Handshake timeout — disconnecting!");
            wsClient.stop();
            wsConnected = false;
            return;
        }
    }
    
    if (handshakeComplete) {
        if (millis() - lastPingTime > PING_TIMEOUT_MS) {
            Serial.println("[WS] Ping timeout — stopping motors");
            stopMotors();
            lastPingTime = millis();
        }
    }
}

// ═══════════════════════════════════════════════
//  Idle LED Pattern (not connected)
// ═══════════════════════════════════════════════

void idleLEDPattern() {
    if (wsConnected) return;
    
    static unsigned long lastBreath = 0;
    static int breathVal = 0;
    static bool breathUp = true;
    
    if (millis() - lastBreath >= 15) {
        lastBreath = millis();
        
        if (breathUp) {
            breathVal += 3;
            if (breathVal >= 255) { breathVal = 255; breathUp = false; }
        } else {
            breathVal -= 3;
            if (breathVal <= 0) { breathVal = 0; breathUp = true; }
        }
        
        analogWrite(LED_ONBOARD, breathVal);
    }
}

// ═══════════════════════════════════════════════
//  Arduino Setup & Loop
// ═══════════════════════════════════════════════

void setup() {
    Serial.begin(115200);
    Serial.println();
    Serial.println("╔══════════════════════════════════════════════╗");
    Serial.println("║          VILY Firmware v2.0 Starting         ║");
    Serial.println("║     ESP32 WiFi Robot — LOOI Inspired         ║");
    Serial.println("╚══════════════════════════════════════════════╝");
    Serial.println();
    
    setupLEDs();
    setupMotors();
    setupBattery();
    setupWiFi();
    
    Serial.println();
    Serial.println("[VILY] Ready! Waiting for WebSocket connection...");
    Serial.printf("[VILY] Device: %s | Version: %s\n", DEVICE_NAME, DEVICE_VERSION);
    Serial.println();
}

void loop() {
    if (!wsConnected) {
        WiFiClient newClient = server.available();
        if (newClient) {
            Serial.println("[WIFI] New client connection request");
            
            if (performWebSocketHandshake(newClient)) {
                wsClient = newClient;
                wsConnected = true;
                handshakeComplete = false;
                connectTime = millis();
                lastPingTime = millis();
                firstPacket = true;
                Serial.println("[WS] Handshake successful! Client connected.");
                
                for (int i = 0; i < 3; i++) {
                    digitalWrite(LED_ONBOARD, HIGH);
                    delay(100);
                    digitalWrite(LED_ONBOARD, LOW);
                    delay(100);
                }
            } else {
                Serial.println("[WS] Handshake failed. Client rejected.");
                newClient.stop();
            }
        }
    } else {
        if (!wsClient.connected()) {
            Serial.println("[WS] Client disconnected");
            wsClient.stop();
            wsConnected = false;
            handshakeComplete = false;
            stopMotors();
            setLED(0, 0, 0);
            animPlaying = false;
        } else {
            handleWebSocketClient(wsClient);
        }
    }

    checkConnectionHealth();
    updateAnimation();
    updateLEDBlink();
    updateBattery();
    idleLEDPattern();
    
    delay(10);
}
