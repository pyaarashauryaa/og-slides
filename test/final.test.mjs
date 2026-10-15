import test from "node:test";
import assert from "node:assert/strict";
import { burstAllowed, burstVectors, NO_BURST } from "../src/ui/clickBurst.js";
import { readFileSync } from "node:fs";

const el = (matches) => ({ closest: (sel) => (matches ? {} : null), sel: NO_BURST });

test("click burst: plain mouse click on ordinary UI is allowed", () => {
  assert.equal(burstAllowed(el(false), { button: 0, pointerType: "mouse" }), true);
});
test("click burst: skipped on touch, right-click and precision areas", () => {
  assert.equal(burstAllowed(el(false), { button: 0, pointerType: "touch" }), false);
  assert.equal(burstAllowed(el(false), { button: 2, pointerType: "mouse" }), false);
  assert.equal(burstAllowed(el(true), { button: 0, pointerType: "mouse" }), false);
  assert.equal(burstAllowed(null, {}), false);
});
test("click burst: precision areas are really in the exclusion list", () => {
  for (const s of ["input", "textarea", ".stage__canvas", ".handle", "[contenteditable='true']", ".el"]) assert.ok(NO_BURST.includes(s), s);
});
test("burst vectors: 8 small pieces that stay close to the click", () => {
  const v = burstVectors(8, () => 0.5);
  assert.equal(v.length, 8);
  for (const p of v) assert.ok(Math.hypot(p.dx, p.dy) <= 46);
});

test("welcome screen keeps the real identity flow", () => {
  const w = readFileSync(new URL("../src/session/Welcome.jsx", import.meta.url), "utf8");
  const g = readFileSync(new URL("../src/session/SessionGate.jsx", import.meta.url), "utf8");
  const l = readFileSync(new URL("../src/team/Landing.jsx", import.meta.url), "utf8");
  assert.match(w, /TEST_USERS\.map/);          // users still come from the real list, none invented
  assert.match(w, /onPick\(u\.uid\)/);          // picking still passes the real uid
  assert.match(l, /<Welcome onPick=\{s\.pick\}/); // the demo-account picker is still reachable from the landing page
  assert.match(g, /<TeamFlow \/>/);               // and the gate now starts with the team landing page
  assert.doesNotMatch(w, /getting your room ready/i);
});
test("custom cursor is limited to fine pointers and keeps text cursors", () => {
  const c = readFileSync(new URL("../src/styles/studio.css", import.meta.url), "utf8");
  assert.match(c, /@media \(hover: hover\) and \(pointer: fine\)/);
  assert.match(c, /\) 3 4, auto;/);             // fallback keyword present
  assert.match(c, /textarea[^}]*cursor: text/);
});
test("Home no longer contains the old setup card", () => {
  const h = readFileSync(new URL("../src/pages/Home.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(h, /Getting your room ready/i);
});

// ---------- playful v2 ----------
import { shouldSpark, TRAIL_MAX_ALIVE } from "../src/ui/clickBurst.js";
import { countAt } from "../src/ui/useCountUp.js";

test("sparkle trail: sparse, mouse-only, never while dragging, capped", () => {
  const mv = (x, y, extra = {}) => ({ clientX: x, clientY: y, pointerType: "mouse", buttons: 0, ...extra });
  assert.equal(shouldSpark(null, 0, mv(0, 0)), true);
  assert.equal(shouldSpark({ x: 0, y: 0, t: 0 }, 20, mv(100, 0)), false, "too soon");
  assert.equal(shouldSpark({ x: 0, y: 0, t: 0 }, 200, mv(5, 0)), false, "too close");
  assert.equal(shouldSpark({ x: 0, y: 0, t: 0 }, 200, mv(100, 0)), true);
  assert.equal(shouldSpark(null, 0, mv(0, 0, { buttons: 1 })), false, "dragging");
  assert.equal(shouldSpark(null, 0, mv(0, 0, { pointerType: "touch" })), false, "touch");
  assert.equal(shouldSpark(null, 0, mv(0, 0), TRAIL_MAX_ALIVE), false, "cap");
});

test("count-up ends exactly on the real number and never overshoots", () => {
  assert.equal(countAt(0, 12, 0), 0);
  assert.equal(countAt(0, 12, 1), 12);
  assert.equal(countAt(0, 12, 5), 12);
  assert.equal(countAt(3, 9, 0.5) > 3 && countAt(3, 9, 0.5) < 9, true);
});

test("playful layer: palette roles, reduced motion and touch are handled", async () => {
  const fs = await import("node:fs");
  const css = fs.readFileSync(new URL("../src/styles/studio.css", import.meta.url), "utf8");
  for (const t of ["--cobalt: #6a3df0", "--sky:", "--orange:", "--peach:"]) assert.ok(css.includes(t), t);
  assert.ok(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.spark/.test(css), "sparks stop for reduced motion");
  assert.ok(css.includes("@media (hover: none)") && /hover: none\)[\s\S]*\.spark \{ display: none/.test(css), "no sparks on touch");
  assert.ok(/\.stage__canvas \{ animation: fadeOnly/.test(css) && !/\.stage__canvas[^}]*transform/.test(css.split("PLAYFUL v2")[1]), "editing surface only fades");
});
