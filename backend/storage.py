import hashlib
import secrets
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from werkzeug.security import check_password_hash, generate_password_hash

from supabase_client import (
    SupabaseError,
    insert_rows,
    is_configured as supabase_is_configured,
    query_rows,
    rpc,
    select_rows,
)


def _connect(database_path):
    path = Path(database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            last_seen_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_devices_patient ON devices(patient_id);
        CREATE TABLE IF NOT EXISTS motion_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
            sequence INTEGER NOT NULL,
            recorded_at TEXT NOT NULL,
            acceleration_x_g REAL NOT NULL,
            acceleration_y_g REAL NOT NULL,
            acceleration_z_g REAL NOT NULL,
            gyroscope_x_dps REAL NOT NULL,
            gyroscope_y_dps REAL NOT NULL,
            gyroscope_z_dps REAL NOT NULL,
            UNIQUE(device_id, sequence)
        );
        CREATE INDEX IF NOT EXISTS idx_motion_device_time
            ON motion_readings(device_id, recorded_at DESC);
        """
    )
    return connection


@contextmanager
def _connection(database_path):
    connection = _connect(database_path)
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def register_device(database_path, device_id, patient_id, token, created_at, access_token=None):
    if supabase_is_configured():
        try:
            insert_rows(
                "devices",
                {
                    "id": device_id,
                    "patient_id": patient_id,
                    "token_hash": hashlib.sha256(token.encode("utf-8")).hexdigest(),
                    "created_at": created_at,
                },
                admin=True,
            )
        except SupabaseError as problem:
            if problem.status == 409:
                raise sqlite3.IntegrityError("Device ID already exists.") from problem
            raise
        return

    with _connection(database_path) as connection:
        connection.execute(
            "INSERT INTO devices (id, patient_id, token_hash, created_at) VALUES (?, ?, ?, ?)",
            (device_id, patient_id, generate_password_hash(token), created_at),
        )


def authenticate_device(database_path, device_id, token):
    if supabase_is_configured():
        rows = select_rows(
            "devices",
            filters={"id": f"eq.{device_id}", "select": "patient_id,token_hash"},
            limit=1,
            admin=True,
        )
        if not rows:
            return None
        expected = hashlib.sha256((token or "").encode("utf-8")).hexdigest()
        if not secrets.compare_digest(rows[0]["token_hash"], expected):
            return None
        return rows[0]["patient_id"]

    with _connection(database_path) as connection:
        row = connection.execute(
            "SELECT patient_id, token_hash FROM devices WHERE id = ?", (device_id,)
        ).fetchone()
    if not row or not check_password_hash(row["token_hash"], token or ""):
        return None
    return row["patient_id"]


def save_motion_reading(database_path, device_id, reading):
    if supabase_is_configured():
        rpc(
            "store_motion_reading",
            {
                "p_device_id": device_id,
                "p_sequence": reading["sequence"],
                "p_recorded_at": reading["recorded_at"],
                "p_acceleration_x_g": reading["accelerometer_g"]["x"],
                "p_acceleration_y_g": reading["accelerometer_g"]["y"],
                "p_acceleration_z_g": reading["accelerometer_g"]["z"],
                "p_gyroscope_x_dps": reading["gyroscope_dps"]["x"],
                "p_gyroscope_y_dps": reading["gyroscope_dps"]["y"],
                "p_gyroscope_z_dps": reading["gyroscope_dps"]["z"],
            },
            admin=True,
        )
        return

    with _connection(database_path) as connection:
        connection.execute(
            """
            INSERT INTO motion_readings (
                device_id, sequence, recorded_at,
                acceleration_x_g, acceleration_y_g, acceleration_z_g,
                gyroscope_x_dps, gyroscope_y_dps, gyroscope_z_dps
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                device_id,
                reading["sequence"],
                reading["recorded_at"],
                reading["accelerometer_g"]["x"],
                reading["accelerometer_g"]["y"],
                reading["accelerometer_g"]["z"],
                reading["gyroscope_dps"]["x"],
                reading["gyroscope_dps"]["y"],
                reading["gyroscope_dps"]["z"],
            ),
        )
        connection.execute(
            "UPDATE devices SET last_seen_at = ? WHERE id = ?",
            (reading["recorded_at"], device_id),
        )


def patient_motion(database_path, patient_id, limit=100, access_token=None):
    if supabase_is_configured():
        devices = query_rows(
            "devices",
            {
                "select": "id,last_seen_at",
                "patient_id": f"eq.{patient_id}",
                "order": "created_at.asc",
            },
            access_token=access_token,
        )
        if not devices:
            return {"devices": [], "sample_count": 0, "readings": [], "truncated": False}

        device_ids = ",".join(device["id"] for device in devices)
        rows = query_rows(
            "motion_readings",
            {
                "select": (
                    "device_id,sequence,recorded_at,acceleration_x_g,acceleration_y_g,"
                    "acceleration_z_g,gyroscope_x_dps,gyroscope_y_dps,gyroscope_z_dps"
                ),
                "device_id": f"in.({device_ids})",
                "order": "recorded_at.desc,sequence.desc",
                "limit": str(limit + 1),
            },
            access_token=access_token,
        )
        truncated = len(rows) > limit
        rows = rows[:limit]
        readings = [
            {
                "device_id": row["device_id"],
                "sequence": row["sequence"],
                "recorded_at": row["recorded_at"],
                "accelerometer_g": {
                    "x": row["acceleration_x_g"],
                    "y": row["acceleration_y_g"],
                    "z": row["acceleration_z_g"],
                },
                "gyroscope_dps": {
                    "x": row["gyroscope_x_dps"],
                    "y": row["gyroscope_y_dps"],
                    "z": row["gyroscope_z_dps"],
                },
            }
            for row in reversed(rows)
        ]
        return {
            "devices": [
                {
                    "id": device["id"],
                    "last_seen_at": device["last_seen_at"],
                    "sample_count": None,
                }
                for device in devices
            ],
            "sample_count": len(rows),
            "readings": readings,
            "truncated": truncated,
        }

    with _connection(database_path) as connection:
        devices = connection.execute(
            """
            SELECT d.id, d.last_seen_at, COUNT(r.id) AS sample_count
            FROM devices d
            LEFT JOIN motion_readings r ON r.device_id = d.id
            WHERE d.patient_id = ?
            GROUP BY d.id
            ORDER BY d.created_at
            """,
            (patient_id,),
        ).fetchall()
        rows = connection.execute(
            """
            SELECT r.device_id, r.sequence, r.recorded_at,
                    r.acceleration_x_g, r.acceleration_y_g, r.acceleration_z_g,
                    r.gyroscope_x_dps, r.gyroscope_y_dps, r.gyroscope_z_dps
            FROM motion_readings r
            JOIN devices d ON d.id = r.device_id
            WHERE d.patient_id = ?
            ORDER BY r.recorded_at DESC, r.id DESC
            LIMIT ?
            """,
            (patient_id, limit),
        ).fetchall()

    readings = [
        {
            "device_id": row["device_id"],
            "sequence": row["sequence"],
            "recorded_at": row["recorded_at"],
            "accelerometer_g": {
                "x": row["acceleration_x_g"],
                "y": row["acceleration_y_g"],
                "z": row["acceleration_z_g"],
            },
            "gyroscope_dps": {
                "x": row["gyroscope_x_dps"],
                "y": row["gyroscope_y_dps"],
                "z": row["gyroscope_z_dps"],
            },
        }
        for row in reversed(rows)
    ]
    total = sum(device["sample_count"] for device in devices)
    return {
        "devices": [dict(device) for device in devices],
        "sample_count": total,
        "readings": readings,
        "truncated": total > limit,
    }
