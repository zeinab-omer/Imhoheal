# Arduino wrist-angle alarm

The Arduino sketch reads an MPU6050, sounds an alarm when the wrist-angle
change passes its configured threshold, and writes `angle_change,alarm` to the
serial port. The PC logger reads those two values and sends them to the
ImhoHeal backend, which stores the samples in Supabase.

This is a separate data path from the ESP32 motion logger. Wrist angle and
alarm state do not measure bone density, fracture healing, or plate strain.
The configured angle thresholds are experimental and are not a
safety-certified alarm.

## Files

- `arduino_wrist_alarm.ino` is the supplied `main.cpp`, renamed only to the
  Arduino IDE sketch extension.
- `logger.py` batches serial samples and uploads them through the protected
  ImhoHeal device API.
- `config.example.py` is a template for the API URL, paired device ID/token,
  and optional serial port. Copy it to `config.py`; never commit that file.
- `requirements.txt` lists the Python dependency for the serial connection.

## Setup

1. In Supabase, run `supabase/migrations/003_arduino_wrist_readings.sql`
   once. The migration creates the wrist-reading table, access policy, and
   batch-storage function.
2. Start the ImhoHeal backend using the root README instructions.
3. Sign in as a doctor, open the target patient's page, and pair a device with
   an unused ID such as `arduino-p-1001`. Copy the token shown once.
4. Copy `config.example.py` to `config.py` and set `DEVICE_ID` and
   `DEVICE_TOKEN` to the exact values from pairing. Set `API_BASE_URL` to the
   computer running Flask, for example `http://127.0.0.1:5000`. Keep the token
   private; `config.py` is ignored by Git.
5. Open `arduino_wrist_alarm.ino` in Arduino IDE. Install the **Adafruit
   MPU6050** and **Adafruit Unified Sensor** libraries, select the actual
   board and COM port, and upload. The sketch uses `Wire.begin()` and the
   selected board's default I2C pins. It drives a buzzer on pin 8, green LED
   on pin 9, and red LED on pin 10. Verify board voltage and pin compatibility
   and use appropriate LED current-limiting resistors.
6. Install the PC logger dependency and run it from this folder:

   ```powershell
   python -m pip install -r requirements.txt
   python logger.py
   ```

The logger expects serial speed **115200 baud** and automatically detects
common Arduino/USB-serial adapters. If it cannot identify the board, set
`PORT` in `config.py`, for example `"COM3"`. Keep Serial Monitor closed while
the logger is running because only one program can use a serial port at a time.

The Arduino emits about 50 lines per second; the logger keeps the sketch
unchanged but stores at most one sample per second and uploads batches every
five seconds to avoid flooding Supabase. Sequence numbers and unuploaded batches are stored locally in Git-ignored
`sequence.txt` and `pending_readings.json` files. Failed uploads are retried
on the next run. Do not delete `sequence.txt` while continuing to use the same
paired device, or already-used sequence numbers could be sent again.

The selected patient's sensor section refreshes automatically every five
seconds and displays the saved Arduino angles and alarm states. For Arduino
access from another computer, expose Flask only on a trusted local network and
use the server computer's LAN address in `API_BASE_URL`; do not expose Flask's
development server to the public Internet.
