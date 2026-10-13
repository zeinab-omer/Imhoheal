import json
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import serial
import serial.tools.list_ports

from config import API_BASE_URL, DEVICE_ID, DEVICE_TOKEN, PORT

BAUD = 115200
UPLOAD_INTERVAL_SECONDS = 5
SAMPLE_INTERVAL_SECONDS = 1
MAX_BATCH_SIZE = 100
MAX_PENDING_READINGS = 1000
SEQUENCE_FILE = Path(__file__).with_name("sequence.txt")
PENDING_FILE = Path(__file__).with_name("pending_readings.json")


def find_port():
    if PORT:
        return PORT

    ports = list(serial.tools.list_ports.comports())
    for port in ports:
        description = ((port.description or "") + " " + (port.manufacturer or "")).lower()
        if any(marker in description for marker in (
            "arduino", "ch340", "usb serial", "usb-serial", "wch"
        )):
            return port.device

    if len(ports) == 1:
        return ports[0].device

    available = ", ".join(port.device for port in ports) or "none"
    raise RuntimeError(
        f"Could not identify the Arduino. Available ports: {available}. "
        "Set PORT in config.py."
    )


def next_sequence():
    try:
        sequence = int(SEQUENCE_FILE.read_text(encoding="ascii").strip())
    except FileNotFoundError:
        sequence = 0
    except ValueError as problem:
        raise RuntimeError("sequence.txt is invalid; restore its last numeric sequence.") from problem

    sequence += 1
    temporary_file = SEQUENCE_FILE.with_suffix(".tmp")
    temporary_file.write_text(str(sequence), encoding="ascii")
    temporary_file.replace(SEQUENCE_FILE)
    return sequence


def parse_reading(line):
    parts = line.split(",")
    if len(parts) != 2:
        return None
    try:
        angle_change = float(parts[0])
        alarm_value = float(parts[1])
    except ValueError:
        return None
    if not (-180 <= angle_change <= 180) or alarm_value not in (0.0, 1.0):
        return None

    return {
        "sequence": next_sequence(),
        "recorded_at": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "angle_change": angle_change,
        "alarm": bool(alarm_value),
    }


def save_pending(readings):
    temporary_file = PENDING_FILE.with_suffix(".tmp")
    temporary_file.write_text(
        json.dumps(readings, allow_nan=False),
        encoding="utf-8",
    )
    temporary_file.replace(PENDING_FILE)


def load_pending():
    try:
        readings = json.loads(PENDING_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return []
    except (OSError, json.JSONDecodeError) as problem:
        raise RuntimeError(
            "pending_readings.json could not be read. Preserve the file and inspect it before retrying."
        ) from problem
    if not isinstance(readings, list):
        raise RuntimeError("pending_readings.json must contain a JSON list.")
    return readings


def upload_batch(readings):
    url = (
        f"{API_BASE_URL.rstrip('/')}/api/devices/"
        f"{DEVICE_ID}/wrist-readings"
    )
    request = Request(
        url,
        data=json.dumps({"readings": readings}, allow_nan=False).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "X-Device-Token": DEVICE_TOKEN,
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
            return response.status, payload
    except HTTPError as problem:
        try:
            payload = json.loads(problem.read().decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            payload = {}
        message = payload.get("error", "The server rejected the readings.")
        raise RuntimeError(f"Upload failed ({problem.code}): {message}") from problem
    except (URLError, TimeoutError, OSError) as problem:
        raise RuntimeError(f"Could not reach the ImhoHeal server: {problem}") from problem


def main():
    if not API_BASE_URL.startswith(("http://", "https://")):
        raise RuntimeError("Set API_BASE_URL to the ImhoHeal server in config.py.")
    if not DEVICE_ID or not DEVICE_TOKEN or DEVICE_TOKEN.startswith("PASTE_"):
        raise RuntimeError("Set the paired DEVICE_ID and DEVICE_TOKEN in config.py.")

    port = find_port()
    print(f"Arduino port: {port}")
    print(f"Uploading wrist readings to {API_BASE_URL.rstrip('/')}")
    pending = load_pending()
    if pending:
        print(f"Restored {len(pending)} queued readings from the previous run.")
    serial_port = serial.Serial(port, BAUD, timeout=2)
    time.sleep(2)
    serial_port.reset_input_buffer()

    last_sample_time = 0.0
    last_upload_time = time.monotonic()
    print("Recording at most one sample per second. Press Ctrl+C to stop.")

    try:
        while True:
            line = serial_port.readline().decode("utf-8", errors="ignore").strip()
            now = time.monotonic()
            if line and now - last_sample_time >= SAMPLE_INTERVAL_SECONDS:
                reading = parse_reading(line)
                if reading is not None:
                    pending.append(reading)
                    save_pending(pending)
                    last_sample_time = now
                    state = "Check" if reading["alarm"] else "Normal"
                    print(
                        f"{reading['recorded_at']} | "
                        f"Angle: {reading['angle_change']:.2f}° | {state}"
                    )

            upload_due = now - last_upload_time >= UPLOAD_INTERVAL_SECONDS
            if pending and (upload_due or len(pending) >= MAX_BATCH_SIZE):
                batch = pending[:MAX_BATCH_SIZE]
                try:
                    status, payload = upload_batch(batch)
                    if status != 201 or payload.get("accepted") != len(batch):
                        raise RuntimeError("The server response did not confirm the full batch.")
                    del pending[:len(batch)]
                    save_pending(pending)
                    print(f"Uploaded {len(batch)} readings to Supabase.")
                except RuntimeError as problem:
                    print(problem)
                    if len(pending) >= MAX_PENDING_READINGS:
                        raise RuntimeError(
                            "Upload is unavailable and the in-memory queue is full. "
                            "Stopping to avoid silently discarding readings."
                        ) from problem
                last_upload_time = now

    except KeyboardInterrupt:
        print("\nStopping logger...")
    finally:
        while pending:
            try:
                batch = pending[:MAX_BATCH_SIZE]
                status, payload = upload_batch(batch)
                if status != 201 or payload.get("accepted") != len(batch):
                    raise RuntimeError("The server response did not confirm the full batch.")
                del pending[:len(batch)]
                save_pending(pending)
                print(f"Uploaded {len(batch)} final readings.")
            except RuntimeError as problem:
                print(f"Final upload failed; readings are saved locally: {problem}")
                break
        serial_port.close()
        print("Serial port closed.")


if __name__ == "__main__":
    main()
