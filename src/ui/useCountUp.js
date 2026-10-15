import { useEffect, useRef, useState } from "react";

// Pure helper (unit tested): eased value between from and to at progress t (0..1).
export function countAt(from, to, t) {
  const k = Math.min(1, Math.max(0, t));
  const eased = 1 - Math.pow(1 - k, 3);
  return Math.round(from + (to - from) * eased);
}

// Counts up to a real number. Reduced motion: shows the number at once. The final value is always the real one.
export function useCountUp(target, ms = 650) {
  const [val, setVal] = useState(() => (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? target : 0));
  const from = useRef(val);
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || from.current === target) {
      from.current = target;
      setVal(target);
      return undefined;
    }
    const start = performance.now();
    const a = from.current;
    let raf = requestAnimationFrame(function tick(now) {
      const t = (now - start) / ms;
      setVal(countAt(a, target, t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    });
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}
