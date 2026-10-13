import { mountLineChart } from "../charts.js";
import { api } from "../api.js";
import {
  LEVEL, describeChange, esc, formatDate, icon, patientMessage, statusChip,
} from "../format.js";

const SERIES_COLORS = { density: "#0094a3", strain: "#b07d1e" };

// ---------- Insight list (also used by the AI assistant) ----------
export function renderInsights(insights, audience = "doctor") {
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

function renderMotionData(motion) {
    const devices = motion.devices.length
      ? `<p class="motion-devices">Paired devices: ${motion.devices.map((device) =>
        `<span>${esc(device.id)} · ${device.sample_count ?? "—"} samples</span>`).join("")}</p>`
      : `<p class="muted">No ESP32 is paired to this patient yet.</p>`;
    if (!motion.readings.length) {
      return `${devices}<p class="empty">No motion readings received yet.</p>`;
    }

    const readings = motion.readings;
    const latest = readings[readings.length - 1];
    const latestDate = new Date(latest.recorded_at).toLocaleString();
    const charts = readings.length > 1
      ? `<div class="motion-charts"><div class="motion-accel-chart"></div><div class="motion-gyro-chart"></div></div>`
      : "";

    return `
      ${devices}
      <div class="motion-summary">
        <div><span>Saved samples</span><strong>${motion.sample_count}</strong></div>
        <div><span>Last received</span><strong>${esc(latestDate)}</strong></div>
      </div>
      ${motion.truncated ? `<p class="field-hint">Showing the latest ${readings.length} readings.</p>` : ""}
      ${charts}
      <details class="table-view">
        <summary>View motion readings</summary>
        <div class="table-wrap">
          <table>
            <caption>MPU6050 measurements. Acceleration includes gravity.</caption>
            <thead><tr><th scope="col">Time</th><th scope="col">Sequence</th><th scope="col">Acceleration (g), x / y / z</th><th scope="col">Gyroscope (°/s), x / y / z</th></tr></thead>
            <tbody>${[...readings].reverse().slice(0, 20).map((reading) => `
              <tr>
                <td>${esc(new Date(reading.recorded_at).toLocaleString())}</td>
                <td>${reading.sequence}</td>
                <td>${reading.accelerometer_g.x.toFixed(3)} / ${reading.accelerometer_g.y.toFixed(3)} / ${reading.accelerometer_g.z.toFixed(3)}</td>
                <td>${reading.gyroscope_dps.x.toFixed(2)} / ${reading.gyroscope_dps.y.toFixed(2)} / ${reading.gyroscope_dps.z.toFixed(2)}</td>
              </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </details>`;
}

function mountMotionCharts(container, readings) {
    const samples = readings.map((reading, index) => ({
      x: index + 1,
      acceleration: Math.hypot(
        reading.accelerometer_g.x,
        reading.accelerometer_g.y,
        reading.accelerometer_g.z,
      ),
      rotation: Math.hypot(
        reading.gyroscope_dps.x,
        reading.gyroscope_dps.y,
        reading.gyroscope_dps.z,
      ),
    }));
    const accelHost = container.querySelector(".motion-accel-chart");
    const gyroHost = container.querySelector(".motion-gyro-chart");
    if (!accelHost || !gyroHost) return;

    mountLineChart(accelHost, {
      title: "Acceleration magnitude",
      subtitle: "Vector magnitude in g, including gravity.",
      ariaLabel: "MPU6050 acceleration magnitude over recent samples.",
      xLabel: "Sample (oldest to newest)",
      series: [{ id: "acceleration", label: "Acceleration", color: "#0094a3", points: samples.map((s) => ({ x: s.x, y: s.acceleration })) }],
      format: (value) => `${value.toFixed(2)} g`,
    });
    mountLineChart(gyroHost, {
      title: "Rotation magnitude",
      subtitle: "Gyroscope vector magnitude in degrees per second.",
      ariaLabel: "MPU6050 rotation magnitude over recent samples.",
      xLabel: "Sample (oldest to newest)",
      series: [{ id: "rotation", label: "Rotation", color: "#b07d1e", points: samples.map((s) => ({ x: s.x, y: s.rotation })) }],
      format: (value) => `${value.toFixed(1)} °/s`,
    });
}

function renderMotion(container, patient, audience) {
    container.innerHTML = `
      <section class="motion-panel" aria-labelledby="motion-title">
        <div class="motion-heading">
          <div>
            <h3 id="motion-title">ESP32 / MPU6050 motion data</h3>
            <p>Prototype movement measurements only. These readings do not measure bone density, fracture healing, or plate strain.</p>
          </div>
        </div>
        <div class="motion-data">${renderMotionData(patient.motion)}</div>
        ${audience === "doctor" ? `
          <form class="device-pair-form">
            <h4>Pair a device to this patient</h4>
            <label for="device-id">Device ID</label>
            <div class="device-pair-row">
              <input id="device-id" name="device_id" value="esp32-${esc(patient.id.toLowerCase())}" maxlength="64" pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,63}" required>
              <button class="btn btn-primary" type="submit">Create pairing token</button>
            </div>
            <p class="field-hint">Save the token shown after pairing; it is only displayed once and must be configured on the ESP32.</p>
            <p class="device-pair-error error-box" role="alert" hidden></p>
            <div class="device-pair-result" aria-live="polite"></div>
          </form>` : ""}
      </section>`;

    if (audience !== "doctor") {
      mountMotionCharts(container, patient.motion.readings);
      return;
    }

    const form = container.querySelector(".device-pair-form");
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button[type=submit]");
      const error = form.querySelector(".device-pair-error");
      const result = form.querySelector(".device-pair-result");
      error.hidden = true;
      result.innerHTML = "";
      button.disabled = true;
      button.textContent = "Creating…";
      try {
        const paired = await api.createDevice(form.elements.device_id.value.trim(), patient.id);
        result.innerHTML = `
          <div class="device-token">
            <p><strong>Device paired.</strong> Copy this token now; the server stores only its hash.</p>
            <p>Device ID: <code>${esc(paired.device.id)}</code></p>
            <label for="device-token">ESP32 token</label>
            <textarea id="device-token" rows="2" readonly></textarea>
            <p class="field-hint">Send readings to <code>POST /api/devices/${esc(paired.device.id)}/readings</code> with header <code>X-Device-Token</code>.</p>
          </div>`;
        result.querySelector("#device-token").value = paired.token;
        const updated = await api.patient(patient.id);
        const data = container.querySelector(".motion-data");
        data.innerHTML = renderMotionData(updated.patient.motion);
        mountMotionCharts(container, updated.patient.motion.readings);
      } catch (problem) {
        error.textContent = problem.message;
        error.hidden = false;
      } finally {
        button.disabled = false;
        button.textContent = "Create pairing token";
      }
    });
    mountMotionCharts(container, patient.motion.readings);
}

// ---------- Public entry ----------
export function renderPatientDetail(container, patient, audience = "doctor") {
  const title = audience === "patient" ? "Your healing progress" : patient.name;
  if (!patient.logs.length) {
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
        </header>
        <p class="empty">This patient record has no weekly readings yet. Recovery charts and analysis will appear after readings are added. No medical readings have been generated for this record.</p>
        <div class="motion-host"></div>
      </div>`;
    renderMotion(container.querySelector(".motion-host"), patient, audience);
    return;
  }
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
      <div class="motion-host"></div>
      <div class="charts">
        <div id="chart-strain"></div>
        <div id="chart-density"></div>
      </div>
      ${renderTable(patient.logs)}
    </div>`;

  renderMotion(container.querySelector(".motion-host"), patient, audience);
  mountCharts(container, patient);
}
