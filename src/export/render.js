// Draws a slide onto a <canvas> straight from its elements, so exports do not depend on CSS.
// Editor controls, selection boxes, presence and speaker notes are never drawn.
import { themeOf, resolveColor } from "../slides/themes.js";
import { legacyToElements } from "../slides/templates.js";
import { SLIDE_W, SLIDE_H } from "../workspace/model.js";
import { chartPrimitives, connectorPrimitives, parseTable, columnShares, withAlpha, TABLE_PAD } from "../slides/vector.js";

export const elementsFor = (slide) => (slide.mode === "free" ? slide.els || [] : legacyToElements(slide).map((e, i) => ({ ...e, z: i + 1 })));

const loadImage = (src) => new Promise((resolve) => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = src;
});

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y); ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr); ctx.closePath();
}

function drawShape(ctx, el, theme, s) {
  const x = el.x * s, y = el.y * s, w = el.w * s, h = el.h * s, sw = (el.sw || 0) * s;
  const fill = resolveColor(el.fill, theme), stroke = resolveColor(el.stroke, theme);
  ctx.save();
  ctx.globalAlpha = el.op ?? 1;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const paint = (strokeToo = true) => { if (fill !== "transparent") { ctx.fillStyle = fill; ctx.fill(); } if (strokeToo && sw && stroke !== "transparent") { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke(); } };
  switch (el.shape) {
    case "ellipse": case "blob":
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, Math.max(0, w / 2 - sw / 2), Math.max(0, h / 2 - sw / 2), 0, 0, Math.PI * 2); paint(); break;
    case "diamond":
      ctx.beginPath(); ctx.moveTo(x + w / 2, y + sw / 2); ctx.lineTo(x + w - sw / 2, y + h / 2); ctx.lineTo(x + w / 2, y + h - sw / 2); ctx.lineTo(x + sw / 2, y + h / 2); ctx.closePath(); paint(); break;
    case "chevron": {
      const nn = Math.min(el.h / 2, el.w * 0.3) * s;
      ctx.beginPath(); ctx.moveTo(x + sw / 2, y + sw / 2); ctx.lineTo(x + w - nn, y + sw / 2); ctx.lineTo(x + w - sw / 2, y + h / 2); ctx.lineTo(x + w - nn, y + h - sw / 2); ctx.lineTo(x + sw / 2, y + h - sw / 2); ctx.lineTo(x + nn, y + h / 2); ctx.closePath(); paint(); break;
    }
    case "round": roundRect(ctx, x + sw / 2, y + sw / 2, w - sw, h - sw, Math.min(w, h) * 0.18); paint(); break;
    case "divider": roundRect(ctx, x, y, w, h, Math.min(w, h) / 2); paint(false); break;
    case "line": case "arrow": {
      const c = resolveColor(el.stroke === "none" ? el.fill : el.stroke, theme);
      const t = (el.sw || 4) * s;
      ctx.strokeStyle = c; ctx.lineWidth = t;
      ctx.beginPath(); ctx.moveTo(x + t, y + h / 2); ctx.lineTo(x + w - t, y + h / 2); ctx.stroke();
      if (el.shape === "arrow") {
        const head = Math.min(h, w * 0.5, 28 * s);
        ctx.beginPath(); ctx.moveTo(x + w - head, y + h / 2 - head / 2); ctx.lineTo(x + w - t, y + h / 2); ctx.lineTo(x + w - head, y + h / 2 + head / 2); ctx.stroke();
      }
      break;
    }
    default: ctx.beginPath(); ctx.rect(x + sw / 2, y + sw / 2, w - sw, h - sw); paint();
  }
  ctx.restore();
}

// Draws the shared chart/connector instructions (see slides/vector.js) at the element's position.
function drawPrims(ctx, prims, ox, oy, s) {
  for (const p of prims) {
    ctx.save();
    if (p.opacity !== undefined) ctx.globalAlpha = p.opacity;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    switch (p.k) {
      case "rect": roundRect(ctx, ox + p.x * s, oy + p.y * s, p.w * s, p.h * s, (p.r || 0) * s); ctx.fillStyle = p.fill; ctx.fill(); break;
      case "line": ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw * s; ctx.beginPath(); ctx.moveTo(ox + p.x1 * s, oy + p.y1 * s); ctx.lineTo(ox + p.x2 * s, oy + p.y2 * s); ctx.stroke(); break;
      case "circle": ctx.beginPath(); ctx.arc(ox + p.cx * s, oy + p.cy * s, p.r * s, 0, Math.PI * 2); ctx.fillStyle = p.fill; ctx.fill(); if (p.stroke && p.sw) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw * s; ctx.stroke(); } break;
      case "wedge": {
        const cx = ox + p.cx * s, cy = oy + p.cy * s;
        ctx.beginPath();
        if (p.r0) { ctx.arc(cx, cy, p.r * s, p.a0, p.a1); ctx.arc(cx, cy, p.r0 * s, p.a1, p.a0, true); }
        else { ctx.moveTo(cx, cy); ctx.arc(cx, cy, p.r * s, p.a0, p.a1); }
        ctx.closePath(); ctx.fillStyle = p.fill; ctx.fill();
        if (p.gap) { ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2 * s; ctx.stroke(); }
        break;
      }
      case "poly": {
        ctx.beginPath();
        p.pts.forEach((q, i) => (i ? ctx.lineTo(ox + q[0] * s, oy + q[1] * s) : ctx.moveTo(ox + q[0] * s, oy + q[1] * s)));
        if (p.close) ctx.closePath();
        if (p.fill) { ctx.fillStyle = p.fill; ctx.fill(); }
        ctx.strokeStyle = p.stroke; ctx.lineWidth = p.sw * s;
        ctx.setLineDash(p.dash ? p.dash.map((d) => d * s) : []);
        ctx.stroke();
        break;
      }
      case "text":
        ctx.font = `${p.bold ? 800 : 500} ${p.size * s}px "Figtree", system-ui, sans-serif`;
        ctx.fillStyle = p.color; ctx.textAlign = p.anchor === "middle" ? "center" : p.anchor === "end" ? "right" : "left"; ctx.textBaseline = "middle";
        ctx.fillText(p.t, ox + p.x * s, oy + p.y * s);
        break;
      default: break;
    }
    ctx.restore();
  }
}

function drawChart(ctx, el, theme, s) { drawPrims(ctx, chartPrimitives(el, theme), el.x * s, el.y * s, s); }
function drawConnector(ctx, el, theme, s) { drawPrims(ctx, connectorPrimitives(el, theme), el.x * s, el.y * s, s); }

// Centered label inside a shape (flowchart boxes etc).
function drawShapeLabel(ctx, el, theme, s) {
  if (!el.text) return;
  const x = el.x * s, y = el.y * s, w = el.w * s, h = el.h * s, size = (el.size || 24) * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.font = `${el.italic ? "italic " : ""}${el.bold ? 800 : 600} ${size}px "${el.font || "Figtree"}", system-ui, sans-serif`;
  ctx.fillStyle = resolveColor(el.color || "paper", theme); ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  const lines = wrap(ctx, el.text, w * 0.84);
  const lineH = size * 1.2;
  let cy = y + (h - lineH * lines.length) / 2;
  for (const ln of lines) { ctx.fillText(ln, x + w / 2, cy + (lineH - size) / 2 + size * 0.82); cy += lineH; }
  ctx.restore();
}

// Tables are drawn cell by cell with the same colours, padding and column shares as the on-screen version.
function drawTable(ctx, el, theme, s) {
  const rows = parseTable(el);
  const cols = rows[0].length;
  const shares = columnShares(el, cols);
  const x = el.x * s, y = el.y * s, w = el.w * s, h = el.h * s;
  const size = (el.size || 18) * s, rowH = h / rows.length;
  const head = el.thead !== false;
  const line = resolveColor(el.bc || "soft", theme);
  const bodyBg = resolveColor(el.bg && el.bg !== "none" ? el.bg : "paper", theme);
  const zebra = withAlpha(resolveColor("soft", theme), 0.45);
  ctx.save();
  roundRect(ctx, x, y, w, h, 8 * s); ctx.clip();
  const padX = TABLE_PAD.x * s, padY = TABLE_PAD.y * s;
  rows.forEach((r, ri) => {
    let cx = x;
    r.forEach((c, ci) => {
      const cw = shares[ci] * w, cy = y + ri * rowH;
      const isHead = head && ri === 0;
      ctx.fillStyle = isHead ? resolveColor(el.fill && el.fill !== "none" ? el.fill : "panel", theme) : bodyBg;
      ctx.fillRect(cx, cy, cw + 0.5, rowH + 0.5);
      if (!isHead && el.tz && (head ? ri : ri + 1) % 2 === 0) { ctx.fillStyle = zebra; ctx.fillRect(cx, cy, cw + 0.5, rowH + 0.5); }
      ctx.save();
      ctx.beginPath(); ctx.rect(cx, cy, cw, rowH); ctx.clip();
      ctx.font = `${isHead ? 800 : 400} ${size}px "${el.font || "Figtree"}", system-ui, sans-serif`;
      ctx.fillStyle = resolveColor(isHead ? el.hc || "paper" : el.color || "ink", theme);
      ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      const lines = wrap(ctx, c, Math.max(4, cw - padX * 2));
      const lineH = size * 1.25;
      let ty = cy + Math.max(padY, (rowH - lineH * lines.length) / 2);
      for (const ln of lines) { ctx.fillText(ln, cx + padX, ty + (lineH - size) / 2 + size * 0.82); ty += lineH; }
      ctx.restore();
      cx += cw;
    });
  });
  ctx.strokeStyle = line; ctx.lineWidth = 1.5 * s;
  let gx = x;
  for (let i = 0; i < cols - 1; i++) { gx += shares[i] * w; ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let i = 1; i < rows.length; i++) { ctx.beginPath(); ctx.moveTo(x, y + i * rowH); ctx.lineTo(x + w, y + i * rowH); ctx.stroke(); }
  ctx.restore();
  roundRect(ctx, x, y, w, h, 8 * s); ctx.strokeStyle = line; ctx.lineWidth = 1.5 * s; ctx.stroke();
}

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of text.split("\n")) {
    if (!para) { out.push(""); continue; }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (ctx.measureText(test).width > maxW && line.trim()) { out.push(line.trimEnd()); line = word.trimStart(); } else line = test;
      // very long words with no spaces: break them
      while (ctx.measureText(line).width > maxW && line.length > 1) {
        let k = line.length - 1;
        while (k > 1 && ctx.measureText(line.slice(0, k)).width > maxW) k--;
        out.push(line.slice(0, k)); line = line.slice(k);
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

function drawText(ctx, el, theme, s) {
  const x = el.x * s, y = el.y * s, w = el.w * s, h = el.h * s;
  const size = (el.size || 28) * s;
  const hasBg = el.bg && el.bg !== "none";
  ctx.save();
  if (hasBg || el.bw) {
    roundRect(ctx, x, y, w, h, hasBg ? 12 * s : 0);
    if (hasBg) { ctx.fillStyle = resolveColor(el.bg, theme); ctx.fill(); }
    if (el.bw) { ctx.strokeStyle = resolveColor(el.bc || "accent", theme); ctx.lineWidth = el.bw * s; ctx.stroke(); }
  }
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const padX = (hasBg ? 14 : 10) * s, padY = (hasBg ? 8 : 6) * s; // keep in step with TEXT_PAD in slides/ElementView.jsx
  ctx.font = `${el.italic ? "italic " : ""}${el.bold ? 800 : 400} ${size}px "${el.font || "Figtree"}", system-ui, sans-serif`;
  ctx.fillStyle = resolveColor(el.color || "ink", theme);
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) ctx.letterSpacing = `${(el.ls || 0) * s}px`;
  const lineH = size * (el.lh || 1.3);
  const listed = el.list === "bullet" || el.list === "number";
  const indent = listed ? size * 1.3 : 0;
  const raw = el.text || "";
  const paras = listed ? raw.split("\n").filter((l) => l.trim()) : raw.split("\n");
  let cy = y + padY;
  let n = 0;
  for (const para of paras) {
    n++;
    const lines = wrap(ctx, para, w - padX * 2 - indent);
    lines.forEach((ln, i) => {
      const base = cy + (lineH - size) / 2 + size * 0.82;
      const width = ctx.measureText(ln).width;
      let tx = x + padX + indent;
      const free = w - padX * 2 - indent - width;
      if (el.align === "center") tx += free / 2; else if (el.align === "right") tx += free;
      if (listed && i === 0) {
        if (el.list === "bullet") { ctx.beginPath(); ctx.arc(x + padX + size * 0.4, base - size * 0.3, size * 0.12, 0, Math.PI * 2); ctx.fill(); }
        else ctx.fillText(`${n}.`, x + padX, base);
      }
      ctx.fillText(ln, tx, base);
      if (el.underline && ln) { ctx.fillRect(tx, base + size * 0.1, width, Math.max(1, size * 0.06)); }
      cy += lineH;
    });
  }
  ctx.restore();
}

async function drawImage(ctx, el, s) {
  if (!el.src) return true;
  const img = await loadImage(el.src);
  if (!img) return false;
  const x = el.x * s, y = el.y * s, w = el.w * s, h = el.h * s;
  const k = (el.fit || "contain") === "cover" ? Math.max(w / img.naturalWidth, h / img.naturalHeight) : Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
  return true;
}

export async function renderSlide(slide, themeId, { width = 1920 } = {}) {
  const t = themeOf(themeId);
  const s = width / SLIDE_W;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width);
  canvas.height = Math.round(SLIDE_H * s);
  const ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, t.bg0); g.addColorStop(1, t.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const els = [...elementsFor(slide)].sort((a, b) => (a.z || 0) - (b.z || 0));
  try {
    const fams = [...new Set(els.filter((e) => e.type === "text" || e.type === "table" || (e.type === "shape" && e.text)).map((e) => e.font || "Figtree"))];
    await Promise.all(fams.flatMap((f) => [document.fonts.load(`400 20px "${f}"`), document.fonts.load(`800 20px "${f}"`)]));
  } catch { /* fonts that cannot load fall back to system fonts */ }
  let skippedImages = 0;
  for (const el of els) {
    if (el.type === "shape") { drawShape(ctx, el, themeId, s); drawShapeLabel(ctx, el, themeId, s); }
    else if (el.type === "chart") drawChart(ctx, el, themeId, s);
    else if (el.type === "table") drawTable(ctx, el, themeId, s);
    else if (el.type === "connector") drawConnector(ctx, el, themeId, s);
    else if (el.type === "text") drawText(ctx, el, themeId, s);
    else if (el.type === "image") { if (!(await drawImage(ctx, el, s))) skippedImages++; }
  }
  return { canvas, skippedImages };
}
