// Shared-cursor helpers: pure functions (no React, no CometChat) so they can be unit-tested.
//
// A cursor is sent as normalized slide coordinates: x and y are fractions of the slide's width and height
// (0 = left/top edge, 1 = right/bottom edge). Fractions stay correct whatever the window size, zoom level or
// screen density of the viewer, because each viewer multiplies them by their OWN slide size.

// Eight colours, each with a text colour that stays readable on it (contrast checked in the tests).
export const CURSOR_COLORS = [
  { id: "purple", name: "Purple", bg: "#6a3df0", fg: "#ffffff" },
  { id: "coral", name: "Coral", bg: "#d4366a", fg: "#ffffff" },
  { id: "mint", name: "Green", bg: "#0b7a52", fg: "#ffffff" },
  { id: "sky", name: "Blue", bg: "#0a6fb5", fg: "#ffffff" },
  { id: "orange", name: "Orange", bg: "#b85500", fg: "#ffffff" },
  { id: "butter", name: "Yellow", bg: "#ffd84a", fg: "#2b1b4d" },
  { id: "pink", name: "Pink", bg: "#ff9fc4", fg: "#2b1b4d" },
  { id: "teal", name: "Teal", bg: "#7fe3d6", fg: "#2b1b4d" },
];

const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// One distinct colour per person in the room. Everyone computes the same answer from the same set of ids: each
// person starts at the colour their id hashes to, and if that is taken (people are handled in id order) moves to the
// next free one. So a colour never changes while the same people are in the room.
export function assignColors(uids) {
  const out = new Map();
  const used = new Set();
  const list = [...new Set(uids.filter((u) => typeof u === "string" && u))].sort();
  for (const uid of list) {
    if (used.size >= CURSOR_COLORS.length) used.clear(); // more people than colours: colours start being shared
    let i = hash(uid) % CURSOR_COLORS.length;
    for (let n = 0; n < CURSOR_COLORS.length && used.has(i); n++) i = (i + 1) % CURSOR_COLORS.length;
    used.add(i);
    out.set(uid, CURSOR_COLORS[i]);
  }
  return out;
}

// Pointer position on screen -> fraction of the slide. Returns null when the pointer is outside the slide.
export function toNormalized(clientX, clientY, rect) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) return null;
  return { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
}

// Fractions -> percent strings for CSS left/top inside the slide box.
export const toPercent = (n) => ({ left: `${(n.x * 100).toFixed(2)}%`, top: `${(n.y * 100).toFixed(2)}%` });

// Everything arriving from the network is untrusted. Returns a clean cursor or null.
export function cleanCursor(data) {
  if (!data || data.t !== "cursor" || typeof data.uid !== "string" || !data.uid) return null;
  const deckId = typeof data.deckId === "string" ? data.deckId : null;
  const slideId = typeof data.slideId === "string" ? data.slideId : null;
  const name = typeof data.name === "string" ? data.name.slice(0, 80) : "Teammate";
  if (data.x === null || data.y === null) return { uid: data.uid, name, deckId, slideId, x: null, y: null };
  const x = Number(data.x), y = Number(data.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { uid: data.uid, name, deckId, slideId, x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

// How a remote cursor looks as it ages: full, then faded ("idle"), then gone.
export const CURSOR_IDLE_MS = 5000;
export const CURSOR_GONE_MS = 12000;
export function cursorPhase(at, now) {
  const age = now - at;
  return age >= CURSOR_GONE_MS ? "gone" : age >= CURSOR_IDLE_MS ? "idle" : "live";
}

// Which cursors may be drawn on THIS slide of THIS deck right now.
export function visibleCursors(cursors, { deckId, slideId, selfUid }, now) {
  return cursors.filter((c) => c.uid !== selfUid && c.x !== null && c.deckId === deckId && c.slideId === slideId && cursorPhase(c.at, now) !== "gone");
}

// Sends at most one update per `intervalMs` (the newest position always wins, so nothing stale is sent), skips
// tiny movements, and sends a final "hidden" update when the pointer leaves the slide.
export function createCursorSender(send, { intervalMs = 80, minDelta = 0.004, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let last = null; // last point actually sent
  let lastAt = -Infinity;
  let pending = null;
  let timer = null;
  const flush = () => {
    timer = null;
    if (!pending) return;
    const p = pending;
    pending = null;
    last = p;
    lastAt = now();
    send(p);
  };
  return {
    move(p) {
      if (!p) return this.leave();
      if (last && Math.abs(p.x - last.x) < minDelta && Math.abs(p.y - last.y) < minDelta && !pending) return;
      pending = p;
      const wait = intervalMs - (now() - lastAt);
      if (wait <= 0) { if (timer) { clearTimer(timer); timer = null; } flush(); }
      else if (!timer) timer = setTimer(flush, wait);
    },
    leave() {
      if (timer) { clearTimer(timer); timer = null; }
      pending = null;
      if (last !== null) { last = null; lastAt = now(); send(null); }
    },
    dispose() {
      if (timer) clearTimer(timer);
      timer = null;
      pending = null;
    },
  };
}
