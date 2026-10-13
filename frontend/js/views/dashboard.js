// Dashboard router: doctors get the full patient list, patients get only their own record.

import { api } from "../api.js";
import { STATUS, esc, firstName, statusChip } from "../format.js";
import { renderPatientDetail } from "./patientDetail.js";

export function renderDashboard(root, ctx) {
  return ctx.session.user.role === "doctor"
    ? renderDoctorDashboard(root, ctx)
    : renderPatientPortal(root, ctx);
}

// ---------- Doctor ----------
async function renderDoctorDashboard(root, ctx, preferredPatientId = null) {
  root.innerHTML = `
    <div class="shell page">
      <header class="page-head">
        <h1>Patient recovery</h1>
        <p>Select a patient to review sensor data, AI findings, and the projected healing path.</p>
      </header>
      <div class="loading">Loading patients…</div>
    </div>`;

  let patients;
  try {
    ({ patients } = await api.patients());
  } catch (error) {
    root.querySelector(".loading").outerHTML = `<p class="error-box" role="alert">${esc(error.message)}</p>`;
    return;
  }

  // Patients that need a clinician's eye come first.
  patients.sort((a, b) => STATUS[a.status].rank - STATUS[b.status].rank || a.name.localeCompare(b.name));

  const needsAttention = patients.filter((p) => p.status === "attention").length;
  const watching = patients.filter((p) => p.status === "watch").length;

  root.querySelector(".loading").outerHTML = `
    <div class="doctor-grid">
      <aside class="patient-list" aria-label="Patients">
        <div class="cohort">
          <strong>${patients.length} patients</strong>
          <p>${needsAttention} need attention, ${watching} to watch closely.</p>
        </div>
        <form class="patient-invite-form">
          <h2>Add or invite a patient</h2>
          <label for="invite-name">Patient name</label>
          <input id="invite-name" name="name" type="text" maxlength="120" required>
          <label for="invite-email">Email address</label>
          <input id="invite-email" name="email" type="email" autocomplete="email" required>
          <label for="record-mode">Patient record</label>
          <select id="record-mode" name="record_mode">
            <option value="existing">Share an existing record</option>
            <option value="new">Create a new record</option>
          </select>
          <div class="existing-patient-fields">
            <p class="field-hint">The invited account will access the same record and readings. No data is copied.</p>
            <label for="invite-patient">Choose patient record to share</label>
            <select id="invite-patient" name="patient_id" required>
            <option value="">Choose a patient record</option>
            ${patients.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.id)})</option>`).join("")}
            </select>
          </div>
          <div class="new-patient-fields" hidden>
            <div class="patient-field-pair">
              <div class="invite-field">
                <label for="patient-age">Age</label>
                <input id="patient-age" name="age" type="number" min="0" max="125" step="1">
              </div>
              <div class="invite-field">
                <label for="patient-sex">Sex</label>
                <select id="patient-sex" name="sex">
                  <option value="">Choose</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
            <div class="invite-field">
              <label for="patient-injury">Injury</label>
              <input id="patient-injury" name="injury" type="text" maxlength="160">
            </div>
            <div class="invite-field">
              <label for="patient-implant">Implant</label>
              <input id="patient-implant" name="implant" type="text" maxlength="120">
            </div>
            <div class="invite-field">
              <label for="surgery-date">Surgery date</label>
              <input id="surgery-date" name="surgery_date" type="date">
            </div>
          </div>
          <p class="invite-message" role="status" aria-live="polite"></p>
          <button class="btn btn-primary btn-small" type="submit">Add patient and send invitation</button>
        </form>
        <ul>
          ${patients.map((p) => `
            <li>
              <button type="button" class="patient-item" data-id="${esc(p.id)}">
                <span class="name">${esc(p.name)}</span>
                <span class="meta">${esc(p.injury)} · Week ${p.weeks_since_surgery}</span>
                ${statusChip(p.status)}
              </button>
            </li>`).join("")}
        </ul>
      </aside>
      <section id="patient-pane" aria-live="polite" aria-label="Selected patient"></section>
    </div>`;

  const pane = root.querySelector("#patient-pane");
  const inviteForm = root.querySelector(".patient-invite-form");
  const recordMode = inviteForm.elements.record_mode;
  const existingFields = inviteForm.querySelector(".existing-patient-fields");
  const newFields = inviteForm.querySelector(".new-patient-fields");
  const existingRecord = inviteForm.elements.patient_id;
  const newRecordFields = [
    inviteForm.elements.age,
    inviteForm.elements.sex,
    inviteForm.elements.injury,
    inviteForm.elements.implant,
    inviteForm.elements.surgery_date,
  ];

  function updateRecordMode() {
    const creating = recordMode.value === "new";
    existingFields.hidden = creating;
    existingRecord.required = !creating;
    existingRecord.disabled = creating;
    newFields.hidden = !creating;
    newRecordFields.forEach((field) => {
      field.required = creating;
      field.disabled = !creating;
    });
    inviteForm.querySelector('button[type="submit"]').textContent = creating
      ? "Create patient and send invitation"
      : "Send invitation";
  }
  recordMode.addEventListener("change", updateRecordMode);
  updateRecordMode();

  inviteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = inviteForm.querySelector("button[type=submit]");
    const message = inviteForm.querySelector(".invite-message");
    button.disabled = true;
    message.className = "invite-message";
    message.textContent = "Sending invitation…";
    try {
      const result = await api.invitePatient(
        {
          email: inviteForm.elements.email.value.trim(),
          name: inviteForm.elements.name.value.trim(),
          record_mode: recordMode.value,
          patient_id: existingRecord.value,
          age: inviteForm.elements.age.value,
          sex: inviteForm.elements.sex.value,
          injury: inviteForm.elements.injury.value.trim(),
          implant: inviteForm.elements.implant.value.trim(),
          surgery_date: inviteForm.elements.surgery_date.value,
        },
      );
      if (result.record_created) {
        await renderDoctorDashboard(root, ctx, result.patient_id);
        return;
      }
      message.textContent = `Invitation sent to ${result.email}.`;
      inviteForm.reset();
      updateRecordMode();
    } catch (error) {
      message.classList.add("invite-error");
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  const buttons = [...root.querySelectorAll(".patient-item")];
  let latestRequest = 0;

  async function select(id) {
    const requestId = ++latestRequest;
    buttons.forEach((b) => b.setAttribute("aria-current", String(b.dataset.id === id)));
    pane.innerHTML = `<div class="loading">Loading patient…</div>`;
    try {
      const { patient } = await api.patient(id);
      if (requestId !== latestRequest) return; // a newer selection won the race
      renderPatientDetail(pane, patient, "doctor");
    } catch (error) {
      if (requestId !== latestRequest) return;
      pane.innerHTML = `<p class="error-box" role="alert">${esc(error.message)}</p>`;
    }
  }

  buttons.forEach((button) => button.addEventListener("click", () => select(button.dataset.id)));
  if (patients.length) select(
    patients.some((patient) => patient.id === preferredPatientId)
      ? preferredPatientId
      : patients[0].id,
  );
  else pane.innerHTML = `<p class="empty">No patients are monitored yet.</p>`;
}

// ---------- Patient ----------
async function renderPatientPortal(root, ctx) {
  const name = firstName(ctx.session.user.name);
  root.innerHTML = `
    <div class="shell page">
      <header class="page-head">
        <h1>Welcome back, ${esc(name)}</h1>
        <p>This page shows your recovery only. Your care team can see it too, and no other patient can.</p>
      </header>
      <div id="patient-pane" aria-live="polite"><div class="loading">Loading your recovery data…</div></div>
    </div>`;

  const pane = root.querySelector("#patient-pane");
  try {
    const { patient } = await api.myPatient();
    renderPatientDetail(pane, patient, "patient");
  } catch (error) {
    pane.innerHTML = `<p class="error-box" role="alert">${esc(error.message)}</p>`;
  }
}
