// What a workspace is made of, and which values are allowed.
// Everything that arrives from the network passes through sanitizeFields(),
// so a broken or hostile message can never put odd values into the app.

export const KINDS = ["deck", "slide", "task", "resource", "decision", "el"];

export const LAYOUTS = [
  { id: "cover", label: "Cover", hint: "Big title, short subtitle" },
  { id: "bullets", label: "Bullets", hint: "Title and a list. One line = one bullet" },
  { id: "statement", label: "Statement", hint: "One bold sentence" },
  { id: "split", label: "Split", hint: "Title panel beside your text" },
];
export const THEME_IDS = ["rani", "lavender", "mint", "peach"];
export const STATUSES = [
  { id: "todo", label: "To do" },
  { id: "doing", label: "In progress" },
  { id: "done", label: "Done" },
];
export const CATEGORIES = [
  { id: "reference", label: "Reference" },
  { id: "inspiration", label: "Inspiration" },
  { id: "data", label: "Data" },
  { id: "template", label: "Template" },
  { id: "other", label: "Other" },
];

const ids = (list) => list.map((x) => (typeof x === "string" ? x : x.id));

const str = (max) => (v) => (typeof v === "string" ? v.slice(0, max) : undefined);
const oneOf = (list) => (v) => (list.includes(v) ? v : undefined);
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const idOrNull = (v) => (v === null ? null : typeof v === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : undefined);
const dateStr = (v) => (v === "" || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : undefined);

const clamp = (lo, hi) => (v) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v * 10) / 10)) : undefined);
const bool = (v) => (typeof v === "boolean" ? v : undefined);
// Colours are either a theme token (so a theme change recolours the slide) or a hex value.
export const COLOR_TOKENS = ["ink", "accent", "panel", "soft", "paper", "none"];
const color = (v) => (typeof v === "string" && (COLOR_TOKENS.includes(v) || /^#[0-9a-fA-F]{6}$/.test(v)) ? v : undefined);
// Image sources: an https link (CometChat file storage) or a small inline image (dev test mode).
const src = (v) =>
  v === "" ? "" :
  typeof v === "string" && ((/^https:\/\/[^\s"'<>]{4,1500}$/.test(v)) || (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]{20,}$/.test(v) && v.length <= 60000)) ? v : undefined;

export const SLIDE_W = 960;
export const SLIDE_H = 540;
export const FONTS = ["Figtree", "Bricolage Grotesque", "Georgia", "Arial", "Verdana", "Trebuchet MS", "Times New Roman", "Courier New"];
export const SHAPES = ["rect", "round", "ellipse", "line", "arrow", "divider", "blob", "diamond", "chevron"];
export const EL_TYPES = ["text", "shape", "image", "chart", "table", "connector"];
export const CHART_TYPES = ["bar", "line", "pie", "doughnut"];
export const CHART_PALETTES = ["brand", "theme"];
export const ARROW_ENDS = ["none", "arrow", "triangle", "dot"];
export const TABLE_MAX_ROWS = 12;
export const TABLE_MAX_COLS = 8;
export const CELL_MAX = 120;

// Table cells travel as one JSON string (an array of rows, each an array of text cells).
// Anything that is not a tidy rectangle of short strings is rebuilt or rejected.
export function cleanTable(v) {
  if (typeof v !== "string" || v.length > 12000) return undefined;
  let rows;
  try { rows = JSON.parse(v); } catch { return undefined; }
  if (!Array.isArray(rows) || !rows.length) return undefined;
  rows = rows.slice(0, TABLE_MAX_ROWS).map((r) => (Array.isArray(r) ? r : []).slice(0, TABLE_MAX_COLS).map((c) => (typeof c === "string" ? c.slice(0, CELL_MAX) : typeof c === "number" ? String(c) : "")));
  const cols = Math.max(1, ...rows.map((r) => r.length));
  rows = rows.map((r) => [...r, ...Array(cols - r.length).fill("")]);
  return JSON.stringify(rows);
}
// "1,2,1" = relative column widths. Bad values are dropped (columns then share the width equally).
const weights = (v) => {
  if (typeof v !== "string" || v.length > 80) return undefined;
  const n = v.split(",").map(Number);
  return n.length >= 1 && n.length <= TABLE_MAX_COLS && n.every((x) => Number.isFinite(x) && x >= 0.2 && x <= 10) ? n.map((x) => Math.round(x * 100) / 100).join(",") : undefined;
};

const FIELDS = {
  deck: { title: str(200), theme: oneOf(THEME_IDS), transition: oneOf(["none", "fade", "slide", "zoom"]) },
  slide: {
    deckId: idOrNull,
    title: str(300),
    body: str(4000),
    layout: oneOf(ids(LAYOUTS)),
    pos: num,
    // New in the editor upgrade. Old slides have neither and keep working:
    // mode "free" = the slide is made of "el" items; anything else = classic layout.
    mode: oneOf(["legacy", "free"]),
    tpl: str(40),
    notes: str(4000),
  },
  el: {
    slideId: idOrNull,
    type: oneOf(EL_TYPES),
    x: clamp(-200, 950), y: clamp(-200, 530), w: clamp(8, 1200), h: clamp(2, 700),
    z: clamp(0, 9999),
    text: str(4000),
    font: oneOf(FONTS), size: clamp(8, 200), color, bold: bool, italic: bool, underline: bool,
    align: oneOf(["left", "center", "right", "justify"]),
    list: oneOf(["none", "bullet", "number"]),
    lh: clamp(0.8, 3), ls: clamp(-5, 30), bg: color, bc: color, bw: clamp(0, 20),
    shape: oneOf(SHAPES), fill: color, stroke: color, sw: clamp(0, 40), op: clamp(0, 1),
    src, alt: str(300), fit: oneOf(["contain", "cover"]),
    // Charts: data is plain text, one "Label, value" per line, so it can be edited and validated simply.
    ctype: oneOf(CHART_TYPES), ctitle: str(120), cdata: str(2000), cpal: oneOf(CHART_PALETTES), cval: bool,
    // Tables
    tdata: cleanTable, tcw: weights, thead: bool, tz: bool, hc: color,
    // Connectors (lines with arrowheads). flipx/flipy choose which diagonal the line runs along.
    ah: oneOf(ARROW_ENDS), at: oneOf(ARROW_ENDS), flipx: bool, flipy: bool, dash: bool, curve: oneOf(["straight", "elbow"]),
  },
  task: {
    title: str(300),
    status: oneOf(ids(STATUSES)),
    due: dateStr,
    owner: str(120),
    deckId: idOrNull,
  },
  resource: {
    title: str(300),
    url: str(2000),
    category: oneOf(ids(CATEGORIES)),
    deckId: idOrNull,
  },
  decision: { title: str(300), content: str(4000), deckId: idOrNull },
};

export function isValidId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

export function sanitizeFields(kind, fields) {
  const rules = FIELDS[kind];
  const clean = {};
  if (!rules || !fields || typeof fields !== "object") return clean;
  for (const key of Object.keys(rules)) {
    if (key in fields) {
      const value = rules[key](fields[key]);
      if (value !== undefined) clean[key] = value;
    }
  }
  return clean;
}

// Only web links may be opened from Resources (blocks javascript: and friends).
export function isSafeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const fieldNames = (kind) => Object.keys(FIELDS[kind] || {});
