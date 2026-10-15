import math
import os
import re
import secrets
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, g, jsonify, request, send_from_directory
from flask_cors import CORS
import ai
from auth import (
    authenticate,
    error_response,
    issue_token,
    login_required,
    public_user,
    roles_required,
)
from data import (
    PUBLIC_REVIEWS,
    STRAIN_WARNING_PCT,
    UNION_DENSITY_TARGET,
    get_patient,
    get_user,
    list_patients,
)
from storage import (
    authenticate_device,
    patient_motion,
    register_device,
    save_motion_reading,
    save_wrist_readings,
)
from supabase_client import (
    SupabaseError,
    delete_rows,
    get_or_create_profile,
    invite_user,
    insert_rows,
    is_configured as supabase_is_configured,
    query_rows,
    refresh_session,
    select_rows,
    sign_in,
    update_rows,
    update_password,
)

_current_dir = Path(__file__).resolve().parent
if (_current_dir.parent / "frontend").exists():
    FRONTEND_DIR = _current_dir.parent / "frontend"
else:
    FRONTEND_DIR = _current_dir / "frontend"
DEVICE_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


def _load_local_environment():
    environment_file = Path(__file__).resolve().parent / ".env"
    if not environment_file.exists():
        return
    for line in environment_file.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, value = stripped.split("=", 1)
        value = value.strip().strip("\"'")
        os.environ.setdefault(name.strip(), value)


_load_local_environment()

app = Flask(__name__, static_folder=None)
app.config["SECRET_KEY"] = os.environ.get("EMOHEAL_SECRET_KEY", "dev-only-change-me")
app.config["DATABASE_PATH"] = os.environ.get(
    "EMOHEAL_DATABASE_PATH",
    str(Path(__file__).resolve().parent / "instance" / "emoheal.sqlite3"),
)
app.config["MAX_CONTENT_LENGTH"] = 64 * 1024
cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "IMHOHEAL_CORS_ORIGINS",
        "http://localhost:5000,http://127.0.0.1:5000,http://localhost:5500,http://127.0.0.1:5500",
    ).split(",")
    if origin.strip()
]
CORS(app, resources={r"/api/*": {"origins": cors_origins}})


def _patient_from_supabase(patient_id, access_token):
    patients = select_rows(
        "patients",
        filters={"id": f"eq.{patient_id}"},
        limit=1,
        access_token=access_token,
    )
    if not patients:
        return None
    patient = patients[0]
    patient["surgery_date"] = patient["surgery_date"][:10]
    logs = query_rows(
        "weekly_readings",
        {
            "select": "week,recorded_at,strain_load,bone_density",
            "patient_id": f"eq.{patient_id}",
            "order": "week.asc",
        },
        access_token=access_token,
    )
    patient["logs"] = [
        {
            "week": row["week"],
            "date": row["recorded_at"][:10],
            "strain_load": row["strain_load"],
            "bone_density": row["bone_density"],
        }
        for row in logs
    ]
    return patient
def patient_summary(patient):
    """Compact record for the doctor's patient list (no full sensor history)."""
    if not patient["logs"]:
        return {
            **{key: value for key, value in patient.items() if key != "logs"},
            "latest": None,
            "status": "early",
            "headline": "No weekly readings yet",
        }
    analysis = ai.analyze(patient["logs"])
    latest = patient["logs"][-1]
    return {
        "id": patient["id"],
        "name": patient["name"],
        "age": patient["age"],
        "sex": patient["sex"],
        "injury": patient["injury"],
        "implant": patient["implant"],
        "surgery_date": patient["surgery_date"],
        "weeks_since_surgery": patient["weeks_since_surgery"],
        "latest": {
            "strain_load": latest["strain_load"],
            "bone_density": latest["bone_density"],
        },
        "status": analysis["status"],
        "headline": analysis["insights"][0]["title"],
    }


def patient_detail(patient, access_token=None):
    """Full record: profile, weekly sensor logs, AI insights and forecast."""
    detail = {
        **{key: value for key, value in patient.items()},
        "motion": patient_motion(
            app.config["DATABASE_PATH"], patient["id"], access_token=access_token
        ),
        "thresholds": {
            "strain_warning_pct": STRAIN_WARNING_PCT,
            "union_density_target": UNION_DENSITY_TARGET,
        },
    }
    if patient["logs"]:
        detail["analysis"] = ai.analyze(patient["logs"])
    return detail


def _utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _motion_reading(body):
    if not isinstance(body, dict):
        raise ValueError("Send a JSON object.")

    sequence = body.get("sequence")
    if (
        isinstance(sequence, bool)
        or not isinstance(sequence, int)
        or not 1 <= sequence <= 2**63 - 1
    ):
        raise ValueError("'sequence' must be a positive 64-bit integer.")

    recorded_at = body.get("recorded_at")
    if recorded_at is None:
        recorded_at = _utc_now()
    if not isinstance(recorded_at, str):
        raise ValueError("'recorded_at' must be an ISO 8601 timestamp.")
    try:
        parsed_time = datetime.fromisoformat(recorded_at.replace("Z", "+00:00"))
    except ValueError as problem:
        raise ValueError("'recorded_at' must be an ISO 8601 timestamp.") from problem
    if parsed_time.tzinfo is None:
        raise ValueError("'recorded_at' must include a timezone, such as Z.")
    normalized_time = parsed_time.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    clean = {"sequence": sequence, "recorded_at": normalized_time}
    for field, bound in (("accelerometer_g", 16), ("gyroscope_dps", 2000)):
        vector = body.get(field)
        if not isinstance(vector, dict):
            raise ValueError(f"'{field}' must contain numeric x, y and z values.")
        values = {}
        for axis in ("x", "y", "z"):
            value = vector.get(axis)
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"'{field}.{axis}' must be a number.")
            if value < -bound or value > bound or (
                isinstance(value, float) and not math.isfinite(value)
            ):
                raise ValueError(f"'{field}.{axis}' must be between {-bound} and {bound}.")
            values[axis] = float(value)
        clean[field] = values
    return clean


def _wrist_readings(body):
    if not isinstance(body, dict) or not isinstance(body.get("readings"), list):
        raise ValueError("Send a JSON object with a readings list.")
    raw_readings = body["readings"]
    if not raw_readings or len(raw_readings) > 100:
        raise ValueError("Send between 1 and 100 wrist readings per request.")

    clean = []
    sequences = set()
    for index, row in enumerate(raw_readings, start=1):
        if not isinstance(row, dict):
            raise ValueError(f"Reading {index} must be a JSON object.")
        sequence = row.get("sequence")
        if (
            isinstance(sequence, bool)
            or not isinstance(sequence, int)
            or not 1 <= sequence <= 2**63 - 1
        ):
            raise ValueError(f"Reading {index}: sequence must be a positive 64-bit integer.")
        if sequence in sequences:
            raise ValueError("Sequence numbers must be unique within a batch.")
        sequences.add(sequence)

        angle = row.get("angle_change")
        if (
            isinstance(angle, bool)
            or not isinstance(angle, (int, float))
            or not math.isfinite(angle)
            or not -180 <= angle <= 180
        ):
            raise ValueError(f"Reading {index}: angle_change must be between -180 and 180 degrees.")
        alarm = row.get("alarm")
        if not isinstance(alarm, bool):
            raise ValueError(f"Reading {index}: alarm must be true or false.")

        recorded_at = row.get("recorded_at")
        if not isinstance(recorded_at, str):
            raise ValueError(f"Reading {index}: recorded_at must be an ISO 8601 timestamp.")
        try:
            parsed_time = datetime.fromisoformat(recorded_at.replace("Z", "+00:00"))
        except ValueError as problem:
            raise ValueError(
                f"Reading {index}: recorded_at must be an ISO 8601 timestamp."
            ) from problem
        if parsed_time.tzinfo is None:
            raise ValueError(f"Reading {index}: recorded_at must include a timezone.")

        clean.append({
            "sequence": sequence,
            "recorded_at": parsed_time.astimezone(timezone.utc).isoformat(
                timespec="seconds"
            ).replace("+00:00", "Z"),
            "angle_change": float(angle),
            "alarm": alarm,
        })
    return clean


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "emoheal-api"})


@app.get("/api/public/stats")
def public_stats():
    """Aggregate, non-identifying numbers for the public landing section."""
    if supabase_is_configured():
        try:
            with ThreadPoolExecutor(max_workers=3) as executor:
                patients_future = executor.submit(
                    query_rows,
                    "patients",
                    {"select": "id,weeks_since_surgery"},
                    admin=True,
                )
                readings_future = executor.submit(
                    query_rows,
                    "weekly_readings",
                    {
                        "select": "patient_id,week,strain_load,bone_density",
                        "order": "patient_id.asc,week.asc",
                    },
                    admin=True,
                )
                reviews_future = executor.submit(
                    query_rows,
                    "public_reviews",
                    {
                        "select": "author,review_text,rating",
                        "data_source": "eq.demo",
                        "order": "id.asc",
                    },
                )
                patients = patients_future.result()
                readings = readings_future.result()
                reviews = reviews_future.result()
        except SupabaseError as problem:
            return error_response(str(problem), problem.status)

        readings_by_patient = {}
        for reading in readings:
            readings_by_patient.setdefault(reading["patient_id"], []).append(reading)
        statuses = [
            ai.analyze(readings_by_patient[patient["id"]])["status"]
            for patient in patients
            if readings_by_patient.get(patient["id"])
        ]
        on_track = sum(1 for status in statuses if status in ("on_track", "early"))
        average_rating = (
            sum(review["rating"] for review in reviews) / len(reviews) if reviews else 0
        )
        case_count = len(patients)
        return jsonify({
            "demo_data": True,
            "total_monitored_cases": case_count,
            "on_track_percent": round(100 * on_track / len(statuses)) if statuses else 0,
            "average_weeks_monitored": round(
                sum(patient["weeks_since_surgery"] for patient in patients) / case_count, 1
            ) if case_count else 0,
            "average_rating": round(average_rating, 1),
            "reviews": [
                {
                    "author": review["author"],
                    "text": review["review_text"],
                    "rating": review["rating"],
                }
                for review in reviews
            ],
        })

    patients = list_patients()
    statuses = [ai.analyze(p["logs"])["status"] for p in patients]
    on_track = sum(1 for s in statuses if s in ("on_track", "early"))
    average_rating = sum(r["rating"] for r in PUBLIC_REVIEWS) / len(PUBLIC_REVIEWS)

    return jsonify({
        "demo_data": True,
        "total_monitored_cases": len(patients),
        "on_track_percent": round(100 * on_track / len(patients)),
        "average_weeks_monitored": round(
            sum(p["weeks_since_surgery"] for p in patients) / len(patients), 1
        ),
        "average_rating": round(average_rating, 1),
        "reviews": PUBLIC_REVIEWS,
    })


# --------------------------------------------------------------------------- #
# Authentication
# --------------------------------------------------------------------------- #
@app.post("/api/auth/login")
def login():
    body = request.get_json(silent=True) or {}
    if supabase_is_configured():
        if not isinstance(body, dict):
            return error_response("Send a JSON object.", 400)
        email = str(body.get("email", "")).strip().lower()
        password = str(body.get("password", ""))
        if not email or not password:
            return error_response("Enter your email and password.", 400)
        try:
            session = sign_in(email, password)
            profile = get_or_create_profile(session["user"], session["access_token"])
        except SupabaseError as problem:
            return error_response(str(problem), problem.status)
        return jsonify({
            "token": session["access_token"],
            "refresh_token": session["refresh_token"],
            "expires_in": session.get("expires_in"),
            "user": {
                **profile,
                "email": session["user"].get("email", email),
            },
        })

    if not app.config["TESTING"]:
        return error_response(
            "Supabase is not configured. Copy backend/.env.example to backend/.env and add the server key.",
            503,
        )

    username = str(body.get("username", "")).strip().lower()
    user = authenticate(username, str(body.get("password", "")))
    if not user:
        return error_response("Username or password is incorrect.", 401)
    return jsonify({"token": issue_token(username), "user": public_user(username, user)})


@app.post("/api/auth/refresh")
def auth_refresh():
    if not supabase_is_configured():
        return error_response("Session refresh is only available with Supabase Auth.", 404)
    body = request.get_json(silent=True) or {}
    refresh_token = str(body.get("refresh_token", "")).strip()
    if not refresh_token:
        return error_response("A refresh token is required.", 400)
    try:
        session = refresh_session(refresh_token)
        profile = get_or_create_profile(session["user"], session["access_token"])
    except SupabaseError as problem:
        return error_response(str(problem), problem.status)
    return jsonify({
        "token": session["access_token"],
        "refresh_token": session["refresh_token"],
        "expires_in": session.get("expires_in"),
        "user": {
            **profile,
            "email": session["user"].get("email", ""),
        },
    })


@app.put("/api/auth/password")
@login_required
def auth_update_password():
    if not supabase_is_configured():
        return error_response("Password updates require Supabase Auth.", 404)
    body = request.get_json(silent=True) or {}
    password = str(body.get("password", "")) if isinstance(body, dict) else ""
    if len(password) < 8 or len(password) > 128:
        return error_response("Password must be between 8 and 128 characters.", 400)
    try:
        update_password(g.supabase_token, password)
    except SupabaseError as problem:
        return error_response(str(problem), problem.status)
    return jsonify({"updated": True})


@app.get("/api/auth/me")
@login_required
def me():
    user = g.user if supabase_is_configured() else public_user(g.username, g.user)
    return jsonify({"user": user})


# --------------------------------------------------------------------------- #
# Patient data (role-protected)
# --------------------------------------------------------------------------- #
@app.get("/api/patients")
@roles_required("doctor")
def patients():
    """Doctors only: every patient with a one-line AI status."""
    if supabase_is_configured():
        try:
            with ThreadPoolExecutor(max_workers=2) as executor:
                records_future = executor.submit(
                    select_rows,
                    "patients",
                    order="name.asc",
                    access_token=g.supabase_token,
                )
                logs_future = executor.submit(
                    query_rows,
                    "weekly_readings",
                    {
                        "select": "patient_id,week,recorded_at,strain_load,bone_density",
                        "order": "patient_id.asc,week.asc",
                    },
                    access_token=g.supabase_token,
                )
                records = records_future.result()
                all_logs = logs_future.result()
        except SupabaseError as problem:
            return error_response(str(problem), problem.status)

        logs_by_patient = {}
        for row in all_logs:
            logs_by_patient.setdefault(row["patient_id"], []).append(row)

        summaries = []
        for record in records:
            logs = logs_by_patient.get(record["id"], [])
            clean_logs = [
                {
                    "week": row["week"],
                    "date": row["recorded_at"][:10],
                    "strain_load": row["strain_load"],
                    "bone_density": row["bone_density"],
                }
                for row in logs
            ]
            if not clean_logs:
                summaries.append({
                    **record,
                    "latest": None,
                    "status": "early",
                    "headline": "No weekly readings yet",
                })
                continue
            analysis = ai.analyze(clean_logs)
            summaries.append({
                **record,
                "weeks_since_surgery": max(record["weeks_since_surgery"], clean_logs[-1]["week"]),
                "latest": {
                    "strain_load": clean_logs[-1]["strain_load"],
                    "bone_density": clean_logs[-1]["bone_density"],
                },
                "status": analysis["status"],
                "headline": analysis["insights"][0]["title"],
            })
        return jsonify({"patients": summaries})
    return jsonify({"patients": [patient_summary(p) for p in list_patients()]})


@app.get("/api/patients/<patient_id>")
@login_required
def patient(patient_id):
    """Doctors may open any patient. Patients may open only their own record."""
    if g.user["role"] == "patient" and g.user["patient_id"] != patient_id:
        return error_response("You can only view your own recovery data.", 403)

    try:
        record = (
            _patient_from_supabase(patient_id, g.supabase_token)
            if supabase_is_configured()
            else get_patient(patient_id)
        )
    except SupabaseError as problem:
        return error_response(str(problem), problem.status)
    if not record:
        return error_response("Patient not found.", 404)
    if record["logs"]:
        record["weeks_since_surgery"] = max(
            record["weeks_since_surgery"], record["logs"][-1]["week"]
        )
    try:
        detail = patient_detail(record, g.supabase_token if supabase_is_configured() else None)
    except SupabaseError as problem:
        return error_response(str(problem), problem.status)
    return jsonify({"patient": detail})


@app.get("/api/me/patient")
@roles_required("patient")
def my_patient():
    """Shortcut for the patient portal: the signed-in patient's own record."""
    patient_id = g.user["patient_id"]
    try:
        record = (
            _patient_from_supabase(patient_id, g.supabase_token)
            if supabase_is_configured()
            else get_patient(patient_id)
        )
    except SupabaseError as problem:
        return error_response(str(problem), problem.status)
    if not record:
        return error_response("No patient record is linked to this account.", 404)
    if record["logs"]:
        record["weeks_since_surgery"] = max(
            record["weeks_since_surgery"], record["logs"][-1]["week"]
        )
    try:
        detail = patient_detail(record, g.supabase_token if supabase_is_configured() else None)
    except SupabaseError as problem:
        return error_response(str(problem), problem.status)
    return jsonify({"patient": detail})


# --------------------------------------------------------------------------- #
# Device sensor ingestion (ESP32 motion and Arduino wrist-angle samples)
# --------------------------------------------------------------------------- #
@app.post("/api/devices")
@roles_required("doctor")
def create_device():
    """Pair a device to a patient and return its secret token exactly once."""
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return error_response("Send a JSON object.", 400)
    device_id = str(body.get("device_id", "")).strip()
    patient_id = str(body.get("patient_id", "")).strip()
    if not DEVICE_ID_PATTERN.fullmatch(device_id):
        return error_response(
            "Device ID must be 1-64 letters, numbers, dots, dashes or underscores.",
            400,
        )
    if supabase_is_configured():
        try:
            patient_rows = select_rows(
                "patients",
                filters={"id": f"eq.{patient_id}"},
                limit=1,
                access_token=g.supabase_token,
            )
        except SupabaseError as problem:
            return error_response(str(problem), problem.status)
        if not patient_rows:
            return error_response("Patient not found.", 404)
    elif not get_patient(patient_id):
        return error_response("Patient not found.", 404)

    token = secrets.token_urlsafe(32)
    try:
        register_device(
            app.config["DATABASE_PATH"],
            device_id,
            patient_id,
            token,
            _utc_now(),
            access_token=g.supabase_token if supabase_is_configured() else None,
        )
    except sqlite3.IntegrityError:
        return error_response("That device ID is already paired.", 409)
    except SupabaseError as problem:
        return error_response(str(problem), problem.status)
    return jsonify({
        "device": {"id": device_id, "patient_id": patient_id},
        "token": token,
        "message": "Save this token now. It cannot be retrieved later.",
    }), 201


@app.post("/api/devices/<device_id>/readings")
def ingest_motion_reading(device_id):
    """Accept MPU6050 motion data; this is not a bone-density or plate-strain sensor."""
    token = request.headers.get("X-Device-Token", "")
    try:
        patient_id = authenticate_device(app.config["DATABASE_PATH"], device_id, token)
    except SupabaseError as problem:
        return error_response(str(problem), problem.status)
    if not patient_id:
        return error_response("Unknown device or invalid device token.", 401)

    try:
        reading = _motion_reading(request.get_json(silent=True))
    except ValueError as problem:
        return error_response(str(problem), 400)
    try:
        save_motion_reading(app.config["DATABASE_PATH"], device_id, reading)
    except sqlite3.IntegrityError:
        return error_response("This sequence number was already received for the device.", 409)
    except SupabaseError as problem:
        if problem.status == 409:
            return error_response("This sequence number was already received for the device.", 409)
        return error_response(str(problem), problem.status)
    return jsonify({
        "accepted": True,
        "device_id": device_id,
        "patient_id": patient_id,
        "reading": reading,
        "note": "Motion data only; not a measure of bone healing, bone density or plate strain.",
    }), 201


@app.post("/api/devices/<device_id>/wrist-readings")
def ingest_wrist_readings(device_id):
    """Accept Arduino wrist angle and alarm samples through the paired device."""
    token = request.headers.get("X-Device-Token", "")
    try:
        patient_id = authenticate_device(app.config["DATABASE_PATH"], device_id, token)
    except SupabaseError as problem:
        return error_response(str(problem), problem.status)
    if not patient_id:
        return error_response("Unknown device or invalid device token.", 401)

    try:
        readings = _wrist_readings(request.get_json(silent=True))
    except ValueError as problem:
        return error_response(str(problem), 400)
    try:
        save_wrist_readings(app.config["DATABASE_PATH"], device_id, readings)
    except sqlite3.IntegrityError:
        return error_response("A wrist reading sequence was already received for this device.", 409)
    except SupabaseError as problem:
        return error_response(str(problem), problem.status)
    return jsonify({
        "accepted": len(readings),
        "device_id": device_id,
        "patient_id": patient_id,
        "note": "Wrist angle and alarm samples only; not a medical measurement.",
    }), 201


@app.post("/api/admin/invitations")
@roles_required("doctor")
def invite_patient():
    """Invite a patient and link their profile to an existing or newly created record."""
    body = request.get_json(silent=True) or {}
    if not isinstance(body, dict):
        return error_response("Send a JSON object.", 400)
    email = str(body.get("email", "")).strip().lower()
    name = str(body.get("name", "")).strip()
    record_mode = str(body.get("record_mode", "existing")).strip()
    if not email or "@" not in email or len(email) > 254:
        return error_response("Enter a valid email address.", 400)
    if not name or len(name) > 120:
        return error_response("Enter a name up to 120 characters.", 400)
    if record_mode not in ("existing", "new"):
        return error_response("Choose an existing record or create a new one.", 400)

    if supabase_is_configured():
        created_patient_id = None
        patient_created = False
        invitation_sent = False
        try:
            if record_mode == "new":
                raw_age = body.get("age")
                try:
                    age_text = str(raw_age).strip()
                    if not age_text.isdecimal():
                        raise ValueError
                    age = int(age_text)
                    surgery_date = datetime.strptime(
                        str(body.get("surgery_date", "")), "%Y-%m-%d"
                    ).date()
                except (TypeError, ValueError):
                    return error_response("Enter a valid age and surgery date.", 400)
                if isinstance(raw_age, bool) or not 0 <= age <= 125:
                    return error_response("Age must be between 0 and 125.", 400)
                if surgery_date > datetime.now(timezone.utc).date():
                    return error_response("Surgery date cannot be in the future.", 400)
                sex = str(body.get("sex", "")).strip()
                injury = str(body.get("injury", "")).strip()
                implant = str(body.get("implant", "")).strip()
                if sex not in ("Male", "Female", "Other", "Prefer not to say"):
                    return error_response("Choose a valid sex option.", 400)
                if not injury or len(injury) > 160:
                    return error_response("Enter an injury up to 160 characters.", 400)
                if not implant or len(implant) > 120:
                    return error_response("Enter an implant description up to 120 characters.", 400)
                created_patient_id = f"P-{secrets.token_hex(6).upper()}"
                patient_id = created_patient_id
                weeks_since_surgery = max(0, (datetime.now(timezone.utc).date() - surgery_date).days // 7)
                insert_rows(
                    "patients",
                    {
                        "id": patient_id,
                        "name": name,
                        "age": age,
                        "sex": sex,
                        "injury": injury,
                        "implant": implant,
                        "surgeon": g.user["name"],
                        "surgery_date": surgery_date.isoformat(),
                        "weeks_since_surgery": weeks_since_surgery,
                    },
                    admin=True,
                )
                patient_created = True
            else:
                patient_id = str(body.get("patient_id", "")).strip()
                if not patient_id:
                    return error_response("Choose a patient record.", 400)
                patients = select_rows(
                    "patients",
                    filters={"id": f"eq.{patient_id}"},
                    limit=1,
                    access_token=g.supabase_token,
                )
                if not patients:
                    return error_response("Patient record not found.", 404)

            invited_user = invite_user(email, name)
            invitation_sent = True
            profile_id = invited_user["id"]
            updated = update_rows(
                "profiles",
                {"id": f"eq.{profile_id}"},
                {"name": name, "patient_id": patient_id, "role": "patient"},
                admin=True,
            )
        except SupabaseError as problem:
            if patient_created and not invitation_sent:
                try:
                    delete_rows("patients", {"id": f"eq.{created_patient_id}"}, admin=True)
                except SupabaseError as cleanup_problem:
                    return error_response(
                        f"{problem}. The new record {created_patient_id} could not be removed; contact the administrator.",
                        502,
                    )
            if invitation_sent:
                return error_response(
                    f"The invitation was sent, but its profile could not be linked to record {patient_id}. Contact the project administrator. Details: {problem}",
                    502,
                )
            return error_response(str(problem), problem.status)
        if not updated:
            return error_response(
                f"The invitation was sent, but the profile was not linked to record {patient_id}. Contact the project administrator.",
                502,
            )
        return jsonify({
            "invited": True,
            "email": email,
            "patient_id": patient_id,
            "record_created": record_mode == "new",
            "message": "Invitation sent. The patient must set a password using the email link.",
        }), 201

    return error_response("Patient invitations require Supabase Auth configuration.", 503)


# --------------------------------------------------------------------------- #
# AI diagnostic / data testing assistant (doctors only)
# --------------------------------------------------------------------------- #
@app.post("/api/ai/predict")
@roles_required("doctor")
def ai_predict():
    """Analyse sensor readings sent from a hardware prototype or a test file.

    Body: {"readings": [{"week": 1, "strain_load": 74, "bone_density": 182}, ...]}
    """
    body = request.get_json(silent=True) or {}
    try:
        readings = ai.validate_readings(body.get("readings"))
    except ValueError as problem:
        return error_response(str(problem), 400)
    return jsonify({
        "readings": readings,
        "analysis": ai.analyze(readings),
        "thresholds": {
            "strain_warning_pct": STRAIN_WARNING_PCT,
            "union_density_target": UNION_DENSITY_TARGET,
        },
    })


# --------------------------------------------------------------------------- #
# Frontend hosting and JSON error pages
# --------------------------------------------------------------------------- #
@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:asset>")
def frontend_asset(asset):
    if asset.startswith("api/"):
        return error_response("Endpoint not found.", 404)
    return send_from_directory(FRONTEND_DIR, asset)


@app.errorhandler(404)
def not_found(_):
    return error_response("Not found.", 404)


@app.errorhandler(405)
def method_not_allowed(_):
    return error_response("Method not allowed.", 405)


@app.errorhandler(500)
def server_error(_):
    return error_response("Something went wrong on the server.", 500)


if __name__ == "__main__":
    app.run(
        host=os.environ.get("EMOHEAL_HOST", "127.0.0.1"),
        port=int(os.environ.get("EMOHEAL_PORT", "5000")),
        debug=os.environ.get("EMOHEAL_DEBUG", "false").lower() == "true",
    )
