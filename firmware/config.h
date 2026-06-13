/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    VILY Configuration                       ║
 * ║         ESP32 BLE Robot — Inspired by LOOI Robot            ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Pin definitions, BLE UUIDs, motor parameters, and protocol constants.
 */

#ifndef CONFIG_H
#define CONFIG_H

// ─────────────────────────────────────────────
//  Device Identity
// ─────────────────────────────────────────────
#define DEVICE_NAME         "VILY"
#define DEVICE_VERSION      "1.0.0"
#define FIRMWARE_VERSION    1

// ─────────────────────────────────────────────
//  BLE UUIDs (Custom 128-bit)
// ─────────────────────────────────────────────
// Main Robot Control Service
#define SERVICE_UUID                "4fafc201-1fb5-459e-8fcc-c5c9c331914b"

// Characteristics
#define CHAR_MOTOR_CMD_UUID         "beb5483e-36e1-4688-b7f5-ea07361b26a8"  // Write — Motor commands
#define CHAR_MOTOR_STATUS_UUID      "beb5483f-36e1-4688-b7f5-ea07361b26a8"  // Notify — Motor status
#define CHAR_LED_CONTROL_UUID       "beb54840-36e1-4688-b7f5-ea07361b26a8"  // Write — LED control
#define CHAR_BATTERY_UUID           "beb54841-36e1-4688-b7f5-ea07361b26a8"  // Read/Notify — Battery
#define CHAR_HANDSHAKE_UUID         "beb54842-36e1-4688-b7f5-ea07361b26a8"  // Write/Read — Handshake

// ─────────────────────────────────────────────
//  Motor Pins (L298N Motor Driver)
// ─────────────────────────────────────────────
// Motor A (Left)
#define MOTOR_A_IN1     25
#define MOTOR_A_IN2     26
#define MOTOR_A_ENA     32    // PWM speed control

// Motor B (Right)
#define MOTOR_B_IN3     27
#define MOTOR_B_IN4     14
#define MOTOR_B_ENB     33    // PWM speed control

// ─────────────────────────────────────────────
//  LED Pins
// ─────────────────────────────────────────────
#define LED_ONBOARD     2     // Built-in blue LED
#define LED_R           4     // External RGB — Red
#define LED_G           16    // External RGB — Green
#define LED_B           17    // External RGB — Blue

// ─────────────────────────────────────────────
//  Battery Monitoring
// ─────────────────────────────────────────────
#define BATTERY_PIN         34    // ADC input (voltage divider)
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
#define MOTOR_MIN_PWM       60     // Minimum PWM to overcome friction
#define MOTOR_MAX_PWM       255    // Maximum PWM

// Speed mapping: command value (0-100) → PWM (MOTOR_MIN_PWM to MOTOR_MAX_PWM)
#define SPEED_TO_PWM(speed) map(speed, 0, 100, MOTOR_MIN_PWM, MOTOR_MAX_PWM)

// ─────────────────────────────────────────────
//  BLE Protocol — Command Bytes
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
