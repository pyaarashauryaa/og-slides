import { useEffect, useRef, useState } from "react";
import { themeOf } from "./themes.js";
import ElementBody, { boxStyle, textStyle } from "./ElementView.jsx";
import { useDraft } from "./useDraft.js";
import { SLIDE_W, SLIDE_H } from "../workspace/model.js";
import { clampBox } from "./editorOps.js";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const SNAP = 6;

// While typing in a text box on the canvas.
function InlineText({ el, theme, onCommit, onDone }) {
  const d = useDraft(el.text || "", onCommit, false, 500);
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); ref.current?.setSelectionRange?.(9999, 9999); }, []);
  return (
    <textarea
      ref={ref}
      className="el__edit"
      style={textStyle(el, theme)}
      value={d.value}
      aria-label="Edit text"
      onChange={(e) => d.onChange(e.target.value)}
      onBlur={() => { d.flush(); onDone(); }}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") { d.flush(); onDone(); } }}
      onPointerDown={(e) => e.stopPropagation()}
    />
  );
}

function snapBox(box, others, mode) {
  const xs = [0, SLIDE_W / 2, SLIDE_W], ys = [0, SLIDE_H / 2, SLIDE_H];
  for (const o of others) { xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h); }
  const guides = { v: [], h: [] };
  let { x, y } = box;
  if (mode === "move") {
    let best = null;
    for (const t of xs) for (const edge of [box.x, box.x + box.w / 2, box.x + box.w]) { const d = t - edge; if (Math.abs(d) <= SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t }; }
    if (best) { x += best.d; guides.v.push(best.t); }
    best = null;
    for (const t of ys) for (const edge of [box.y, box.y + box.h / 2, box.y + box.h]) { const d = t - edge; if (Math.abs(d) <= SNAP && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, t }; }
    if (best) { y += best.d; guides.h.push(best.t); }
  }
  return { box: { ...box, x, y }, guides };
}

export const GRID = 20; // canvas units between grid lines when "Snap to grid" is on
const toGrid = (v) => Math.round(v / GRID) * GRID;

export default function Canvas({ slide, els, theme, grid = false, selectedId, onSelect, onChange, onDelete, onDuplicate, onReorder, editingId, setEditingId, onPickImage }) {
  const t = themeOf(theme);
  const frame = useRef(null);
  const drag = useRef(null);
  const [live, setLive] = useState(null); // { id, box }
  const liveRef = useRef(null);
  const [guides, setGuides] = useState({ v: [], h: [] });
  const latest = useRef({ els, onChange, grid });
  latest.current = { els, onChange, grid };

  const scale = () => SLIDE_W / (frame.current?.getBoundingClientRect().width || SLIDE_W);

  const start = (e, el, mode) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(el.id);
    frame.current?.focus({ preventScroll: true });
    if (editingId === el.id) return;
    drag.current = { id: el.id, mode, px: e.clientX, py: e.clientY, box: { x: el.x, y: el.y, w: el.w, h: el.h }, ratio: el.w / el.h, image: el.type === "image", moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  useEffect(() => {
    const move = (e) => {
      const d = drag.current;
      if (!d) return;
      const k = scale();
      const dx = (e.clientX - d.px) * k, dy = (e.clientY - d.py) * k;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) < 3) return;
      d.moved = true;
      let b = { ...d.box };
      if (d.mode === "move") { b.x += dx; b.y += dy; }
      else {
        if (d.mode.includes("e")) b.w = d.box.w + dx;
        if (d.mode.includes("s")) b.h = d.box.h + dy;
        if (d.mode.includes("w")) { b.w = d.box.w - dx; b.x = d.box.x + dx; }
        if (d.mode.includes("n")) { b.h = d.box.h - dy; b.y = d.box.y + dy; }
        if (d.image && d.mode.length === 2) { // corner of a picture: keep its shape
          const nh = b.w / d.ratio;
          if (d.mode.includes("n")) b.y = d.box.y + d.box.h - nh;
          b.h = nh;
        }
        if (b.w < 16) { if (d.mode.includes("w")) b.x -= 16 - b.w; b.w = 16; }
        if (b.h < 8) { if (d.mode.includes("n")) b.y -= 8 - b.h; b.h = 8; }
      }
      if (latest.current.grid) {
        if (d.mode === "move") { b.x = toGrid(b.x); b.y = toGrid(b.y); }
        else {
          let r = b.x + b.w, bt = b.y + b.h;
          if (d.mode.includes("w")) b.x = toGrid(b.x);
          if (d.mode.includes("n")) b.y = toGrid(b.y);
          if (d.mode.includes("e")) r = toGrid(r);
          if (d.mode.includes("s")) bt = toGrid(bt);
          b.w = Math.max(16, r - b.x); b.h = Math.max(8, bt - b.y);
        }
      }
      const others = latest.current.els.filter((o) => o.id !== d.id);
      const s = latest.current.grid ? { box: b, guides: { v: [], h: [] } } : snapBox(b, others, d.mode);
      setGuides(s.guides);
      liveRef.current = { id: d.id, box: s.box };
      setLive(liveRef.current);
    };
    const up = () => {
      const d = drag.current;
      const l = liveRef.current;
      drag.current = null;
      liveRef.current = null;
      setGuides({ v: [], h: [] });
      setLive(null);
      if (d && d.moved && l) {
        const b = clampBox(l.box);
        latest.current.onChange(d.id, { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) }, null);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sel = els.find((e) => e.id === selectedId);
  const onKeyDown = (e) => {
    if (editingId) return;
    if (!sel) return;
    const step = e.shiftKey ? 10 : 1;
    const nudge = (dx, dy) => { e.preventDefault(); const b = clampBox({ ...sel, x: sel.x + dx, y: sel.y + dy }); onChange(sel.id, { x: b.x, y: b.y }, `nudge:${sel.id}`); };
    if (e.key === "ArrowLeft") nudge(-step, 0);
    else if (e.key === "ArrowRight") nudge(step, 0);
    else if (e.key === "ArrowUp") nudge(0, -step);
    else if (e.key === "ArrowDown") nudge(0, step);
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); onDelete(sel); }
    else if (e.key === "Enter" && sel.type === "text") { e.preventDefault(); setEditingId(sel.id); }
    else if (e.key === "]") { e.preventDefault(); onReorder?.(sel, "forward"); }
    else if (e.key === "[") { e.preventDefault(); onReorder?.(sel, "backward"); }
    else if (e.key === "Escape") onSelect(null);
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") { e.preventDefault(); onDuplicate(sel); }
  };

  return (
    <div className="slide-frame canvas" ref={frame} tabIndex={0} onKeyDown={onKeyDown} onPointerDown={() => { onSelect(null); frame.current?.focus({ preventScroll: true }); }}
      role="application" aria-label="Slide canvas. Select an element, then use arrow keys to move it, Delete to remove it.">
      <div className={`slide slide--free${grid ? " slide--grid" : ""}`} style={{ "--sl-bg": t.bg, "--sl-ink": t.ink, "--sl-accent": t.accent, "--sl-soft": t.soft, "--sl-panel": t.panel, "--sl-panel-ink": t.panelInk }}>
        {els.map((el) => {
          const isSel = el.id === selectedId;
          const over = live && live.id === el.id ? live.box : undefined;
          const shown = over ? { ...el, ...over } : el;
          const editing = editingId === el.id;
          return (
            <div key={el.id} className={`el el--edit el--${el.type} ${isSel ? "el--sel" : ""} ${over ? "el--live" : ""}`} style={boxStyle(el, over)}
              onPointerDown={(e) => start(e, el, "move")}
              onDoubleClick={(e) => { e.stopPropagation(); if (el.type === "text") setEditingId(el.id); else if (el.type === "image") onPickImage(el); }}>
              {editing ? <InlineText el={el} theme={theme} onCommit={(v) => onChange(el.id, { text: v }, `text:${el.id}`)} onDone={() => setEditingId(null)} />
                : <ElementBody el={shown} theme={theme} editing />}
              {isSel && !editing && HANDLES.map((h) => (
                <span key={h} className={`handle handle--${h}`} onPointerDown={(e) => start(e, el, h)} aria-hidden="true" />
              ))}
            </div>
          );
        })}
        {guides.v.map((x) => <span key={`v${x}`} className="guide guide--v" style={{ left: `${(x / SLIDE_W) * 100}%` }} />)}
        {guides.h.map((y) => <span key={`h${y}`} className="guide guide--h" style={{ top: `${(y / SLIDE_H) * 100}%` }} />)}
      </div>
    </div>
  );
}
