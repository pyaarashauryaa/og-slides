// Starting points for the new element types, and the small pure helpers that edit them.
// (Pure = no React and no network, so they are covered by automated tests.)
import { TABLE_MAX_ROWS, TABLE_MAX_COLS, CELL_MAX } from "../workspace/model.js";
import { parseTable, defaultTable, serializeTable, columnShares } from "./vector.js";

export const CHART_SPECS = {
  bar: { label: "Bar chart", spec: { type: "chart", ctype: "bar", ctitle: "Revenue by quarter", cdata: "Q1, 12\nQ2, 19\nQ3, 27\nQ4, 41", cpal: "brand", cval: true, x: 180, y: 110, w: 600, h: 340 } },
  line: { label: "Line chart", spec: { type: "chart", ctype: "line", ctitle: "Users over time", cdata: "Jan, 120\nFeb, 180\nMar, 260\nApr, 410\nMay, 640", cpal: "brand", cval: true, x: 180, y: 110, w: 600, h: 340 } },
  pie: { label: "Pie chart", spec: { type: "chart", ctype: "pie", ctitle: "Where the money goes", cdata: "Product, 45\nMarketing, 25\nTeam, 20\nOther, 10", cpal: "brand", cval: true, x: 180, y: 110, w: 600, h: 340 } },
  doughnut: { label: "Doughnut chart", spec: { type: "chart", ctype: "doughnut", ctitle: "Market share", cdata: "Us, 38\nRival A, 30\nRival B, 20\nOthers, 12", cpal: "brand", cval: true, x: 180, y: 110, w: 600, h: 340 } },
};

export const TABLE_SPEC = {
  type: "table", x: 130, y: 130, w: 700, h: 240, size: 20,
  tdata: serializeTable([["Feature", "Free", "Pro"], ["Seats", "3", "Unlimited"], ["Support", "Email", "Priority"], ["Price", "$0", "$12"]]),
  tcw: "1.4,1,1", thead: true, tz: true, fill: "panel", hc: "paper", color: "ink", bg: "paper", bc: "soft",
};

export const CONNECTOR_SPECS = {
  arrow: { label: "Arrow", spec: { type: "connector", x: 300, y: 270, w: 300, h: 2, stroke: "ink", sw: 4, ah: "arrow", at: "none", curve: "straight" } },
  elbow: { label: "Elbow connector", spec: { type: "connector", x: 300, y: 200, w: 260, h: 130, stroke: "ink", sw: 4, ah: "arrow", at: "none", curve: "elbow" } },
  both: { label: "Two-way arrow", spec: { type: "connector", x: 300, y: 270, w: 300, h: 2, stroke: "accent", sw: 4, ah: "arrow", at: "arrow", curve: "straight" } },
  dashed: { label: "Dashed line", spec: { type: "connector", x: 300, y: 270, w: 300, h: 2, stroke: "ink", sw: 3, ah: "none", at: "none", dash: true, curve: "straight" } },
  dot: { label: "Line with dots", spec: { type: "connector", x: 300, y: 270, w: 300, h: 2, stroke: "panel", sw: 4, ah: "dot", at: "dot", curve: "straight" } },
};

// ---------- tables ----------
const equal = (n) => Array(n).fill(1).join(",");
const rowHeight = (el, rows) => el.h / rows;

export function tableSetCell(el, r, c, value) {
  const rows = parseTable(el).map((x) => [...x]);
  if (!rows[r] || c < 0 || c >= rows[r].length) return {};
  rows[r][c] = String(value).slice(0, CELL_MAX);
  return { tdata: serializeTable(rows) };
}
export function tableAddRow(el) {
  const rows = parseTable(el);
  if (rows.length >= TABLE_MAX_ROWS) return {};
  const cols = rows[0].length;
  return { tdata: serializeTable([...rows, Array(cols).fill("")]), h: Math.min(520, Math.round(el.h + rowHeight(el, rows.length))) };
}
export function tableRemoveRow(el, r) {
  const rows = parseTable(el);
  if (rows.length <= 1 || r < 0 || r >= rows.length) return {};
  const keep = rows.filter((_, i) => i !== r);
  return { tdata: serializeTable(keep), h: Math.max(40, Math.round(el.h - rowHeight(el, rows.length))) };
}
export function tableAddCol(el) {
  const rows = parseTable(el);
  const cols = rows[0].length;
  if (cols >= TABLE_MAX_COLS) return {};
  return { tdata: serializeTable(rows.map((r, i) => [...r, i === 0 ? "Header" : ""])), tcw: equal(cols + 1) };
}
export function tableRemoveCol(el, c) {
  const rows = parseTable(el);
  const cols = rows[0].length;
  if (cols <= 1 || c < 0 || c >= cols) return {};
  return { tdata: serializeTable(rows.map((r) => r.filter((_, i) => i !== c))), tcw: equal(cols - 1) };
}
// Sets one column's relative width (0.4 - 4), the others keep theirs.
export function tableSetColWidth(el, c, weight) {
  const cols = parseTable(el)[0].length;
  const shares = columnShares(el, cols).map((s) => s * cols); // back to weights around 1
  if (c < 0 || c >= cols) return {};
  shares[c] = Math.min(4, Math.max(0.4, weight));
  return { tcw: shares.map((x) => Math.round(x * 100) / 100).join(",") };
}
export const freshTable = () => serializeTable(defaultTable());

// ---------- aligning one element to the slide ----------
export function alignPatch(el, how, W = 960, H = 540) {
  switch (how) {
    case "left": return { x: 0 };
    case "center": return { x: Math.round((W - el.w) / 2) };
    case "right": return { x: Math.round(W - el.w) };
    case "top": return { y: 0 };
    case "middle": return { y: Math.round((H - el.h) / 2) };
    case "bottom": return { y: Math.round(H - el.h) };
    default: return {};
  }
}
