/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                   LIK Firmware v2.0                        ║
 * ║         ESP32 BLE Robot — Inspired by LOOI Robot           ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Custom BLE GATT server for controlling a phone-mounted robot.
 * Features:
 *   - BLE connection with handshake authentication
 *   - Dual DC motor control via L298N driver
 *   - RGB LED control (NeoPixel status LED)
 *   - Battery voltage monitoring
 *   - Pre-programmed movement animations
 *   - Sequence-based command protocol (LOOI-inspired)
 * 
 * Hardware:
 *   - ESP32 DevKit V1 / ESP32-C3 Super Mini
 *   - L298N / TB6612FNG Motor Driver
 *   - 2x DC Motors
 *   - Onboard WS2812 NeoPixel Status LED
 *   - Voltage divider on battery line
 */

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "config.h"

#ifdef USE_NEOPIXEL
#include <Adafruit_NeoPixel.h>
Adafruit_NeoPixel pixels(1, LED_NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);
#endif

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

// BLE
BLEServer*          pServer         = nullptr;
BLECharacteristic*  pMotorCmdChar   = nullptr;
BLECharacteristic*  pMotorStatusChar = nullptr;
BLECharacteristic*  pLedControlChar = nullptr;
BLECharacteristic*  pBatteryChar    = nullptr;
BLECharacteristic*  pHandshakeChar  = nullptr;

bool deviceConnected    = false;
bool oldDeviceConnected = false;
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

void toggleOnboardLED(bool state) {
    #ifdef USE_NEOPIXEL
    if (state) {
        pixels.setPixelColor(0, pixels.Color(0, 0, 50)); // Low intensity blue/white
    } else {
        pixels.setPixelColor(0, pixels.Color(0, 0, 0));
    }
    pixels.show();
    #else
    digitalWrite(LED_ONBOARD, state ? HIGH : LOW);
    #endif
}

// ═══════════════════════════════════════════════
//  BLE Server Callbacks
// ═══════════════════════════════════════════════

class VilyServerCallbacks : public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) override {
        deviceConnected = true;
        handshakeComplete = false;
        connectTime = millis();
        lastPingTime = millis();
        firstPacket = true;
        
        Serial.println("[BLE] Device connected — waiting for handshake...");
        
        // Blink LED to indicate connection
        for (int i = 0; i < 3; i++) {
            toggleOnboardLED(true);
            delay(100);
            toggleOnboardLED(false);
            delay(100);
        }
    }

    void onDisconnect(BLEServer* pServer) override {
        deviceConnected = false;
        handshakeComplete = false;
        
        // Stop all motors on disconnect
        stopMotors();
        setLED(0, 0, 0);
        animPlaying = false;
        
        Serial.println("[BLE] Device disconnected — motors stopped");
        
        // Restart advertising
        delay(500);
        pServer->startAdvertising();
        Serial.println("[BLE] Advertising restarted");
    }
};

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
    #ifdef USE_NEOPIXEL
    pixels.begin();
    pixels.setPixelColor(0, pixels.Color(0, 0, 0));
    pixels.show();
    #else
    pinMode(LED_ONBOARD, OUTPUT);
    
    // Setup PWM channels for RGB LED
    ledcSetup(LED_PWM_CH_R, 5000, 8);
    ledcSetup(LED_PWM_CH_G, 5000, 8);
    ledcSetup(LED_PWM_CH_B_CH, 5000, 8);
    ledcAttachPin(LED_R, LED_PWM_CH_R);
    ledcAttachPin(LED_G, LED_PWM_CH_G);
    ledcAttachPin(LED_B, LED_PWM_CH_B_CH);
    #endif
    
    setLED(0, 0, 0);
    Serial.println("[LED] LEDs initialized");
}

void setLED(uint8_t r, uint8_t g, uint8_t b) {
    ledR = r; ledG = g; ledB = b;
    #ifdef USE_NEOPIXEL
    pixels.setPixelColor(0, pixels.Color(r, g, b));
    pixels.show();
    #else
    ledcWrite(LED_PWM_CH_R, r);
    ledcWrite(LED_PWM_CH_G, g);
    ledcWrite(LED_PWM_CH_B_CH, b);
    #endif
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
            setLED(0, 0, 0);
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
    
    if (deviceConnected && handshakeComplete) {
        uint8_t data[1] = { percent };
        pBatteryChar->setValue(data, 1);
        pBatteryChar->notify();
    }
}

// ═══════════════════════════════════════════════
//  Animation Engine
// ═══════════════════════════════════════════════

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
    if (!deviceConnected) return;
    
    uint8_t status[4] = {
        statusCode,
        (uint8_t)(motorAForward ? 1 : 0),
        (uint8_t)motorASpeed,
        (uint8_t)motorBSpeed
    };
    pMotorStatusChar->setValue(status, 4);
    pMotorStatusChar->notify();
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
        pHandshakeChar->setValue(info.c_str());
        
        Serial.println("[CMD] Handshake complete!");
        toggleOnboardLED(true);  // Solid LED indicates handshake complete
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
//  BLE Characteristic Callbacks
// ═══════════════════════════════════════════════

class MotorCmdCallback : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pChar) override {
        std::string rxValue = pChar->getValue();
        if (rxValue.length() > 0) {
            Serial.printf("[BLE] Received %d bytes: ", rxValue.length());
            for (int i = 0; i < rxValue.length(); i++) {
                Serial.printf("%02X ", (uint8_t)rxValue[i]);
            }
            Serial.println();
            
            processCommand((uint8_t*)rxValue.data(), rxValue.length());
        }
    }
};

class LedControlCallback : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pChar) override {
        std::string rxValue = pChar->getValue();
        if (rxValue.length() >= 3) {
            // Direct LED control: [R, G, B]
            ledBlinking = false;
            setLED((uint8_t)rxValue[0], (uint8_t)rxValue[1], (uint8_t)rxValue[2]);
            Serial.printf("[LED] Direct set RGB(%d, %d, %d)\n", 
                          (uint8_t)rxValue[0], (uint8_t)rxValue[1], (uint8_t)rxValue[2]);
        }
    }
};

class HandshakeCallback : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* pChar) override {
        std::string rxValue = pChar->getValue();
        if (rxValue.length() > 0) {
            // Accept any write as handshake attempt
            handshakeComplete = true;
            lastPingTime = millis();
            
            String info = String(DEVICE_NAME) + "|" + String(DEVICE_VERSION);
            pHandshakeChar->setValue(info.c_str());
            
            Serial.println("[BLE] Handshake via characteristic write!");
            toggleOnboardLED(true);
        }
    }
};

// ═══════════════════════════════════════════════
//  BLE Setup
// ═══════════════════════════════════════════════

void setupBLE() {
    Serial.println("[BLE] Initializing...");
    
    // Initialize BLE device
    BLEDevice::init(DEVICE_NAME);
    
    // Create server
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new VilyServerCallbacks());
    
    // Create service
    BLEService* pService = pServer->createService(SERVICE_UUID);
    
    // Motor Command characteristic (Write)
    pMotorCmdChar = pService->createCharacteristic(
        CHAR_MOTOR_CMD_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    pMotorCmdChar->setCallbacks(new MotorCmdCallback());
    
    // Motor Status characteristic (Notify)
    pMotorStatusChar = pService->createCharacteristic(
        CHAR_MOTOR_STATUS_UUID,
        BLECharacteristic::PROPERTY_NOTIFY
    );
    pMotorStatusChar->addDescriptor(new BLE2902());
    
    // LED Control characteristic (Write)
    pLedControlChar = pService->createCharacteristic(
        CHAR_LED_CONTROL_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    pLedControlChar->setCallbacks(new LedControlCallback());
    
    // Battery characteristic (Read + Notify)
    pBatteryChar = pService->createCharacteristic(
        CHAR_BATTERY_UUID,
        BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    pBatteryChar->addDescriptor(new BLE2902());
    
    // Handshake characteristic (Write + Read)
    pHandshakeChar = pService->createCharacteristic(
        CHAR_HANDSHAKE_UUID,
        BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_READ
    );
    pHandshakeChar->setCallbacks(new HandshakeCallback());
    
    // Start service
    pService->start();
    
    // Start advertising
    BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
    
    Serial.println("[BLE] Server started — advertising as '" DEVICE_NAME "'");
}

// ═══════════════════════════════════════════════
//  Connection Watchdog
// ═══════════════════════════════════════════════

void checkConnectionHealth() {
    if (!deviceConnected) return;
    
    if (!handshakeComplete) {
        if (millis() - connectTime > HANDSHAKE_TIMEOUT_MS) {
            Serial.println("[BLE] Handshake timeout — disconnecting!");
            pServer->disconnect(pServer->getConnId());
            return;
        }
    }
    
    if (handshakeComplete) {
        if (millis() - lastPingTime > PING_TIMEOUT_MS) {
            Serial.println("[BLE] Ping timeout — stopping motors (keeping connection)");
            stopMotors();
            lastPingTime = millis();
        }
    }
}

// ═══════════════════════════════════════════════
//  Idle LED Pattern (not connected)
// ═══════════════════════════════════════════════

void idleLEDPattern() {
    if (deviceConnected) return;
    
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
        
        #ifdef USE_NEOPIXEL
        // Soft blue breathing on NeoPixel Status LED
        pixels.setPixelColor(0, pixels.Color(0, 0, breathVal / 5)); // Low intensity blue breathing
        pixels.show();
        #else
        analogWrite(LED_ONBOARD, breathVal);
        #endif
    }
}

// ═══════════════════════════════════════════════
//  Arduino Setup & Loop
// ═══════════════════════════════════════════════

void setup() {
    Serial.begin(115200);
    Serial.println();
    Serial.println("╔══════════════════════════════════════════════╗");
    Serial.println("║          LIK Firmware v2.0 Starting         ║");
    Serial.println("║     ESP32 BLE Robot — LOOI Inspired          ║");
    Serial.println("╚══════════════════════════════════════════════╝");
    Serial.println();
    
    setupLEDs();
    setupMotors();
    setupBattery();
    setupBLE();
    
    Serial.println();
    Serial.println("[LIK] Ready! Waiting for BLE connection...");
    Serial.printf("[LIK] Device: %s | Version: %s\n", DEVICE_NAME, DEVICE_VERSION);
    Serial.println();
}

void loop() {
    checkConnectionHealth();
    updateAnimation();
    updateLEDBlink();
    updateBattery();
    idleLEDPattern();
    
    if (!deviceConnected && oldDeviceConnected) {
        oldDeviceConnected = false;
    }
    if (deviceConnected && !oldDeviceConnected) {
        oldDeviceConnected = true;
    }
    
    delay(10);
}
