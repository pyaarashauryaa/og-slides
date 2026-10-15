import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, StickyNote } from "lucide-react";
import SlideView from "./SlideView.jsx";

const TRANSITIONS = [["none", "None"], ["fade", "Fade"], ["slide", "Slide"], ["zoom", "Zoom"]];

// Full-screen presenting. Arrow keys / Space move, N shows speaker notes, Esc leaves.
// `slides` carry their elements ({...slide, els}). Speaker notes are shown only here, never on the slide.
export default function PresentMode({ slides, theme, transition = "fade", onTransition, startIndex = 0, onClose }) {
  const [i, setI] = useState(Math.min(startIndex, Math.max(0, slides.length - 1)));
  const [dir, setDir] = useState(1);
  const [notes, setNotes] = useState(false);
  const root = useRef(null);
  const go = useCallback((d) => {
    setDir(d);
    setI((x) => Math.max(0, Math.min(slides.length - 1, x + d)));
  }, [slides.length]);

  useEffect(() => {
    root.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.target?.tagName === "SELECT") return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
      else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === "Home") { setDir(-1); setI(0); }
      else if (e.key === "End") { setDir(1); setI(slides.length - 1); }
      else if (e.key.toLowerCase() === "n") setNotes((n) => !n);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go, onClose, slides.length]);

  const idx = Math.min(i, slides.length - 1);
  const cur = slides[idx];
  if (!cur) return null;
  return (
    <div className="present" role="dialog" aria-modal="true" aria-label="Presentation" tabIndex={-1} ref={root}>
      <div className="present__top">
        <label className="present__tr">Transition
          <select value={transition} onChange={(e) => onTransition?.(e.target.value)} aria-label="Slide transition">
            {TRANSITIONS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </label>
        <button className={`present__btn ${notes ? "is-on" : ""}`} onClick={() => setNotes((n) => !n)} aria-pressed={notes} title="Speaker notes (N)"><StickyNote size={18} /> Notes</button>
        <button className="present__close" onClick={onClose} aria-label="Exit presentation"><X size={22} /></button>
      </div>
      <div className="present__stage" onClick={() => go(1)}>
        <div key={cur.id} className={`present__slide present__slide--${transition}-${dir > 0 ? "next" : "prev"}`}>
          <SlideView slide={cur} theme={theme} els={cur.els} />
        </div>
      </div>
      {notes && (
        <div className="present__notes" role="region" aria-label="Speaker notes">
          {cur.notes ? cur.notes : <em>No notes for this slide.</em>}
        </div>
      )}
      <div className="present__bar">
        <button onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous slide"><ChevronLeft size={22} /></button>
        <span aria-live="polite">{idx + 1} / {slides.length}</span>
        <button onClick={() => go(1)} disabled={idx >= slides.length - 1} aria-label="Next slide"><ChevronRight size={22} /></button>
      </div>
    </div>
  );
}
