# LIK / LOOI Clone — Hardware Wiring Guide (ESP32-C3 & TB6612FNG)

This guide shows you how to wire your **ESP32-C3 Super Mini** board, **TB6612FNG** motor driver, Buck Converter, 18650 batteries, TCRT5000 cliff sensors, and N20 gear motors.

---

## 🔌 Connection Pinout Table

Use the following table to connect the jumper wires between modules. 

> [!NOTE]
> The ESP32-C3 Super Mini has limited GPIOs, so some pins are shared or mapped differently than the standard ESP32 DevKit.
> We also hardwire the TB6612FNG's `STBY` (Standby) pin to `3.3V` to save a GPIO pin.

| From (Source) | To (Destination) | Wire Color (Typical) | Purpose / Description |
| :--- | :--- | :--- | :--- |
| **Battery Holder (+)** | Buck Converter **IN(+)** | Red | Input battery power (7.4V - 8.4V) |
| **Battery Holder (-)** | Buck Converter **IN(-)** | Black | Input battery ground |
| **Buck Converter OUT(+)** | ESP32-C3 **5V** pin | Red | Power up ESP32-C3 safely with stable **5.0V** |
| **Buck Converter OUT(-)** | ESP32-C3 **GND** pin | Black | Common ground connection |
| **Battery Holder (+)** | TB6612FNG **VM** pin | Red | Raw battery positive (high power line for N20 motors) |
| **Battery Holder (-)** | TB6612FNG **GND** pin | Black | Common ground |
| **ESP32-C3 3V3** | TB6612FNG **VCC** pin | Red | Logic power supply (3.3V) for driver |
| **ESP32-C3 3V3** | TB6612FNG **STBY** pin | Yellow | Standby control pin (tied HIGH to stay active) |
| **ESP32-C3 GPIO 4** | TB6612FNG **AIN1** | Yellow | Left Motor (Motor A) direction 1 |
| **ESP32-C3 GPIO 5** | TB6612FNG **AIN2** | Orange | Left Motor (Motor A) direction 2 |
| **ESP32-C3 GPIO 6** | TB6612FNG **PWMA** | Yellow | Left Motor (Motor A) speed control (LEDC PWM) |
| **ESP32-C3 GPIO 7** | TB6612FNG **BIN1** | Blue | Right Motor (Motor B) direction 1 |
| **ESP32-C3 GPIO 10** | TB6612FNG **BIN2** | Green | Right Motor (Motor B) direction 2 |
| **ESP32-C3 GPIO 20** | TB6612FNG **PWMB** | Blue | Right Motor (Motor B) speed control (LEDC PWM) |
| **TB6612FNG AO1 / AO2** | Motor A (Left) terminals | Red / Black | Power to Left Motor |
| **TB6612FNG BO1 / BO2** | Motor B (Right) terminals | Red / Black | Power to Right Motor |
| **ESP32-C3 GPIO 3** | MG90S **Signal** (Orange) | Orange | Servo neck tilt control signal (PWM) |
| **Buck Converter OUT(+)** | MG90S **VCC** (Red) | Red | Power to servo (5V) |
| **Buck Converter OUT(-)** | MG90S **GND** (Brown) | Black | Ground for servo |
| **ESP32-C3 GPIO 0** | Battery Voltage Divider | Yellow | Battery monitoring ADC input (ADC1_CH0) |
| **ESP32-C3 GPIO 1** | Left TCRT5000 DO | Green | Left cliff sensor digital input |
| **ESP32-C3 GPIO 2** | Right TCRT5000 DO | Orange | Right cliff sensor digital input |
| **ESP32-C3 3V3** | TCRT5000 **VCC** | Red | Power to cliff sensors (3.3V) |
| **ESP32-C3 GND** | TCRT5000 **GND** | Black | Ground for cliff sensors |

---

## ⚠️ CRITICAL SAFETY STEP (Do this BEFORE connecting the ESP32-C3)

1. Connect the **battery pack** to the **Buck Converter IN(+) and IN(-)** pins.
2. **Do NOT connect the Buck Converter OUT pins to the ESP32-C3 yet.**
3. Turn on the battery power.
4. Take a **multimeter**, set it to DC Voltage mode, and measure the voltage at the **Buck Converter OUT(+) and OUT(-)** pins.
5. Use a small flat-head screwdriver to slowly turn the brass screw on the blue buck converter potentiometer until the multimeter screen reads **exactly 5.0V** (or 5.1V).
6. Once adjusted, turn off the battery power, connect the Buck Converter output to the ESP32-C3 **5V** and **GND** pins. This prevents over-voltage damage to your new board!
