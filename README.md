# ImhoHeal

Research-stage orthopedic monitoring prototype with a Flask backend, plain HTML/CSS/JS frontend, Supabase Auth, and a bench-test ESP32/MPU6050 motion-data path.

**Not for clinical use.** The six patient records and weekly bone-density/strain values seeded by the migration are fictional demo data. The MPU6050 reports motion only; it does not measure bone density, fracture healing, or plate strain. The current healing analysis is a rule-based placeholder, not a trained AI model.

## Connect the empty Supabase project

The Supabase project URL and publishable key are public client identifiers. The server also needs a Supabase **secret key** (or legacy `service_role` key) to hash device tokens, accept device readings, and send patient invitations. Keep that server key only in `backend/.env`; never place it in frontend code or send it in chat.

1. In the Supabase Dashboard for `ImhoHeal`, open **SQL Editor**, create a query, paste and run `supabase/migrations/001_initial_schema.sql`. It creates the tables, access policies, an Auth profile trigger, and the fictional demo patient/readings data.
2. Copy `backend/.env.example` to `backend/.env`. The example contains the supplied project URL and publishable key. Add the server-side secret key from **Project Settings → API Keys** to `SUPABASE_SECRET_KEY`.
3. In **Authentication → URL Configuration**, set the local Site URL to `http://localhost:5000` and add it to the allowed redirect URLs. Disable public sign-ups; patient accounts should be invitation-only.
4. Invite the first doctor from **Authentication → Users** in the Supabase Dashboard, using the email the doctor will sign in with. The database trigger initially gives new accounts the patient role. In SQL Editor, promote only that exact account to doctor:

   ```sql
   update public.profiles
   set role = 'doctor', patient_id = null
   where id = (
     select id from auth.users
     where lower(email) = lower('DOCTOR_EMAIL_HERE')
   );
   ```

   Replace `DOCTOR_EMAIL_HERE`, then confirm one profile row was updated. Do not make ordinary patient accounts doctors.
5. Install backend dependencies and start the server from the repository root:

   ```powershell
   python -m pip install -r backend\requirements.txt
   python backend\app.py
   ```

6. If `001_initial_schema.sql` was applied before this change, also run `supabase/migrations/002_allow_shared_patient_records.sql` once in SQL Editor. It removes the one-account-per-record restriction; it does not copy or alter patient readings.
7. Run `supabase/migrations/003_arduino_wrist_readings.sql` once in SQL Editor to add secure storage for Arduino wrist-angle samples.
8. Sign in with the doctor's invited email and password. On the doctor dashboard, choose whether to share an existing record with another email or create a new patient record and send the invitation. Sharing gives the new account access to the same patient record and readings; it does not duplicate the data. A new record needs name, email, age, sex, injury, implant, and surgery date; it starts with no weekly readings, so the dashboard does not display fabricated medical measurements. Invite links return to the app, where the invited user chooses a password before continuing. Keep `APP_REDIRECT_URL` on the local app origin and add that exact URL to Supabase's allowed redirect URLs.

The app uses the signed-in user's Supabase access token for normal database reads; Postgres Row Level Security restricts doctors and patients to their allowed records. The ESP32 receives a separate, randomly generated per-device token. Only its SHA-256 hash is stored in Supabase. The server secret is used only in backend requests.

### Local configuration

`backend/.env` is read at server startup. Restart Flask after changing it. It supports:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (server only; alternatively `SUPABASE_SERVICE_ROLE_KEY`)
- `APP_REDIRECT_URL` (invitation redirect; default local app is fine)
- `EMOHEAL_HOST` (defaults to `127.0.0.1`; use `0.0.0.0` only for a trusted LAN hardware test)

Never commit `backend/.env`. It is ignored by Git. If a secret key is exposed, revoke it in Supabase and configure a new one.

## ESP32 + MPU6050 tabletop test

Firmware and board setup: `firmware/esp32_mpu6050/README.md`.

The sketch targets a common ESP32 DevKit on GPIO 21 (SDA) and GPIO 22 (SCL). Verify your board pinout first. With power disconnected, wire MPU6050 VCC→3V3, GND→GND, SDA→GPIO 21 and SCL→GPIO 22. Do not connect I2C signals to 5 V.

## Separate Arduino wrist-angle experiment

The Arduino sketch and PC serial logger are stored in
`firmware/arduino_wrist_alarm/`. The Arduino sketch drives a buzzer and LEDs
based on wrist-angle change and sends two serial values. The Python logger
reads that exact format, samples at most once per second, and sends batches
through Flask to Supabase using a paired device token. Run migration
`003_arduino_wrist_readings.sql` before using this path. See that folder's
README for setup and pairing steps.

For a same-Wi-Fi bench test, start the server in PowerShell:

```powershell
$env:EMOHEAL_HOST = "0.0.0.0"
python backend\app.py
```

Copy `firmware/esp32_mpu6050/config.example.h` to `config.h`; set the local Wi-Fi credentials, computer LAN IP, doctor-paired device ID, and one-time device token. Upload the sketch in Arduino IDE and use Serial Monitor at 115200 baud. HTTP 201 indicates the sample was saved. Leave the sensor on a desk and gently tilt the board by hand; do not attach it to a person, implant, or patient. Use fictional demo records only, and do not expose Flask's development server to the Internet.

## API

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Liveness check |
| GET | `/api/public/stats` | Public | Clearly labelled fictional demo aggregate |
| POST | `/api/auth/login` | Public | Supabase Auth email/password login |
| POST | `/api/auth/refresh` | Public | Refresh an expired Supabase session |
| GET | `/api/auth/me` | Signed in | Current Supabase profile |
| PUT | `/api/auth/password` | Signed in | Set a password after accepting an invitation |
| GET | `/api/patients` | Doctor | RLS-protected patient list |
| GET | `/api/patients/<id>` | Doctor or record owner | Patient, weekly demo/research readings, motion samples |
| GET | `/api/me/patient` | Patient | The signed-in patient's linked record |
| POST | `/api/admin/invitations` | Doctor | Invite a patient and link the profile to an existing or newly created patient record |
| POST | `/api/devices` | Doctor | Pair an ESP32 or Arduino device and issue its one-time token |
| POST | `/api/devices/<device_id>/readings` | Paired device token | Persist one ESP32 MPU6050 motion sample |
| POST | `/api/devices/<device_id>/wrist-readings` | Paired device token | Persist a batch of Arduino angle/alarm samples |
| POST | `/api/ai/predict` | Doctor | Run the existing rule-based demo analysis on supplied weekly values |

## Tests

From the repository root:

```powershell
python -m unittest discover -s backend -p "test_*.py"
```

Tests use the local SQLite fallback and do not require a live Supabase connection. The app is not connected to the remote project until the SQL migration is applied and `backend/.env` contains the URL, publishable key and server secret key.

## Current data boundaries

- Supabase stores the fictional patient records and weekly demo readings, Auth profiles, device pairings, all accepted motion samples, and fictional public reviews. Public landing figures are calculated from the database and remain explicitly marked demo data.
- ESP32 measurements are movement/rotation samples only. Do not interpret them as healing, density, load-bearing, or diagnosis.
- Before real patient data or clinical use, the project needs real patient/account management, HTTPS device transport, secret rotation/revocation, audit and retention policies, security review, clinical/engineering validation, ethics approvals, and applicable regulatory review.
