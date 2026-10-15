import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createCursorSender, toNormalized, toPercent, visibleCursors, cursorPhase } from "../workspace/cursors.js";
import { SLIDE_W, SLIDE_H } from "../workspace/model.js";

const NONE = [];
const noSub = () => () => {};

// Draws teammates' pointers (and the element each has selected) on top of the slide, and shares this person's pointer.
// - It sits above the slide with pointer-events:none, so it can never catch a click, drag or key press.
// - Pointer tracking is one passive listener; it only READS positions and never calls preventDefault.
// - Positions are fractions of the slide box, so they are right at any zoom, window size or screen density.
export default function SlideCursors({ api, deckId, slideId, selfUid, colors, peers, els }) {
  const box = useRef(null);
  const [now, setNow] = useState(() => Date.now());
  const all = useSyncExternalStore(api ? api.subscribe : noSub, api ? api.get : () => NONE);

  // ages cursors once a second (idle fade, removal) without any network traffic
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // share my pointer
  useEffect(() => {
    if (!api || !box.current) return undefined;
    const el = box.current.parentElement; // the slide box
    const sender = createCursorSender((p) => api.send(p));
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      sender.move(toNormalized(e.clientX, e.clientY, el.getBoundingClientRect()));
    };
    const onLeave = () => sender.leave();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      sender.leave();
      sender.dispose();
    };
  }, [api, deckId, slideId]);

  const shown = useMemo(() => visibleCursors(all, { deckId, slideId, selfUid }, now), [all, deckId, slideId, selfUid, now]);
  const outlines = useMemo(() => {
    const out = [];
    for (const p of peers || []) {
      if (!p.elId || p.deckId !== deckId || p.slideId !== slideId || p.away) continue;
      const el = els?.find((e) => e.id === p.elId);
      if (el) out.push({ uid: p.uid, name: p.name, el });
    }
    return out;
  }, [peers, els, deckId, slideId]);

  return (
    <div ref={box} className="rcurs" aria-hidden="true">
      {outlines.map(({ uid, name, el }) => {
        const c = colors.get(uid);
        return (
          <span key={`o${uid}`} className="rsel" style={{ left: `${(el.x / SLIDE_W) * 100}%`, top: `${(el.y / SLIDE_H) * 100}%`, width: `${(el.w / SLIDE_W) * 100}%`, height: `${(el.h / SLIDE_H) * 100}%`, "--rc": c?.bg, "--rc-fg": c?.fg }}>
            <b>{name}</b>
          </span>
        );
      })}
      {shown.map((cur) => {
        const c = colors.get(cur.uid);
        return (
          <span key={cur.uid} className={`rcur rcur--${cursorPhase(cur.at, now)}`} style={{ ...toPercent(cur), "--rc": c?.bg, "--rc-fg": c?.fg }}>
            <svg width="18" height="20" viewBox="0 0 18 20"><path d="M2 2l13 6.2-5.6 1.8L7 16z" fill="var(--rc)" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            <b>{cur.name}</b>
          </span>
        );
      })}
    </div>
  );
}
