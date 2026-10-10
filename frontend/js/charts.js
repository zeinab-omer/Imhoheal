// Dependency-free SVG line chart with a hover crosshair and tooltip.
// The SVG is drawn at the container's real pixel width (and redrawn on resize)
// so axis text stays a readable 12px on every screen.
//
// mountLineChart(host, {
//   title, subtitle, ariaLabel, xLabel,
//   series:     [{ id, label, color, dashed, hollow, markerStart, points: [{x, y}] }],
//   references: [{ y, label }],          // horizontal guide lines, e.g. an alert level
//   domain:     [min, max],              // optional fixed y range
//   format:     (y) => "45%",            // value formatting for ticks and tooltip
// })

import { esc } from "./format.js";

const HEIGHT = 280;
const MARGIN = { top: 16, right: 76, bottom: 44, left: 46 };
const SURFACE = "#fffdf8";
const FALLBACK_WIDTH = 560;
const MIN_WIDTH = 300;

function niceStep(raw) {
  const power = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / power;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

function yScale(values, fixed) {
  let [min, max] = fixed || [Math.min(...values), Math.max(...values)];
  if (min === max) { min -= 1; max += 1; }
  const step = niceStep((max - min) / 4);
  return fixed
    ? { lo: min, hi: max, step }
    : { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step };
}

function range(lo, hi, step) {
  const out = [];
  for (let v = lo; v <= hi + step / 1000; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

export function mountLineChart(host, cfg) {
  let drawnWidth = 0;

  const draw = () => {
    const width = Math.max(MIN_WIDTH, Math.round(host.clientWidth || FALLBACK_WIDTH));
    if (width === drawnWidth) return;
    drawnWidth = width;
    render(host, cfg, width);
  };

  draw();
  if ("ResizeObserver" in window) new ResizeObserver(draw).observe(host);
}

function render(host, cfg, WIDTH) {
  const { series, references = [], format = String } = cfg;
  const innerW = WIDTH - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const allX = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b);
  const allY = [...series.flatMap((s) => s.points.map((p) => p.y)), ...references.map((r) => r.y)];
  const { lo, hi, step } = yScale(allY, cfg.domain);

  let xMin = allX[0];
  let xMax = allX[allX.length - 1];
  if (xMin === xMax) { xMin -= 1; xMax += 1; }

  const px = (x) => MARGIN.left + ((x - xMin) / (xMax - xMin)) * innerW;
  const py = (y) => MARGIN.top + (1 - (y - lo) / (hi - lo)) * innerH;

  // Thin the x ticks when the chart is narrow or the span is long.
  const span = xMax - xMin;
  const maxTicks = Math.max(4, Math.floor(innerW / 34));
  let xStep = 1;
  while (span / xStep > maxTicks) xStep *= span / xStep > maxTicks * 2 ? 4 : 2;
  const xTicks = range(Math.ceil(xMin), Math.floor(xMax), xStep);

  // ---- grid, axes, ticks
  const grid = range(lo, hi, step).map((v) => `
    <line class="grid-line" x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${py(v)}" y2="${py(v)}"/>
    <text class="tick" x="${MARGIN.left - 8}" y="${py(v)}" text-anchor="end" dominant-baseline="middle">${esc(format(v))}</text>`).join("");

  const xAxis = xTicks.map((v) => `
    <text class="tick" x="${px(v)}" y="${HEIGHT - MARGIN.bottom + 18}" text-anchor="middle">${v}</text>`).join("");

  const refs = references.map((ref) => {
    const lines = String(ref.label).split("\n");
    const labelX = WIDTH - MARGIN.right + 8;
    const tspans = lines.map((line, i) => `<tspan x="${labelX}" dy="${i === 0 ? `${-(lines.length - 1) * 0.55}em` : "1.1em"}">${esc(line)}</tspan>`).join("");
    return `
    <line class="ref-line" x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${py(ref.y)}" y2="${py(ref.y)}"/>
    <text class="ref-label" x="${labelX}" y="${py(ref.y)}" dominant-baseline="middle">${tspans}</text>`;
  }).join("");

  // ---- series lines, markers, direct labels
  const drawn = series.map((s) => {
    const path = s.points.map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(1)} ${py(p.y).toFixed(1)}`).join(" ");
    const line = `<path d="${path}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${s.dashed ? ' stroke-dasharray="6 5"' : ""}/>`;
    const markers = s.points.slice(s.markerStart || 0).map((p) => (
      `<circle cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="4" fill="${s.hollow ? SURFACE : s.color}" stroke="${s.hollow ? s.color : SURFACE}" stroke-width="2"/>`
    )).join("");
    let label = "";
    if (series.length >= 2 && s.showLabel !== false) {
      const last = s.points[s.points.length - 1];
      label = `<text class="series-label" x="${(px(last.x) - 8).toFixed(1)}" y="${(py(last.y) - 12).toFixed(1)}" text-anchor="end">${esc(s.label)}</text>`;
    }
    return line + markers + label;
  }).join("");

  const legend = series.length >= 2 ? `<ul class="legend">${series.map((s) => `
    <li><svg width="22" height="10" aria-hidden="true"><line x1="1" x2="21" y1="5" y2="5" stroke="${s.color}" stroke-width="2"${s.dashed ? ' stroke-dasharray="5 4"' : ""}/></svg>${esc(s.label)}</li>`).join("")}</ul>` : "";

  host.innerHTML = `
    <figure class="chart">
      <figcaption>
        <h3>${esc(cfg.title)}</h3>
        ${cfg.subtitle ? `<p>${esc(cfg.subtitle)}</p>` : ""}
      </figcaption>
      ${legend}
      <div class="chart-plot">
        <svg viewBox="0 0 ${WIDTH} ${HEIGHT}" width="100%" role="img" aria-label="${esc(cfg.ariaLabel || cfg.title)}">
          ${grid}
          <line class="axis-line" x1="${MARGIN.left}" x2="${WIDTH - MARGIN.right}" y1="${HEIGHT - MARGIN.bottom}" y2="${HEIGHT - MARGIN.bottom}"/>
          ${xAxis}
          <text class="axis-title" x="${MARGIN.left + innerW / 2}" y="${HEIGHT - 6}" text-anchor="middle">${esc(cfg.xLabel || "Weeks after surgery")}</text>
          ${refs}
          <line class="crosshair" x1="0" x2="0" y1="${MARGIN.top}" y2="${HEIGHT - MARGIN.bottom}" visibility="hidden"/>
          ${drawn}
          <rect class="hit" x="${MARGIN.left}" y="${MARGIN.top}" width="${innerW}" height="${innerH}" fill="transparent"/>
        </svg>
        <div class="chart-tip" hidden></div>
      </div>
    </figure>`;

  attachHover(host, { WIDTH, allX, series, px, format });
}

function attachHover(host, { WIDTH, allX, series, px, format }) {
  const svg = host.querySelector("svg");
  const hit = host.querySelector(".hit");
  const crosshair = host.querySelector(".crosshair");
  const tip = host.querySelector(".chart-tip");
  const plot = host.querySelector(".chart-plot");

  function show(event) {
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * WIDTH;
    const nearest = allX.reduce((best, v) => (Math.abs(px(v) - x) < Math.abs(px(best) - x) ? v : best), allX[0]);

    crosshair.setAttribute("x1", px(nearest));
    crosshair.setAttribute("x2", px(nearest));
    crosshair.setAttribute("visibility", "visible");

    const rows = series.map((s) => {
      const point = s.points.find((p) => p.x === nearest);
      if (!point) return "";
      return `<div class="tip-row"><span class="tip-swatch" style="--c:${s.color}"></span>${esc(s.label)}: ${esc(format(point.y))}</div>`;
    }).join("");

    tip.innerHTML = `<strong>Week ${nearest}</strong>${rows}`;
    tip.hidden = false;

    const left = (px(nearest) / WIDTH) * plot.clientWidth;
    const flip = left > plot.clientWidth * 0.6;
    tip.style.left = flip ? "auto" : `${left + 12}px`;
    tip.style.right = flip ? `${plot.clientWidth - left + 12}px` : "auto";
  }

  function hide() {
    crosshair.setAttribute("visibility", "hidden");
    tip.hidden = true;
  }

  hit.addEventListener("pointermove", show);
  hit.addEventListener("pointerdown", show);
  hit.addEventListener("pointerleave", hide);
}
