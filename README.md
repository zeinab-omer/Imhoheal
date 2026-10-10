# Emoheal

Web dashboard prototype for **Emoheal**, an AI-integrated smart orthopedic plate that tracks healing through strain load and bone density. Flask backend, plain HTML/CSS/JS frontend, no build step.

All patient data is fictional, and the AI is a transparent rule-based placeholder. Not for clinical use.

## Run it locally

You need Python 3.9 or newer.

```bash
cd emoheal/backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5000**. Flask serves the API and the frontend, so there is nothing else to start.

If you would rather serve `frontend/` from another server (VS Code Live Server, `python -m http.server`), set `window.EMOHEAL_API_BASE = "http://127.0.0.1:5000"` in `frontend/js/config.js`. The frontend uses ES modules, so opening `index.html` straight from disk (`file://`) will not work.

## Demo accounts

| Role | Username | Password | Sees |
|---|---|---|---|
| Doctor | `dr.khalil` | `emoheal-doctor` | All patients, AI assistant |
| Patient | `omar.hassan` | `emoheal-patient` | Only their own record |
| Patient | `youssef.nabil` | `emoheal-patient` | Only their own record (has an abnormal stress alert) |

Other patients follow the same pattern: `layla.mahmoud`, `nour.eldin`, `karim.adel`, `mariam.fathy`.

## Project layout

```
emoheal/
├── backend/
│   ├── app.py            Flask routes, serializers, static hosting
│   ├── auth.py           Signed tokens, login_required, roles_required
│   ├── ai.py             Rule-based findings and forecast (swap in a real model here)
│   ├── data.py           Mock patients, sensor logs, demo accounts, reviews
│   └── requirements.txt
└── frontend/
    ├── index.html        Shell, icon sprite, header
    ├── css/styles.css    Design tokens and all styles
    └── js/
        ├── config.js     API base URL
        ├── api.js        fetch wrapper and session storage
        ├── app.js        Hash router, role guards, header
        ├── charts.js     Dependency-free SVG line chart with hover tooltip
        ├── format.js     Escaping, icons, labels, date formatting
        └── views/        home, login, dashboard, patientDetail, assistant
```

## API

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Liveness check |
| GET | `/api/public/stats` | Public | Aggregate platform figures and reviews |
| POST | `/api/auth/login` | Public | `{username, password}` returns `{token, user}` |
| GET | `/api/auth/me` | Signed in | Current user |
| GET | `/api/patients` | Doctor | All patients with AI status |
| GET | `/api/patients/<id>` | Doctor, or the patient who owns it | Full record, sensor logs, AI analysis |
| GET | `/api/me/patient` | Patient | The signed-in patient's own record |
| POST | `/api/ai/predict` | Doctor | Analyse `{readings: [{week, strain_load, bone_density}]}` |

Send the token as `Authorization: Bearer <token>`. A patient requesting another patient's record gets `403`, and the patient list is not available to patient accounts at all.

### Testing hardware data

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"dr.khalil","password":"emoheal-doctor"}' | python -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -X POST http://127.0.0.1:5000/api/ai/predict \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"readings":[{"week":1,"strain_load":74,"bone_density":182},{"week":2,"strain_load":70,"bone_density":196},{"week":3,"strain_load":66,"bone_density":212}]}'
```

The same data can be pasted or uploaded in the **AI assistant** page (CSV or JSON).

## Where to extend

- **Real AI model:** replace the internals of `forecast_density` and `_build_insights` in `backend/ai.py`. Keep `validate_readings` and `analyze` so the API and UI do not change.
- **Database:** `backend/data.py` is the only module that holds data. Replace its functions (`get_patient`, `list_patients`, `get_user`) with database queries.
- **Live hardware:** add an ingest endpoint (for example `POST /api/devices/<id>/readings`) that stores readings, then let `GET /api/patients/<id>` read them back.
- **New role** (for example `developer`): add it to `USERS` in `data.py`, then allow it in `roles_required(...)` for the routes it needs.

## Before using real patient data

This prototype is built for demos. For anything real you would need, at minimum: a managed identity provider instead of the demo accounts, HTTPS, login rate limiting, a secret key from `EMOHEAL_SECRET_KEY` (not the default), a restricted CORS origin list in `app.py`, audit logging of record access, and the regulatory and privacy review that medical software requires.
