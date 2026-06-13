# VILY Hardware Wiring Guide

## Components Required

| Component | Quantity | Notes |
|-----------|----------|-------|
| ESP32 DevKit V1 | 1 | Any ESP32 with BLE support |
| L298N Motor Driver | 1 | Dual H-Bridge |
| DC Motors (with wheels) | 2 | 6-12V rated |
| Robot Chassis | 1 | 2WD with caster wheel |
| Phone Mount | 1 | 3D print or buy |
| RGB LED (Common Cathode) | 1 | Optional |
| 220Ω Resistors | 3 | For RGB LED |
| 10KΩ Resistors | 2 | For voltage divider |
| Battery Pack | 1 | 2S LiPo (7.4V) or 6xAA |
| Toggle Switch | 1 | Main power |
| Jumper Wires | ~20 | Male-to-female |

---

## Wiring Diagram

```
                    ┌──────────────────────┐
                    │       ESP32          │
                    │                      │
    Motor A ◄──── GPIO 25 ──► L298N IN1   │
    (Left)  ◄──── GPIO 26 ──► L298N IN2   │
            ◄──── GPIO 32 ──► L298N ENA   │  (PWM)
                    │                      │
    Motor B ◄──── GPIO 27 ──► L298N IN3   │
    (Right) ◄──── GPIO 14 ──► L298N IN4   │
            ◄──── GPIO 33 ──► L298N ENB   │  (PWM)
                    │                      │
    LED Red ◄──── GPIO 4  ──► 220Ω ──► R  │
    LED Grn ◄──── GPIO 16 ──► 220Ω ──► G  │
    LED Blu ◄──── GPIO 17 ──► 220Ω ──► B  │
                    │                      │
    Battery ◄──── GPIO 34 ──► Voltage     │  (ADC, Input Only)
                    │          Divider     │
                    │                      │
    Onboard ◄──── GPIO 2  ──► Built-in    │
                    │                      │
                    │   3V3  ──► (sensors) │
                    │   GND  ──► Common    │
                    │   VIN  ──► 5V in     │
                    └──────────────────────┘
```

---

## L298N Motor Driver Connections

```
┌──────────────────────────────────────────────────────┐
│                    L298N Module                       │
│                                                      │
│  Motor A ◄──── OUT1, OUT2 (Left motor wires)        │
│  Motor B ◄──── OUT3, OUT4 (Right motor wires)       │
│                                                      │
│  IN1  ◄──── ESP32 GPIO 25                           │
│  IN2  ◄──── ESP32 GPIO 26                           │
│  IN3  ◄──── ESP32 GPIO 27                           │
│  IN4  ◄──── ESP32 GPIO 14                           │
│  ENA  ◄──── ESP32 GPIO 32  (Remove jumper!)         │
│  ENB  ◄──── ESP32 GPIO 33  (Remove jumper!)         │
│                                                      │
│  +12V ◄──── Battery + (7.4V)                        │
│  GND  ◄──── Battery - AND ESP32 GND (COMMON!)      │
│  +5V  ──►── ESP32 VIN  (5V output from regulator)  │
│                                                      │
│  ⚠ IMPORTANT: Remove ENA/ENB jumpers for PWM!       │
└──────────────────────────────────────────────────────┘
```

### Key Notes:
1. **Remove the ENA/ENB jumpers** on the L298N module — these default to full speed. We need PWM control from the ESP32.
2. **Common Ground** — ESP32 GND and L298N GND MUST be connected together.
3. **Power from L298N** — The L298N has a built-in 5V regulator. Connect its 5V output to ESP32 VIN to power the ESP32 from the battery.

---

## Battery Voltage Divider

To read the battery voltage (7.4V max) with the ESP32's 3.3V ADC:

```
Battery +  ──── [10KΩ R1] ──┬── [10KΩ R2] ──── GND
                              │
                              └──── ESP32 GPIO 34 (ADC)
```

**Formula**: `V_adc = V_battery × (R2 / (R1 + R2)) = V_battery × 0.5`

With 2S LiPo (8.4V max): `V_adc_max = 8.4 × 0.5 = 4.2V`

> ⚠ This slightly exceeds ESP32's 3.3V ADC. Use **20KΩ + 10KΩ** instead for safety:
> `V_adc_max = 8.4 × (10 / 30) = 2.8V` ✓

Update `BATTERY_DIVIDER_R` in `config.h` to `3.0` if using 20KΩ+10KΩ.

---

## RGB LED (Common Cathode)

```
ESP32 GPIO 4  ──── [220Ω] ──── LED Red Anode
ESP32 GPIO 16 ──── [220Ω] ──── LED Green Anode
ESP32 GPIO 17 ──── [220Ω] ──── LED Blue Anode
                                LED Cathode (longest leg) ──── GND
```

---

## Motor Direction Reference

| IN1 | IN2 | Motor A Action |
|-----|-----|----------------|
| HIGH | LOW | Forward |
| LOW | HIGH | Backward |
| LOW | LOW | Stop (coast) |
| HIGH | HIGH | Brake |

Same logic applies to IN3/IN4 for Motor B.

---

## Assembly Tips

1. **Solder motor wires** — Don't rely on friction clips; motors vibrate.
2. **Hot glue the L298N** to the chassis for stability.
3. **Use zip ties** for cable management.
4. **Phone mount** — Use a spring-loaded phone holder glued/screwed to the top plate.
5. **Balance** — Place the battery pack low and centered for stability.
6. **ESP32 placement** — Mount with the USB port accessible for programming.

---

## Pin Summary Table

| ESP32 Pin | Function | Connected To |
|-----------|----------|--------------|
| GPIO 25 | Motor A Direction 1 | L298N IN1 |
| GPIO 26 | Motor A Direction 2 | L298N IN2 |
| GPIO 32 | Motor A Speed (PWM) | L298N ENA |
| GPIO 27 | Motor B Direction 1 | L298N IN3 |
| GPIO 14 | Motor B Direction 2 | L298N IN4 |
| GPIO 33 | Motor B Speed (PWM) | L298N ENB |
| GPIO 4 | LED Red | 220Ω → LED R |
| GPIO 16 | LED Green | 220Ω → LED G |
| GPIO 17 | LED Blue | 220Ω → LED B |
| GPIO 2 | Onboard LED | Built-in |
| GPIO 34 | Battery Voltage (ADC) | Voltage Divider |
| VIN | 5V Power Input | L298N 5V Out |
| GND | Common Ground | L298N GND, Battery - |
