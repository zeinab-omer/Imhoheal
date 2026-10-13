# ESP32 + MPU6050 bench test

This firmware is for a **tabletop electronics test only**. It reports motion
and gravity from the MPU6050; it does not measure fracture healing, bone
density, plate strain, or a person's medical condition. Do not attach this
prototype to a person, an implant, or a patient.

## Supported setup

- A common ESP32 DevKit / ESP32-WROOM development board using GPIO 21 (SDA)
  and GPIO 22 (SCL).
- MPU6050 breakout board with I2C pins labelled VCC, GND, SDA and SCL.
- Arduino IDE with the Espressif ESP32 board package installed.

The exact ESP32 board model is not confirmed. If the board does not expose
GPIO 21/22 or is not a classic ESP32 DevKit, check its pinout and adjust
`kSdaPin` / `kSclPin` in the sketch before wiring.

## Wiring (power off before connecting)

| MPU6050 breakout | ESP32 DevKit |
|---|---|
| VCC | 3V3 |
| GND | GND |
| SDA | GPIO 21 |
| SCL | GPIO 22 |
| AD0 (if exposed) | GND, or leave in its documented default state |

Use 3.3 V logic and power for this bench setup. Do not connect the sensor's
SDA/SCL to 5 V. A stationary sensor should show approximately 1 g on the axis
pointing upward and approximately 0 g on the other two axes; orientation
changes which axis reads gravity. Small offsets and noise are normal.

## One-time setup

1. Install Arduino IDE and the Espressif **esp32** boards package.
2. Open `esp32_mpu6050.ino` in `firmware/esp32_mpu6050`.
3. Copy `config.example.h` to `config.h` in that same folder. Fill in the
   Wi-Fi name/password, server LAN IP, paired device ID and one-time token.
   `config.h` is ignored by Git and must not be shared.
4. In Arduino IDE choose the ESP32 board that matches the label on the board,
   choose its COM port, and upload. No third-party Arduino sensor library is
   needed; the sketch reads the MPU6050 registers over I2C.
5. Open Serial Monitor at **115200 baud**. The startup log should report the
   MPU6050 address (usually `0x68`) and a connected Wi-Fi IP.

The sketch configures ±2 g / ±250 degrees per second and sends one reading per
second. It stores its sequence counter in ESP32 non-volatile preferences, so
restarting the board does not reuse a sequence number.

## Start the web server

Open PowerShell in the repository root:

```powershell
$env:EMOHEAL_HOST = "0.0.0.0"
python backend\app.py
```

Find the computer IPv4 address with `ipconfig` (the current workspace detected
`192.168.1.4` on Wi-Fi; it may change). Put that address in `SERVER_BASE_URL`,
for example `http://192.168.1.4:5000`. The computer and ESP32 must be on the
same trusted Wi-Fi network. Do not expose the Flask development server to the
Internet. If Windows Firewall asks, allow Python only on a trusted private
network.

## Pair and test

1. Open `http://127.0.0.1:5000` on the computer and sign in using the demo
   doctor account shown in the main README.
2. Open **Patients**, choose a demo patient, and scroll to **ESP32 / MPU6050
   motion data**.
3. Keep the device ID `esp32-p-1001` if pairing it to patient `P-1001`, or set
   another unique ID. Click **Create pairing token**.
4. Copy the token immediately into `DEVICE_TOKEN` in `config.h`. Pairing tokens
   are displayed once.
5. Rebuild/upload the sketch after changing `config.h`, open Serial Monitor,
   and check for HTTP `201`. HTTP `201` means a sample was saved; `401` means
   device ID/token mismatch; `409` means the sequence was already used.
6. Keep the sensor still on a desk, then gently tilt it by hand. Confirm the
   axis values change in Serial Monitor. Refresh the selected patient's page
   to see the saved samples and graphs.
7. Stop with the ESP32 reset button or unplug USB. No person needs to wear it.

If the MPU6050 is not detected, power everything off and recheck 3V3, GND,
SDA/SCL, and the board pin numbers. If Wi-Fi connects but HTTP fails, recheck
the server IP/port, firewall, pairing token, and exact device ID. The firmware
prints errors to Serial Monitor.

## Limits

The prototype sends data over plain HTTP on the local network and is only for
a trusted bench test with fictional demo records. Do not use real patient
data, public Wi-Fi, or clinical decisions. Production use would require
secure device provisioning, HTTPS, key rotation/revocation, clinical and
engineering validation, privacy review, and regulatory approval as applicable.
