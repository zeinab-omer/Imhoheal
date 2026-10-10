// Shared patient recovery view, used by both the doctor dashboard and the
// patient portal. `audience` ("doctor" | "patient") only changes wording.

import { mountLineChart } from "../charts.js";
import {
  LEVEL, describeChange, esc, formatDate, icon, patientMessage, statusChip,
} from "../format.js";

const SERIES_COLORS = { density: "#0094a3", strain: "#b07d1e" };

// ---------- Insight list (also used by the AI assistant) ----------
export function renderInsights(insights, audience = "doctor") {
  // Patients get one plain-language message per severity level, so repeated
  // findings at the same level do not repeat the same sentence.
  const shownLevels = new Set();
  return `<ul class="insight-list">${insights.map((item) => {
    const level = LEVEL[item.level] || LEVEL.info;
    let text = item.message;
    if (audience === "patient") {
      text = shownLevels.has(item.level) ? "" : patientMessage(item.level);
      shownLevels.add(item.level);
    }
    return `
      <li class="insight insight--${esc(item.level)}">
        ${icon(level.icon, 22)}
        <div>
          <p class="insight-title">${esc(item.title)} <span class="insight-level">${level.label}</span></p>
          ${text ? `<p class="insight-text">${esc(text)}</p>` : ""}
        </div>
      </li>`;
  }).join("")}</ul>`;
}

function renderAlertsCard(analysis, audience) {
  const heading = audience === "patient" ? "Your recovery summary" : "AI smart alerts";
  const sub = audience === "patient"
    ? "Based on your latest weekly reading."
    : `Decision support from ${esc(analysis.forecast.model)}. Not a diagnosis.`;
  return `
    <section class="alert-card" aria-labelledby="alerts-title">
      <div class="alert-head">
        ${icon("wedjat", 40)}
        <div>
          <h3 id="alerts-title">${heading}</h3>
          <p>${sub}</p>
        </div>
      </div>
      ${renderInsights(analysis.insights, audience)}
    </section>`;
}

// ---------- Metrics ----------
function renderMetrics(patient) {
  const { logs, analysis } = patient;
  const latest = logs[logs.length - 1];
  const union = analysis.forecast.estimated_union_week;
  const confidence = Math.round(analysis.forecast.confidence * 100);

  return `
    <div class="metrics">
      <div class="metric">
        <p class="metric-label">Plate strain</p>
        <p class="metric-value">${latest.strain_load}<small>% of limit</small></p>
        <p class="metric-note">${esc(describeChange(logs, "strain_load", "points"))}</p>
      </div>
      <div class="metric">
        <p class="metric-label">Bone density</p>
        <p class="metric-value">${latest.bone_density}<small> mg/cm³</small></p>
        <p class="metric-note">${esc(describeChange(logs, "bone_density", "mg/cm³"))}</p>
      </div>
      <div class="metric">
        <p class="metric-label">Recovery</p>
        <p class="metric-value">Week ${patient.weeks_since_surgery}</p>
        <p class="metric-note">Surgery on ${esc(formatDate(patient.surgery_date))}</p>
      </div>
      <div class="metric">
        <p class="metric-label">Projected union</p>
        <p class="metric-value">${union ? `Week ${union}` : "Not yet"}</p>
        <p class="metric-note">${union ? `AI estimate, ${confidence}% confidence` : "Not reached within 6 weeks"}</p>
      </div>
    </div>`;
}

// ---------- Charts ----------
function mountCharts(container, patient) {
  const { logs, analysis, thresholds } = patient;
  const strainHost = container.querySelector("#chart-strain");
  const densityHost = container.querySelector("#chart-density");

  mountLineChart(strainHost, {
    title: "Plate strain",
    subtitle: "Percent of the plate's design load. Lower means the bone is carrying more.",
    ariaLabel: `Plate strain by week. Latest ${logs[logs.length - 1].strain_load} percent.`,
    series: [{
      id: "strain", label: "Plate strain", color: SERIES_COLORS.strain,
      points: logs.map((l) => ({ x: l.week, y: l.strain_load })),
    }],
    references: [{ y: thresholds.strain_warning_pct, label: `Alert level\n${thresholds.strain_warning_pct}%` }],
    domain: [0, 100],
    format: (v) => `${v}%`,
  });

  const measured = logs.map((l) => ({ x: l.week, y: l.bone_density }));
  const forecast = analysis.forecast.points.map((p) => ({ x: p.week, y: p.bone_density }));

  mountLineChart(densityHost, {
    title: "Bone density",
    subtitle: "mg/cm³ at the fracture site, with the AI forecast.",
    ariaLabel: `Bone density by week. Latest ${logs[logs.length - 1].bone_density} milligrams per cubic centimetre, with a six week forecast.`,
    series: [
      { id: "density", label: "Measured", color: SERIES_COLORS.density, points: measured },
      {
        id: "forecast", label: "AI forecast", color: SERIES_COLORS.density, dashed: true, hollow: true,
        markerStart: 1, points: [measured[measured.length - 1], ...forecast],
      },
    ],
    references: [{ y: thresholds.union_density_target, label: `Union\n${thresholds.union_density_target}` }],
    format: (v) => `${v}`,
  });
}

// ---------- Table alternative to the charts ----------
function renderTable(logs) {
  return `
    <details class="table-view">
      <summary>View weekly readings as a table</summary>
      <div class="table-wrap">
        <table>
          <caption>One reading per week after surgery.</caption>
          <thead><tr><th scope="col">Week</th><th scope="col">Date</th><th scope="col">Plate strain (%)</th><th scope="col">Bone density (mg/cm³)</th></tr></thead>
          <tbody>${logs.map((l) => `
            <tr><th scope="row">${l.week}</th><td>${esc(formatDate(l.date))}</td><td>${l.strain_load}</td><td>${l.bone_density}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </details>`;
}

// ---------- Public entry ----------
export function renderPatientDetail(container, patient, audience = "doctor") {
  const title = audience === "patient" ? "Your healing progress" : patient.name;
  container.innerHTML = `
    <div class="detail">
      <header class="detail-head">
        <div>
          <div class="detail-title">
            <h2>${esc(title)}</h2>
            <span class="cartouche" title="Patient ID">${esc(patient.id)}</span>
          </div>
          <p class="detail-sub">${esc(patient.injury)} · ${esc(patient.implant)} · ${esc(patient.surgeon)}</p>
        </div>
        ${statusChip(patient.analysis.status)}
      </header>
      ${renderAlertsCard(patient.analysis, audience)}
      ${renderMetrics(patient)}
      <div class="charts">
        <div id="chart-strain"></div>
        <div id="chart-density"></div>
      </div>
      ${renderTable(patient.logs)}
    </div>`;

  mountCharts(container, patient);
}
