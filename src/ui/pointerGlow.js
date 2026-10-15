// One tiny delegated listener gives every `.glow` card a soft light that follows the pointer.
// It only writes two CSS variables (no React re-render), runs once per frame, and is skipped on
// touch screens and for people who prefer reduced motion.
let installed = false;

export function installPointerGlow() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  if (window.matchMedia?.("(hover: none)").matches) return;
  let frame = 0;
  let last = null;
  const apply = () => {
    frame = 0;
    if (!last) return;
    const { target, x, y } = last;
    const el = target.closest?.(".glow");
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${x - r.left}px`);
    el.style.setProperty("--my", `${y - r.top}px`);
  };
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      last = { target: e.target, x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(apply);
    },
    { passive: true }
  );
}
