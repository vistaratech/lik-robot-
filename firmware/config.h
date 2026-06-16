/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    LIK Configuration                       ║
 * ║         ESP32 WiFi Robot — Inspired by LOOI Robot            ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Pin definitions, WiFi/WebSocket, motor parameters, and protocol constants.
 */

#ifndef CONFIG_H
#define CONFIG_H

// ─────────────────────────────────────────────
//  Device Identity
// ─────────────────────────────────────────────
#define DEVICE_NAME         "VILY"
#define DEVICE_VERSION      "2.0.0"
#define FIRMWARE_VERSION    1

// ─────────────────────────────────────────────
//  BLE UUIDs (Custom 128-bit)
// ─────────────────────────────────────────────
#define SERVICE_UUID                "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_MOTOR_CMD_UUID         "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_MOTOR_STATUS_UUID      "beb5483f-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_LED_CONTROL_UUID       "beb54840-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_BATTERY_UUID           "beb54841-36e1-4688-b7f5-ea07361b26a8"
#define CHAR_HANDSHAKE_UUID         "beb54842-36e1-4688-b7f5-ea07361b26a8"

// ─────────────────────────────────────────────
//  Motor Pins (TB6612FNG Motor Driver)
// ─────────────────────────────────────────────
// Motor A (Left)
#define MOTOR_A_IN1     4
#define MOTOR_A_IN2     5
#define MOTOR_A_ENA     6     // PWM speed control

// Motor B (Right)
#define MOTOR_B_IN3     7
#define MOTOR_B_IN4     2     // Reassigned from 10 to avoid SPI Flash conflict
#define MOTOR_B_ENB     1     // Reassigned from 20 to avoid Serial conflict

// Standby Pin on TB6612FNG should be connected directly to 3.3V (VCC)

// ─────────────────────────────────────────────
//  Servo Neck Tilt Pin
// ─────────────────────────────────────────────
#define SERVO_PIN       3     // MG90S Servo control pin

// ─────────────────────────────────────────────
//  Cliff Sensors (TCRT5000) - Disabled/Unused
// ─────────────────────────────────────────────
#define CLIFF_PIN_L     21
#define CLIFF_PIN_R     22

// ─────────────────────────────────────────────
//  LED Pins
// ─────────────────────────────────────────────
#define USE_NEOPIXEL          // Enable onboard WS2812 NeoPixel control
#define LED_NEOPIXEL_PIN 8    // Onboard NeoPixel pin on ESP32-C3 Super Mini
#define LED_ONBOARD     8     // Onboard LED pin alias

// ─────────────────────────────────────────────
//  Battery Monitoring
// ─────────────────────────────────────────────
#define BATTERY_PIN         0     // ADC1_CH0 (GPIO 0)
#define BATTERY_MAX_V       8.4   // Fully charged (2S LiPo)
#define BATTERY_MIN_V       6.0   // Cutoff voltage
#define BATTERY_DIVIDER_R   2.0   // Voltage divider ratio (R1=R2)
#define BATTERY_READ_INTERVAL_MS  5000  // Read every 5 seconds

// ─────────────────────────────────────────────
//  Motor Parameters
// ─────────────────────────────────────────────
#define MOTOR_PWM_FREQ      5000   // PWM frequency in Hz
#define MOTOR_PWM_RES       8      // PWM resolution (8-bit = 0-255)
#define MOTOR_PWM_CH_A      0      // LEDC channel for Motor A
#define MOTOR_PWM_CH_B      1      // LEDC channel for Motor B
#define LED_PWM_CH_R        2      // LEDC channel for Red LED (fallback)
#define LED_PWM_CH_G        3      // LEDC channel for Green LED (fallback)
#define LED_PWM_CH_B_CH     4      // LEDC channel for Blue LED (fallback)
#define MOTOR_MIN_PWM       60     // Minimum PWM to overcome friction
#define MOTOR_MAX_PWM       255    // Maximum PWM

// Speed mapping: command value (0-100) → PWM (MOTOR_MIN_PWM to MOTOR_MAX_PWM)
#define SPEED_TO_PWM(speed) ((speed) == 0 ? 0 : map(speed, 1, 100, MOTOR_MIN_PWM, MOTOR_MAX_PWM))

// ─────────────────────────────────────────────
//  Command Protocol — Command Bytes
// ─────────────────────────────────────────────
/*
 * Command Packet Format (8 bytes):
 * ┌────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
 * │ SEQ    │ CMD    │ PARAM1 │ PARAM2 │ VALUE  │ DURA   │ FLAGS  │ CRC    │
 * │ 0      │ 1      │ 2      │ 3      │ 4      │ 5      │ 6      │ 7      │
 * └────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘
 * 
 * SEQ:    Rolling sequence counter (0x00–0xFF). Duplicate SEQ = dropped packet.
 * CMD:    Command type (see below).
 * PARAM1: Command-specific parameter 1.
 * PARAM2: Command-specific parameter 2.
 * VALUE:  Magnitude/speed (0–100 for motors).
 * DURA:   Duration in units of 10ms (0 = indefinite).
 * FLAGS:  Bitfield for extra data (e.g., blue channel for LED).
 * CRC:    XOR checksum of bytes 0–6.
 */

// Command types
#define CMD_MOVE_FORWARD    0x01
#define CMD_MOVE_BACKWARD   0x02
#define CMD_TURN_LEFT       0x03
#define CMD_TURN_RIGHT      0x04
#define CMD_STOP            0x05
#define CMD_SPIN_LEFT       0x06
#define CMD_SPIN_RIGHT      0x07

#define CMD_LED_SET         0x10
#define CMD_LED_BLINK       0x11
#define CMD_LED_OFF         0x12

#define CMD_ANIM_PLAY       0x20
#define CMD_ANIM_STOP       0x21

#define CMD_HANDSHAKE       0xFE
#define CMD_PING            0xFF

// Animation IDs
#define ANIM_SHAKE          0x01
#define ANIM_NOD            0x02
#define ANIM_DANCE          0x03
#define ANIM_EXCITED        0x04
#define ANIM_SHY            0x05

// ─────────────────────────────────────────────
//  Timing
// ─────────────────────────────────────────────
#define HANDSHAKE_TIMEOUT_MS    5000    // Disconnect if no handshake within 5s
#define PING_TIMEOUT_MS         10000   // Disconnect if no ping within 10s
#define COMMAND_PACKET_SIZE     8       // Expected packet size

// ─────────────────────────────────────────────
//  Status Response Codes
// ─────────────────────────────────────────────
#define STATUS_OK               0x00
#define STATUS_INVALID_CMD      0x01
#define STATUS_INVALID_CRC      0x02
#define STATUS_NOT_HANDSHAKED   0x03
#define STATUS_SEQ_DUPLICATE    0x04

#endif // CONFIG_H
