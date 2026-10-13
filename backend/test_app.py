import json
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

from app import app
from storage import patient_motion


class DeviceApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_database_path = app.config["DATABASE_PATH"]
        app.config.update(
            TESTING=True,
            DATABASE_PATH=str(Path(self.temp_dir.name) / "test.sqlite3"),
        )
        self.supabase_patches = [
            patch("app.supabase_is_configured", return_value=False),
            patch("auth.supabase_is_configured", return_value=False),
            patch("storage.supabase_is_configured", return_value=False),
        ]
        for active_patch in self.supabase_patches:
            active_patch.start()
        self.client = app.test_client()
        response = self.client.post(
            "/api/auth/login",
            json={"username": "dr.khalil", "password": "emoheal-doctor"},
        )
        self.doctor_token = response.get_json()["token"]

    def tearDown(self):
        for active_patch in reversed(self.supabase_patches):
            active_patch.stop()
        app.config["DATABASE_PATH"] = self.original_database_path
        app.config["TESTING"] = False
        self.temp_dir.cleanup()

    def _pair_device(self):
        response = self.client.post(
            "/api/devices",
            headers={"Authorization": f"Bearer {self.doctor_token}"},
            json={"device_id": "esp32-test-01", "patient_id": "P-1001"},
        )
        self.assertEqual(response.status_code, 201)
        return response.get_json()["token"]

    def test_pairing_is_doctor_only_and_token_is_not_readable(self):
        response = self.client.post(
            "/api/devices",
            headers={"Authorization": f"Bearer {self.doctor_token}"},
            json={"device_id": "esp32-test-01", "patient_id": "P-1001"},
        )
        self.assertEqual(response.status_code, 201)
        body = response.get_json()
        self.assertEqual(body["device"]["patient_id"], "P-1001")
        self.assertTrue(body["token"])

        duplicate = self.client.post(
            "/api/devices",
            headers={"Authorization": f"Bearer {self.doctor_token}"},
            json={"device_id": "esp32-test-01", "patient_id": "P-1001"},
        )
        self.assertEqual(duplicate.status_code, 409)

        patient_login = self.client.post(
            "/api/auth/login",
            json={"username": "omar.hassan", "password": "emoheal-patient"},
        ).get_json()
        forbidden = self.client.post(
            "/api/devices",
            headers={"Authorization": f"Bearer {patient_login['token']}"},
            json={"device_id": "esp32-test-02", "patient_id": "P-1001"},
        )
        self.assertEqual(forbidden.status_code, 403)

    def test_ingest_validation_persistence_and_patient_scoping(self):
        device_token = self._pair_device()
        payload = {
            "sequence": 1,
            "recorded_at": "2026-10-12T10:00:00Z",
            "accelerometer_g": {"x": 0.1, "y": -0.2, "z": 0.98},
            "gyroscope_dps": {"x": 1.2, "y": 0.0, "z": -0.5},
        }
        headers = {"X-Device-Token": device_token}

        unauthorized = self.client.post(
            "/api/devices/esp32-test-01/readings", json=payload
        )
        self.assertEqual(unauthorized.status_code, 401)

        accepted = self.client.post(
            "/api/devices/esp32-test-01/readings", headers=headers, json=payload
        )
        self.assertEqual(accepted.status_code, 201)
        self.assertTrue(accepted.get_json()["accepted"])

        duplicate = self.client.post(
            "/api/devices/esp32-test-01/readings", headers=headers, json=payload
        )
        self.assertEqual(duplicate.status_code, 409)

        invalid = {
            **payload,
            "sequence": 2,
            "accelerometer_g": {"x": float("nan"), "y": 0, "z": 1},
        }
        rejected = self.client.post(
            "/api/devices/esp32-test-01/readings", headers=headers, json=invalid
        )
        self.assertEqual(rejected.status_code, 400)

        patient_login = self.client.post(
            "/api/auth/login",
            json={"username": "omar.hassan", "password": "emoheal-patient"},
        ).get_json()
        own_record = self.client.get(
            "/api/me/patient",
            headers={"Authorization": f"Bearer {patient_login['token']}"},
        )
        self.assertEqual(own_record.status_code, 200)
        motion = own_record.get_json()["patient"]["motion"]
        self.assertEqual(motion["sample_count"], 1)
        self.assertEqual(motion["readings"][0]["accelerometer_g"]["z"], 0.98)

        other_login = self.client.post(
            "/api/auth/login",
            json={"username": "layla.mahmoud", "password": "emoheal-patient"},
        ).get_json()
        forbidden = self.client.get(
            "/api/patients/P-1001",
            headers={"Authorization": f"Bearer {other_login['token']}"},
        )
        self.assertEqual(forbidden.status_code, 403)

    def test_ingest_requires_timezone_and_numeric_vectors(self):
        token = self._pair_device()
        payload = {
            "sequence": 1,
            "recorded_at": "2026-10-12T10:00:00",
            "accelerometer_g": {"x": 0, "y": 0, "z": 1},
            "gyroscope_dps": {"x": 0, "y": 0, "z": 0},
        }
        response = self.client.post(
            "/api/devices/esp32-test-01/readings",
            headers={"X-Device-Token": token},
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_arduino_wrist_batch_is_validated_saved_and_readable(self):
        device_token = self._pair_device()
        payload = {
            "readings": [
                {
                    "sequence": 1,
                    "recorded_at": "2026-10-12T10:00:00Z",
                    "angle_change": 1.25,
                    "alarm": False,
                },
                {
                    "sequence": 2,
                    "recorded_at": "2026-10-12T10:00:01Z",
                    "angle_change": 3.5,
                    "alarm": True,
                },
            ],
        }
        headers = {"X-Device-Token": device_token}

        accepted = self.client.post(
            "/api/devices/esp32-test-01/wrist-readings",
            headers=headers,
            json=payload,
        )
        self.assertEqual(accepted.status_code, 201)
        self.assertEqual(accepted.get_json()["accepted"], 2)

        patient_token = self.client.post(
            "/api/auth/login",
            json={"username": "omar.hassan", "password": "emoheal-patient"},
        ).get_json()["token"]
        details = self.client.get(
            "/api/me/patient",
            headers={"Authorization": f"Bearer {patient_token}"},
        )
        self.assertEqual(details.status_code, 200, details.get_json())
        wrist = details.get_json()["patient"]["motion"]["wrist_readings"]
        self.assertEqual([reading["sequence"] for reading in wrist], [1, 2])
        self.assertEqual(wrist[1]["angle_change"], 3.5)
        self.assertTrue(wrist[1]["alarm"])

        duplicate = self.client.post(
            "/api/devices/esp32-test-01/wrist-readings",
            headers=headers,
            json=payload,
        )
        self.assertEqual(duplicate.status_code, 201)
        self.assertEqual(duplicate.get_json()["accepted"], 2)
        self.assertEqual(
            patient_motion(app.config["DATABASE_PATH"], "P-1001")["wrist_sample_count"],
            2,
        )

        invalid = self.client.post(
            "/api/devices/esp32-test-01/wrist-readings",
            headers=headers,
            json={"readings": [{
                "sequence": 3,
                "recorded_at": "2026-10-12T10:00:02",
                "angle_change": 181,
                "alarm": 0,
            }]},
        )
        self.assertEqual(invalid.status_code, 400)

    def test_new_patient_invitation_creates_record_then_links_profile(self):
        with (
            patch("app.supabase_is_configured", return_value=True),
            patch("app.insert_rows") as insert_rows,
            patch("app.invite_user", return_value={"id": "auth-user-1"}),
            patch("app.update_rows", return_value=[{"id": "auth-user-1"}]) as update_rows,
        ):
            response = self.client.post(
                "/api/admin/invitations",
                headers={"Authorization": f"Bearer {self.doctor_token}"},
                json={
                    "record_mode": "new",
                    "name": "New Demo Patient",
                    "email": "patient@example.test",
                    "age": "42",
                    "sex": "Female",
                    "injury": "Demo fracture",
                    "implant": "Demo plate",
                    "surgery_date": "2026-01-01",
                },
            )

        self.assertEqual(response.status_code, 201)
        payload = response.get_json()
        self.assertTrue(payload["record_created"])
        self.assertRegex(payload["patient_id"], r"^P-[A-F0-9]{12}$")
        self.assertEqual(insert_rows.call_args.args[0], "patients")
        self.assertEqual(insert_rows.call_args.kwargs["admin"], True)
        self.assertEqual(update_rows.call_args.args[2]["patient_id"], payload["patient_id"])

    def test_patient_without_weekly_readings_is_still_openable(self):
        patient_record = {
            "id": "P-NEW",
            "name": "New Demo Patient",
            "age": 42,
            "sex": "Female",
            "injury": "Demo fracture",
            "implant": "Demo plate",
            "surgeon": "Dr. Demo",
            "surgery_date": "2026-01-01",
            "weeks_since_surgery": 40,
            "logs": [],
        }
        with patch("app.get_patient", return_value=patient_record):
            response = self.client.get(
                "/api/patients/P-NEW",
                headers={"Authorization": f"Bearer {self.doctor_token}"},
            )

        self.assertEqual(response.status_code, 200)
        patient = response.get_json()["patient"]
        self.assertEqual(patient["logs"], [])
        self.assertNotIn("analysis", patient)

    def test_invitation_can_share_an_existing_patient_record(self):
        patient_row = [{"id": "P-1001"}]
        with (
            patch("app.supabase_is_configured", return_value=True),
            patch("auth.supabase_is_configured", return_value=True),
            patch("auth.authenticated_user", return_value={"id": "doctor-auth-id", "email": "doctor@example.test"}),
            patch("auth.get_or_create_profile", return_value={
                "id": "doctor-auth-id",
                "name": "Dr. Demo",
                "role": "doctor",
                "patient_id": None,
            }),
            patch("app.select_rows", return_value=patient_row),
            patch("app.invite_user", return_value={"id": "second-auth-id"}),
            patch("app.update_rows", return_value=[{"id": "second-auth-id"}]) as update_rows,
            patch("app.insert_rows") as insert_rows,
        ):
            response = self.client.post(
                "/api/admin/invitations",
                headers={"Authorization": "Bearer doctor-token"},
                json={
                    "record_mode": "existing",
                    "name": "Second Demo Account",
                    "email": "second@example.test",
                    "patient_id": "P-1001",
                },
            )

        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.get_json()["record_created"])
        self.assertEqual(response.get_json()["patient_id"], "P-1001")
        self.assertEqual(update_rows.call_args.args[2]["patient_id"], "P-1001")
        insert_rows.assert_not_called()


if __name__ == "__main__":
    unittest.main()
