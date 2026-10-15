// Drawing instructions for charts and connectors, and helpers for tables.
//
// A chart or connector is turned into a short list of simple "primitives" (rectangles, lines,
// text, wedges). The slide on screen draws them as SVG, and the PDF/PNG/ZIP export draws the
// SAME list onto a canvas. One source of truth means what you see is what you export.
// All numbers are canvas units, inside the element's own box (0,0 = its top-left corner).
import { resolveColor } from "./themes.js";
import { TABLE_MAX_ROWS, TABLE_MAX_COLS, CELL_MAX } from "../workspace/model.js";

// ---------------------------------------------------------------- chart data

export const CHART_MAX_ROWS = 12;
export const BRAND_COLORS = ["#e85d9e", "#2bbbad", "#8a6df0", "#ff7a59", "#4aa3e8", "#ffd96a", "#1f9d6b", "#54213b"];
const VALUE_LIMIT = 1e9;

// Text -> rows. One "Label, value" per line. The value is whatever follows the LAST comma,
// so labels may contain commas. Bad lines are kept (so the editor can point at them) but flagged.
export function parseChartData(text) {
  const rows = [];
  const lines = String(text || "").split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, CHART_MAX_ROWS)) {
    const i = line.lastIndexOf(",");
    const label = (i === -1 ? line : line.slice(0, i)).trim().slice(0, 40);
    const raw = i === -1 ? "" : line.slice(i + 1).trim();
    let ok = true, issue = "", value = 0;
    if (raw === "") { ok = false; issue = "needs a number after the comma"; }
    else {
      value = Number(raw.replace(/\s/g, ""));
      if (!Number.isFinite(value)) { ok = false; issue = `"${raw.slice(0, 12)}" is not a number`; value = 0; }
      else if (Math.abs(value) > VALUE_LIMIT) { ok = false; issue = "number is too large"; value = 0; }
    }
    rows.push({ label: label || `Item ${rows.length + 1}`, value, raw, ok, issue });
  }
  return { rows, extra: Math.max(0, lines.length - CHART_MAX_ROWS) };
}

export const serializeChartRows = (rows) => rows.map((r) => `${String(r.label).replace(/\n/g, " ")}, ${r.raw ?? r.value}`).join("\n");

// Plain-English problems with the data, for the inspector. Empty list = all good.
export function chartIssues(el) {
  const { rows, extra } = parseChartData(el.cdata);
  const out = [];
  if (!rows.length) out.push("Add at least one row, like  Sales, 40");
  rows.forEach((r, i) => { if (!r.ok) out.push(`Row ${i + 1} (${r.label}): ${r.issue}. It is skipped.`); });
  if (extra) out.push(`Only the first ${CHART_MAX_ROWS} rows are shown.`);
  const good = rows.filter((r) => r.ok);
  const type = el.ctype || "bar";
  if ((type === "pie" || type === "doughnut") && good.some((r) => r.value < 0)) out.push("Pie charts can't show negative numbers, so those slices are skipped.");
  if ((type === "pie" || type === "doughnut") && good.length && good.every((r) => r.value <= 0)) out.push("Pie charts need at least one number above zero.");
  return out;
}

// ---------------------------------------------------------------- chart drawing

const clip = (s, n) => (s.length > n ? `${s.slice(0, Math.max(1, n - 1))}…` : s);
const fmt = (v) => {
  const a = Math.abs(v);
  if (a >= 1e6) return `${Math.round(v / 1e5) / 10}M`;
  if (a >= 1e4) return `${Math.round(v / 100) / 10}k`;
  return String(Math.round(v * 100) / 100);
};

// A "nice" axis top (1, 2, 2.5, 5 x 10^n) so grid lines land on tidy numbers.
export function niceCeil(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

export function chartPalette(el, theme) {
  if (el.cpal === "theme") return [resolveColor("accent", theme), resolveColor("panel", theme), resolveColor("soft", theme), resolveColor("ink", theme)];
  return BRAND_COLORS;
}

export function chartPrimitives(el, theme) {
  const w = el.w, h = el.h;
  const ink = resolveColor("ink", theme);
  const grid = "rgba(120,100,130,0.22)";
  const pal = chartPalette(el, theme);
  const type = el.ctype || "bar";
  const out = [];
  const titleH = el.ctitle ? Math.min(44, Math.max(26, h * 0.12)) : 0;
  if (el.ctitle) out.push({ k: "text", x: w / 2, y: titleH / 2 + 2, t: clip(el.ctitle, Math.floor(w / 11)), size: Math.min(24, Math.max(14, h * 0.065)), color: ink, anchor: "middle", bold: true });
  const rows = parseChartData(el.cdata).rows.filter((r) => r.ok);
  const body = { x: 8, y: titleH + 6, w: w - 16, h: h - titleH - 12 };

  const empty = () => out.push({ k: "text", x: w / 2, y: h / 2, t: "Add data in the side panel", size: 16, color: ink, anchor: "middle", opacity: 0.6 });

  if (type === "pie" || type === "doughnut") {
    const slices = rows.filter((r) => r.value > 0);
    const total = slices.reduce((a, r) => a + r.value, 0);
    if (!slices.length || total <= 0) { empty(); return out; }
    const legendW = Math.min(body.w * 0.45, 230);
    const pieW = body.w - legendW;
    const r = Math.max(10, Math.min(pieW, body.h) / 2 - 4);
    const cx = body.x + pieW / 2, cy = body.y + body.h / 2;
    const r0 = type === "doughnut" ? r * 0.55 : 0;
    let a = -Math.PI / 2;
    slices.forEach((s, i) => {
      const span = (s.value / total) * Math.PI * 2;
      const col = pal[i % pal.length];
      if (span >= Math.PI * 2 - 1e-6) {
        out.push({ k: "wedge", cx, cy, r, r0, a0: a, a1: a + Math.PI, fill: col });
        out.push({ k: "wedge", cx, cy, r, r0, a0: a + Math.PI, a1: a + Math.PI * 2, fill: col });
      } else out.push({ k: "wedge", cx, cy, r, r0, a0: a, a1: a + span, fill: col, gap: slices.length > 1 });
      a += span;
    });
    const fs = Math.max(11, Math.min(18, body.h / (slices.length + 1) * 0.7));
    const rowH = Math.min(fs * 1.7, body.h / slices.length);
    const top = body.y + (body.h - rowH * slices.length) / 2;
    const lx = body.x + pieW + 8;
    slices.forEach((s, i) => {
      const y = top + i * rowH + rowH / 2;
      out.push({ k: "rect", x: lx, y: y - fs * 0.4, w: fs * 0.8, h: fs * 0.8, fill: pal[i % pal.length], r: 2 });
      const pct = Math.round((s.value / total) * 100);
      out.push({ k: "text", x: lx + fs * 1.1, y, t: clip(`${s.label}${el.cval === false ? "" : `  ${pct}%`}`, Math.max(6, Math.floor((legendW - fs) / (fs * 0.55)))), size: fs, color: ink, anchor: "start" });
    });
    return out;
  }

  // bar and line share the same axes
  if (!rows.length) { empty(); return out; }
  const vals = rows.map((r) => r.value);
  const maxV = Math.max(0, ...vals), minV = Math.min(0, ...vals);
  const top = maxV > 0 ? niceCeil(maxV) : 0;
  const bottom = minV < 0 ? -niceCeil(-minV) : 0;
  const span = top - bottom || 1;
  const labelFs = Math.max(10, Math.min(15, body.w / rows.length / 5.5));
  const axisW = 40;
  const plot = { x: body.x + axisW, y: body.y + 14, w: body.w - axisW - 6, h: body.h - 14 - labelFs * 2.4 };
  const yOf = (v) => plot.y + ((top - v) / span) * plot.h;
  const ticks = 4;
  for (let t = 0; t <= ticks; t++) {
    const v = bottom + (span * t) / ticks;
    const y = yOf(v);
    out.push({ k: "line", x1: plot.x, y1: y, x2: plot.x + plot.w, y2: y, stroke: grid, sw: 1 });
    out.push({ k: "text", x: plot.x - 6, y, t: fmt(v), size: Math.max(10, labelFs - 1), color: ink, anchor: "end", opacity: 0.75 });
  }
  const catW = plot.w / rows.length;
  const zeroY = yOf(0);
  out.push({ k: "line", x1: plot.x, y1: zeroY, x2: plot.x + plot.w, y2: zeroY, stroke: ink, sw: 1.5, opacity: 0.5 });
  const maxChars = Math.max(3, Math.floor(catW / (labelFs * 0.55)));
  const pts = [];
  rows.forEach((r, i) => {
    const cx = plot.x + catW * (i + 0.5);
    const col = el.cpal === "theme" ? pal[0] : pal[i % pal.length];
    if (type === "bar") {
      const bw = Math.min(catW * 0.62, 90);
      const y = yOf(r.value);
      out.push({ k: "rect", x: cx - bw / 2, y: Math.min(y, zeroY), w: bw, h: Math.max(1.5, Math.abs(zeroY - y)), fill: col, r: 4 });
    } else pts.push([cx, yOf(r.value), col]);
    out.push({ k: "text", x: cx, y: plot.y + plot.h + labelFs * 1.3, t: clip(r.label, maxChars), size: labelFs, color: ink, anchor: "middle" });
  });
  if (type === "line") {
    const lc = el.cpal === "theme" ? pal[0] : pal[0];
    out.push({ k: "poly", pts: pts.map((p) => [p[0], p[1]]), stroke: lc, sw: 4 });
    pts.forEach((p) => out.push({ k: "circle", cx: p[0], cy: p[1], r: 5.5, fill: p[2], stroke: "#ffffff", sw: 2 }));
  }
  if (el.cval !== false) {
    rows.forEach((r, i) => {
      const cx = plot.x + catW * (i + 0.5), y = yOf(r.value);
      const above = r.value >= 0;
      out.push({ k: "text", x: cx, y: above ? y - 10 : y + 12, t: fmt(r.value), size: Math.max(10, labelFs), color: ink, anchor: "middle", bold: true });
    });
  }
  return out;
}

// ---------------------------------------------------------------- connectors

// Where the line starts and ends inside its box. Very thin boxes make straight horizontal/vertical lines.
export function connectorPoints(el) {
  const w = el.w, h = el.h;
  const flat = h < 8, tall = w <= 8;
  let x1 = el.flipx ? w : 0, x2 = el.flipx ? 0 : w;
  let y1 = el.flipy ? h : 0, y2 = el.flipy ? 0 : h;
  if (flat) { y1 = y2 = h / 2; }
  if (tall) { x1 = x2 = w / 2; }
  if ((el.curve || "straight") === "elbow" && !flat && !tall) {
    const mx = (x1 + x2) / 2;
    return [[x1, y1], [mx, y1], [mx, y2], [x2, y2]];
  }
  return [[x1, y1], [x2, y2]];
}

function head(kind, tip, from, size, color, sw) {
  if (kind === "none" || !kind) return [];
  const dx = tip[0] - from[0], dy = tip[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len, px = -uy, py = ux;
  if (kind === "dot") return [{ k: "circle", cx: tip[0], cy: tip[1], r: size * 0.38, fill: color }];
  const bx = tip[0] - ux * size, by = tip[1] - uy * size;
  const a = [bx + px * size * 0.5, by + py * size * 0.5], b = [bx - px * size * 0.5, by - py * size * 0.5];
  if (kind === "triangle") return [{ k: "poly", pts: [a, tip, b], fill: color, stroke: color, sw: 1, close: true }];
  return [{ k: "poly", pts: [a, tip, b], stroke: color, sw }];
}

export function connectorPrimitives(el, theme) {
  const color = resolveColor(el.stroke === "none" || !el.stroke ? "ink" : el.stroke, theme);
  const sw = Math.max(1, el.sw || 4);
  const pts = connectorPoints(el);
  const size = Math.max(11, sw * 3.6);
  const out = [{ k: "poly", pts, stroke: color, sw, dash: el.dash ? [sw * 2, sw * 2] : null }];
  const n = pts.length;
  out.push(...head(el.ah ?? "arrow", pts[n - 1], pts[n - 2], size, color, sw));
  out.push(...head(el.at ?? "none", pts[0], pts[1], size, color, sw));
  return out;
}

// ---------------------------------------------------------------- tables

export const defaultTable = () => [["Header", "Header", "Header"], ["", "", ""], ["", "", ""]];

export function parseTable(el) {
  try {
    const rows = JSON.parse(el.tdata || "null");
    if (Array.isArray(rows) && rows.length && Array.isArray(rows[0])) return rows;
  } catch { /* fall through */ }
  return defaultTable();
}
export const serializeTable = (rows) => JSON.stringify(rows);

// Each column's share of the width (adds up to 1). Wrong-length or missing weights = equal columns.
export function columnShares(el, cols) {
  const w = String(el.tcw || "").split(",").map(Number);
  const ok = w.length === cols && w.every((x) => Number.isFinite(x) && x > 0);
  const list = ok ? w : Array(cols).fill(1);
  const sum = list.reduce((a, b) => a + b, 0);
  return list.map((x) => x / sum);
}

export const TABLE_PAD = { x: 10, y: 6 };

// How many cells have more text than fits? (An estimate: ~0.52 em per character.)
export function tableOverflow(el) {
  const rows = parseTable(el);
  const cols = rows[0].length;
  const shares = columnShares(el, cols);
  const size = el.size || 18;
  const rowH = el.h / rows.length;
  let bad = 0;
  rows.forEach((r, ri) => r.forEach((c, ci) => {
    if (!c) return;
    const width = Math.max(20, shares[ci] * el.w - TABLE_PAD.x * 2);
    const lines = Math.max(1, Math.ceil((c.length * size * 0.52) / width));
    if (lines * size * 1.25 > rowH - TABLE_PAD.y * 2 + 1) bad++;
    void ri;
  }));
  return bad;
}

export function withAlpha(color, a) {
  const m = /^#([0-9a-f]{6})$/i.exec(color || "");
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const tableLimits = { rows: TABLE_MAX_ROWS, cols: TABLE_MAX_COLS, cell: CELL_MAX };
