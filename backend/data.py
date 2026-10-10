"""Mock data for the Emoheal prototype.

Everything here is fictional demo data. Replace this module with a database
layer (SQLAlchemy, PostgreSQL, TimescaleDB, ...) when real sensor data arrives;
the rest of the backend only depends on the functions at the bottom of the file.

Units used throughout:
    strain_load   % of the plate's design load limit (lower = bone is carrying more load)
    bone_density  mg/cm3 (volumetric bone mineral density at the fracture site)
"""

from datetime import date, timedelta

from werkzeug.security import generate_password_hash

# --------------------------------------------------------------------------- #
# Clinical reference values used by the AI layer and the charts
# --------------------------------------------------------------------------- #
STRAIN_WARNING_PCT = 80      # plate strain above this is flagged
UNION_DENSITY_TARGET = 350   # mg/cm3 at which we consider the fracture united

# --------------------------------------------------------------------------- #
# Weekly sensor series per patient (index 0 = week 1 after surgery)
# --------------------------------------------------------------------------- #
_SERIES = {
    # Steady, on-track healing
    "P-1001": {
        "strain": [74, 70, 66, 61, 56, 50, 45, 41, 37, 33],
        "density": [182, 196, 212, 231, 252, 274, 296, 318, 338, 357],
    },
    # Early post-op, too soon to judge
    "P-1002": {
        "strain": [78, 76, 73, 70, 67, 64],
        "density": [175, 183, 194, 205, 218, 230],
    },
    # Abnormal stress spike from week 6 with a stalled density curve
    "P-1003": {
        "strain": [72, 68, 63, 59, 57, 66, 78, 86],
        "density": [190, 203, 219, 232, 238, 239, 236, 233],
    },
    # Excellent recovery, near full union
    "P-1004": {
        "strain": [70, 63, 56, 49, 43, 37, 32, 28, 24, 21, 19, 17],
        "density": [185, 205, 230, 258, 288, 318, 347, 374, 398, 419, 436, 450],
    },
    # Very early, only four readings
    "P-1005": {
        "strain": [80, 79, 77, 75],
        "density": [170, 176, 183, 190],
    },
    # Slow density gain, possible delayed union
    "P-1006": {
        "strain": [76, 75, 74, 73, 72, 71, 70, 70, 69],
        "density": [178, 184, 189, 194, 198, 201, 204, 206, 208],
    },
}

# --------------------------------------------------------------------------- #
# Patient profiles
# --------------------------------------------------------------------------- #
_PROFILES = [
    {"id": "P-1001", "name": "Omar Hassan", "age": 34, "sex": "Male",
     "injury": "Tibial shaft fracture (right)", "implant": "EH-Plate T4, tibia"},
    {"id": "P-1002", "name": "Layla Mahmoud", "age": 28, "sex": "Female",
     "injury": "Distal radius fracture (left)", "implant": "EH-Plate R2, radius"},
    {"id": "P-1003", "name": "Youssef Nabil", "age": 52, "sex": "Male",
     "injury": "Femoral neck fracture (left)", "implant": "EH-Plate F6, femur"},
    {"id": "P-1004", "name": "Nour El-Din", "age": 41, "sex": "Female",
     "injury": "Clavicle fracture (right)", "implant": "EH-Plate C1, clavicle"},
    {"id": "P-1005", "name": "Karim Adel", "age": 19, "sex": "Male",
     "injury": "Humeral shaft fracture (right)", "implant": "EH-Plate H3, humerus"},
    {"id": "P-1006", "name": "Mariam Fathy", "age": 63, "sex": "Female",
     "injury": "Tibial plateau fracture (left)", "implant": "EH-Plate T7, tibia"},
]

SURGEON = "Dr. Amira Khalil"


def _build_patient(profile):
    """Combine a profile with its sensor series into a full patient record."""
    series = _SERIES[profile["id"]]
    weeks = len(series["strain"])
    surgery_date = date.today() - timedelta(weeks=weeks)

    logs = []
    for index, (strain, density) in enumerate(zip(series["strain"], series["density"])):
        week = index + 1
        logs.append({
            "week": week,
            "date": (surgery_date + timedelta(weeks=week)).isoformat(),
            "strain_load": strain,
            "bone_density": density,
        })

    return {
        **profile,
        "surgeon": SURGEON,
        "surgery_date": surgery_date.isoformat(),
        "weeks_since_surgery": weeks,
        "logs": logs,
    }


PATIENTS = {p["id"]: _build_patient(p) for p in _PROFILES}

# --------------------------------------------------------------------------- #
# Demo accounts (passwords are hashed in memory, never stored in plain text
# beyond this demo module). Replace with a real user table before production.
# --------------------------------------------------------------------------- #
DOCTOR_PASSWORD = "emoheal-doctor"
PATIENT_PASSWORD = "emoheal-patient"

USERS = {
    "dr.khalil": {
        "id": "U-1",
        "name": SURGEON,
        "role": "doctor",
        "patient_id": None,
        "password_hash": generate_password_hash(DOCTOR_PASSWORD),
    },
}

for _profile in _PROFILES:
    _username = _profile["name"].lower().replace(" ", ".").replace("-", "")
    USERS[_username] = {
        "id": f"U-{_profile['id']}",
        "name": _profile["name"],
        "role": "patient",
        "patient_id": _profile["id"],
        "password_hash": generate_password_hash(PATIENT_PASSWORD),
    }

# --------------------------------------------------------------------------- #
# Public, non-identifying platform content
# --------------------------------------------------------------------------- #
PUBLIC_REVIEWS = [
    {"author": "Orthopedic surgeon, Cairo",
     "text": "Seeing strain on the plate week by week changed how I decide when to allow weight bearing.",
     "rating": 5},
    {"author": "Physiotherapist, Alexandria",
     "text": "Patients stay motivated when they can see their bone density rising on a chart.",
     "rating": 5},
    {"author": "Patient, Giza",
     "text": "I always knew whether my recovery was on track without waiting for the next appointment.",
     "rating": 4},
]


def get_user(username):
    return USERS.get(username.strip().lower())


def get_patient(patient_id):
    return PATIENTS.get(patient_id)


def list_patients():
    return list(PATIENTS.values())
