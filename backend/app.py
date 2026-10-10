"""Emoheal API server.

Run:  python app.py   ->  http://localhost:5000
The same server also hosts the frontend, so one command runs the whole demo.
"""

import os
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

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app = Flask(__name__, static_folder=None)
app.config["SECRET_KEY"] = os.environ.get("EMOHEAL_SECRET_KEY", "dev-only-change-me")
CORS(app, resources={r"/api/*": {"origins": "*"}})


# --------------------------------------------------------------------------- #
# Serializers
# --------------------------------------------------------------------------- #
def patient_summary(patient):
    """Compact record for the doctor's patient list (no full sensor history)."""
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


def patient_detail(patient):
    """Full record: profile, weekly sensor logs, AI insights and forecast."""
    return {
        **{key: value for key, value in patient.items()},
        "analysis": ai.analyze(patient["logs"]),
        "thresholds": {
            "strain_warning_pct": STRAIN_WARNING_PCT,
            "union_density_target": UNION_DENSITY_TARGET,
        },
    }


# --------------------------------------------------------------------------- #
# Public endpoints
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "emoheal-api"})


@app.get("/api/public/stats")
def public_stats():
    """Aggregate, non-identifying numbers for the public landing section."""
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
    username = str(body.get("username", "")).strip().lower()
    user = authenticate(username, str(body.get("password", "")))
    if not user:
        return error_response("Username or password is incorrect.", 401)
    return jsonify({"token": issue_token(username), "user": public_user(username, user)})


@app.get("/api/auth/me")
@login_required
def me():
    return jsonify({"user": public_user(g.username, g.user)})


# --------------------------------------------------------------------------- #
# Patient data (role-protected)
# --------------------------------------------------------------------------- #
@app.get("/api/patients")
@roles_required("doctor")
def patients():
    """Doctors only: every patient with a one-line AI status."""
    return jsonify({"patients": [patient_summary(p) for p in list_patients()]})


@app.get("/api/patients/<patient_id>")
@login_required
def patient(patient_id):
    """Doctors may open any patient. Patients may open only their own record."""
    if g.user["role"] == "patient" and g.user["patient_id"] != patient_id:
        return error_response("You can only view your own recovery data.", 403)

    record = get_patient(patient_id)
    if not record:
        return error_response("Patient not found.", 404)
    return jsonify({"patient": patient_detail(record)})


@app.get("/api/me/patient")
@roles_required("patient")
def my_patient():
    """Shortcut for the patient portal: the signed-in patient's own record."""
    return jsonify({"patient": patient_detail(get_patient(g.user["patient_id"]))})


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
    app.run(host="127.0.0.1", port=5000, debug=True)
