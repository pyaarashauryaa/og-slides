// A brief handful of confetti where you click. Purely decorative:
// - fine pointers only (mouse/pen), never touch; skipped for reduced motion
// - never over places where precision matters (text fields, the slide canvas, handles, sliders)
// - also exports celebrate() (a star burst for real successes) and a tiny sparkle trail
// - the layer ignores the pointer, and at most one burst of 8 pieces lives at a time per click
const COLORS = ["#ff5c8a", "#ffd84a", "#6a3df0", "#6fe0b0", "#cbb6ff", "#ff8a3d", "#5bc0ff"];
export const NO_BURST = "input, textarea, select, [contenteditable='true'], .stage__canvas, .canvas, .el, .handle, .present, .modal, .cometchat, [data-noburst]";

export function burstAllowed(target, e = {}) {
  if (e.button !== undefined && e.button !== 0) return false;
  if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return false;
  if (!target || typeof target.closest !== "function") return false;
  return !target.closest(NO_BURST);
}

export function burstVectors(n = 8, rand = Math.random) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + rand() * 0.6;
    const d = 22 + rand() * 22;
    return { dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d), rot: Math.round((rand() - 0.5) * 360), color: COLORS[i % COLORS.length] };
  });
}

let installed = false;
export function installClickBurst() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const mq = (q) => window.matchMedia?.(q).matches;
  if (mq("(prefers-reduced-motion: reduce)") || !mq("(hover: hover) and (pointer: fine)")) return;
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (!burstAllowed(e.target, e)) return;
      if (document.querySelectorAll(".burst").length > 2) return;
      const layer = document.createElement("div");
      layer.className = "burst";
      layer.setAttribute("aria-hidden", "true");
      for (const v of burstVectors()) {
        const p = document.createElement("i");
        p.style.cssText = `left:${e.clientX}px;top:${e.clientY}px;--dx:${v.dx}px;--dy:${v.dy}px;--rot:${v.rot}deg;--c:${v.color}`;
        layer.appendChild(p);
      }
      document.body.appendChild(layer);
      setTimeout(() => layer.remove(), 600);
    },
    { passive: true }
  );
}

// ---------- Sparkle trail: a few tiny stars behind a moving mouse, never a full-screen streak ----------
export const TRAIL_MIN_DIST = 36;   // px the pointer must travel before the next sparkle
export const TRAIL_MIN_GAP = 70;    // ms between sparkles
export const TRAIL_MAX_ALIVE = 6;

export function shouldSpark(prev, now, e, alive = 0) {
  if (alive >= TRAIL_MAX_ALIVE) return false;
  if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return false;
  if (e.buttons) return false; // dragging or selecting: stay out of the way
  if (!prev) return true;
  if (now - prev.t < TRAIL_MIN_GAP) return false;
  return Math.hypot(e.clientX - prev.x, e.clientY - prev.y) >= TRAIL_MIN_DIST;
}

const motionOk = () => typeof window !== "undefined" && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

let trailOn = false;
export function installSparkleTrail() {
  if (trailOn || typeof window === "undefined" || !motionOk()) return;
  trailOn = true;
  let prev = null;
  let alive = 0;
  window.addEventListener(
    "pointermove",
    (e) => {
      const now = performance.now();
      if (!shouldSpark(prev, now, e, alive)) return;
      prev = { x: e.clientX, y: e.clientY, t: now };
      if (!e.target?.closest || e.target.closest(NO_BURST)) return; // not over editing / precision areas
      const s = document.createElement("i");
      s.className = "spark";
      s.setAttribute("aria-hidden", "true");
      s.style.cssText = `left:${e.clientX + 10}px;top:${e.clientY + 12}px;--c:${COLORS[Math.floor(now / 70) % COLORS.length]};--sz:${6 + Math.floor((now % 5))}px`;
      document.body.appendChild(s);
      alive += 1;
      setTimeout(() => { s.remove(); alive -= 1; }, 620);
    },
    { passive: true }
  );
}

// ---------- celebrate(): a star burst from an element (or the screen centre) for a real success ----------
export function celebrate(origin) {
  if (typeof document === "undefined" || !motionOk()) return false;
  if (document.querySelectorAll(".burst--stars").length > 1) return false;
  const r = origin && origin.getBoundingClientRect ? origin.getBoundingClientRect() : null;
  const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const y = r ? r.top + r.height / 2 : window.innerHeight / 3;
  const layer = document.createElement("div");
  layer.className = "burst burst--stars";
  layer.setAttribute("aria-hidden", "true");
  for (const v of burstVectors(14).map((q, i) => ({ ...q, dx: q.dx * 3, dy: q.dy * 3 }))) {
    const p = document.createElement("i");
    p.style.cssText = `left:${x}px;top:${y}px;--dx:${v.dx}px;--dy:${v.dy}px;--rot:${v.rot}deg;--c:${v.color}`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 900);
  return true;
}
