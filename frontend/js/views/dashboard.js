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
async function renderDoctorDashboard(root, ctx) {
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
  if (patients.length) select(patients[0].id);
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
