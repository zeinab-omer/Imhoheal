// AI Diagnostic / Data Testing Assistant (doctors only).
//
// Paste, upload, or preload weekly sensor readings (for example from the
// physical hardware prototype) and the backend returns findings and a
// predicted healing trajectory. The backend endpoint is POST /api/ai/predict.

import { api } from "../api.js";
import { esc, icon, statusChip } from "../format.js";
import { mountLineChart } from "../charts.js";
import { renderInsights } from "./patientDetail.js";

const SAMPLE_CSV = `week,strain_load,bone_density
1,74,182
2,70,196
3,66,212
4,61,231
5,56,252
6,50,274`;

// Accepts CSV (week, strain_load, bone_density) or JSON (a list, or {"readings": [...]}).
function parseReadings(text) {
  const input = text.trim();
  if (!input) throw new Error("Paste or upload at least one weekly reading.");

  if (input.startsWith("[") || input.startsWith("{")) {
    let parsed;
    try {
      parsed = JSON.parse(input);
    } catch {
      throw new Error("That JSON could not be read. Check the commas and quotes.");
    }
    const rows = Array.isArray(parsed) ? parsed : parsed.readings;
    if (!Array.isArray(rows)) throw new Error("JSON must be a list of readings, or an object with a 'readings' list.");
    return rows;
  }

  const rows = [];
  input.split(/\r?\n/).forEach((line, index) => {
    const cells = line.split(/[,;\t]/).map((cell) => cell.trim());
    if (cells.every((cell) => cell === "")) return;
    if (index === 0 && Number.isNaN(Number(cells[0]))) return; // header row
    rows.push({ week: Number(cells[0]), strain_load: Number(cells[1]), bone_density: Number(cells[2]) });
  });
  return rows;
}

function toCsv(logs) {
  return ["week,strain_load,bone_density", ...logs.map((l) => `${l.week},${l.strain_load},${l.bone_density}`)].join("\n");
}

export function renderAssistant(root) {
  root.innerHTML = `
    <div class="shell page">
      <header class="page-head">
        <h1>AI diagnostic assistant</h1>
        <p>Test sensor data from the Emoheal hardware prototype. Send weekly readings and see the AI findings and predicted healing path.</p>
      </header>
      <div class="assistant-grid">
        <section class="panel" aria-labelledby="input-title">
          <h2 id="input-title">Sensor readings</h2>
          <div class="field">
            <label for="readings-input">Weekly readings</label>
            <textarea id="readings-input" rows="11" spellcheck="false" placeholder="week,strain_load,bone_density&#10;1,74,182&#10;2,70,196"></textarea>
            <span class="field-hint">CSV with week, strain load (%), and bone density (mg/cm³). JSON also works.</span>
          </div>
          <div class="panel-actions">
            <button type="button" class="btn btn-ghost btn-small" id="load-sample">Use sample data</button>
            <label class="btn btn-ghost btn-small file-btn">Upload CSV or JSON
              <input type="file" id="file-input" accept=".csv,.json,.txt">
            </label>
          </div>
          <div class="field" id="preload-field" hidden>
            <label for="preload">Or start from a patient's logs</label>
            <select id="preload"><option value="">Choose a patient</option></select>
          </div>
          <button type="button" class="btn btn-primary" id="run" style="width:100%">Predict healing path</button>

          <details class="hardware-note">
            <summary>Connect the hardware prototype</summary>
            <p style="margin-top:.5rem">Have the device, or a script reading its serial output, post readings to the API with a doctor's token:</p>
            <pre><code>curl -X POST /api/ai/predict \\
  -H "Authorization: Bearer &lt;token&gt;" \\
  -H "Content-Type: application/json" \\
  -d '{"readings":[{"week":1,"strain_load":74,"bone_density":182}]}'</code></pre>
          </details>
        </section>

        <section class="panel thread-panel" aria-labelledby="thread-title">
          <h2 id="thread-title">Assistant</h2>
          <div class="thread" id="thread" aria-live="polite"></div>
        </section>
      </div>
    </div>`;

  const input = root.querySelector("#readings-input");
  const thread = root.querySelector("#thread");
  const runButton = root.querySelector("#run");

  const addBubble = (kind, html) => {
    const bubble = document.createElement("div");
    bubble.className = `bubble bubble--${kind}`;
    bubble.innerHTML = kind === "assistant"
      ? `<p class="bubble-author">${icon("wedjat", 22)}Emoheal assistant</p>${html}`
      : html;
    thread.appendChild(bubble);
    bubble.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return bubble;
  };

  addBubble("assistant", `<p>Paste weekly readings from the prototype, or load sample data, and I will estimate the healing path and flag anything unusual.</p>`);

  // ---- input helpers
  root.querySelector("#load-sample").addEventListener("click", () => { input.value = SAMPLE_CSV; input.focus(); });

  root.querySelector("#file-input").addEventListener("change", async (event) => {
    const [file] = event.target.files;
    if (!file) return;
    input.value = await file.text();
    event.target.value = "";
  });

  // Offer to start from an existing patient's logs; hide quietly if the list fails.
  const preload = root.querySelector("#preload");
  api.patients().then(({ patients }) => {
    preload.insertAdjacentHTML("beforeend", patients.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.id)})</option>`).join(""));
    root.querySelector("#preload-field").hidden = false;
  }).catch(() => {});

  preload.addEventListener("change", async () => {
    if (!preload.value) return;
    try {
      const { patient } = await api.patient(preload.value);
      input.value = toCsv(patient.logs);
    } catch (error) {
      addBubble("assistant", `<p class="error-box" role="alert">${esc(error.message)}</p>`);
    }
  });

  // ---- run analysis
  runButton.addEventListener("click", async () => {
    let readings;
    try {
      readings = parseReadings(input.value);
    } catch (error) {
      addBubble("assistant", `<p class="error-box" role="alert">${esc(error.message)}</p>`);
      return;
    }

    const weeks = readings.map((r) => r.week).filter(Number.isFinite);
    const rangeText = weeks.length ? `weeks ${Math.min(...weeks)} to ${Math.max(...weeks)}` : "unlabelled weeks";
    addBubble("user", `<p>Analyse ${readings.length} reading${readings.length === 1 ? "" : "s"} (${rangeText}).</p>`);

    runButton.disabled = true;
    runButton.textContent = "Analysing…";
    try {
      const result = await api.predict(readings);
      renderResult(addBubble, result);
    } catch (error) {
      addBubble("assistant", `<p class="error-box" role="alert">${esc(error.message)}</p>`);
    } finally {
      runButton.disabled = false;
      runButton.textContent = "Predict healing path";
    }
  });
}

function renderResult(addBubble, { readings, analysis, thresholds }) {
  const { forecast } = analysis;
  const union = forecast.estimated_union_week;

  const bubble = addBubble("assistant", `
    <div>${statusChip(analysis.status)}</div>
    <p class="result-facts">
      <span>Projected union: <strong>${union ? `week ${union}` : "not within 6 weeks"}</strong></span>
      <span>Confidence: <strong>${Math.round(forecast.confidence * 100)}%</strong></span>
    </p>
    ${renderInsights(analysis.insights, "doctor")}
    <div class="result-chart"></div>
    <p class="model-note">Model: ${esc(forecast.model)}. Findings are decision support, not a diagnosis.</p>`);

  const measured = readings.map((r) => ({ x: r.week, y: r.bone_density }));
  const projected = forecast.points.map((p) => ({ x: p.week, y: p.bone_density }));

  mountLineChart(bubble.querySelector(".result-chart"), {
    title: "Predicted healing path",
    subtitle: "Bone density in mg/cm³, measured and forecast.",
    ariaLabel: "Bone density by week with a six week forecast.",
    series: [
      { id: "measured", label: "Measured", color: "#0094a3", points: measured },
      { id: "forecast", label: "AI forecast", color: "#0094a3", dashed: true, hollow: true, markerStart: 1, points: [measured[measured.length - 1], ...projected] },
    ],
    references: [{ y: thresholds.union_density_target, label: `Union\n${thresholds.union_density_target}` }],
    format: (v) => `${v}`,
  });
}
