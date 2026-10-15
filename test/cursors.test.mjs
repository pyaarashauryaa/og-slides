// Shared slide cursors + voice-note helpers. No CometChat: a pretend server passes live signals between two engines.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/workspace/engine.js";
import {
  CURSOR_COLORS, assignColors, toNormalized, toPercent, cleanCursor, cursorPhase, visibleCursors, createCursorSender,
  CURSOR_IDLE_MS, CURSOR_GONE_MS,
} from "../src/workspace/cursors.js";
import { computePeaks, cleanPeaks, cleanDuration, formatClock, playbackProblem, readVoiceMessage, voiceMetadata } from "../src/cometchat/voiceNote.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const engines = [];

function room() {
  const clients = new Set();
  const make = async (uid, name, opts = {}) => {
    const c = { handlers: null };
    clients.add(c);
    const transport = {
      async connect() {}, async fetchHistory() { return []; }, async send(p) { return { seq: 1, sentAt: Date.now(), by: { uid, name }, payload: p }; },
      subscribe(h) { c.handlers = h; return () => { c.handlers = null; }; },
      sendPresence(d) { for (const o of clients) if (o !== c && o.handlers) o.handlers.onPresence(JSON.parse(JSON.stringify(d))); },
    };
    const engine = createEngine({ transport, self: { uid, name }, options: { tickMs: 20, presenceTtlMs: 400, presenceEveryMs: 60, ...opts } });
    await engine.start();
    engines.push(engine);
    return { engine, c };
  };
  return { make };
}
test.after(() => engines.forEach((e) => e.stop()));

// ---------- colours ----------
test("colours: stable, distinct, and the same on every computer", () => {
  const ids = ["cometchat-uid-1", "cometchat-uid-2", "cometchat-uid-3", "cometchat-uid-4", "cometchat-uid-5"];
  const a = assignColors(ids);
  const b = assignColors([...ids].reverse());
  for (const id of ids) assert.equal(a.get(id).id, b.get(id).id, "order of arrival must not matter");
  assert.equal(new Set(ids.map((i) => a.get(i).id)).size, ids.length, "no two people share a colour");
  assert.equal(assignColors(["x"]).get("x").id, assignColors(["x"]).get("x").id, "same input, same colour");
});
test("colours: more people than colours still gives everyone one", () => {
  const ids = Array.from({ length: 12 }, (_, i) => `u${i}`);
  const m = assignColors(ids);
  assert.equal(m.size, 12);
  for (const c of m.values()) assert.ok(CURSOR_COLORS.includes(c));
  assert.equal(assignColors([null, "", undefined]).size, 0);
});
function lum(hex) { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
test("colours: every name label is readable (contrast >= 4.5:1)", () => {
  for (const c of CURSOR_COLORS) { const [a, b] = [lum(c.bg), lum(c.fg)].sort((x, y) => y - x); assert.ok((a + 0.05) / (b + 0.05) >= 4.5, `${c.id} ${(a + 0.05) / (b + 0.05)}`); }
});

// ---------- coordinates ----------
test("coordinates: the same spot maps to the same fraction at any size, zoom or screen offset", () => {
  const small = { left: 100, top: 50, width: 400, height: 225 };
  const big = { left: 20, top: 10, width: 1600, height: 900 };
  assert.deepEqual(toNormalized(300, 162.5, small), { x: 0.5, y: 0.5 });
  assert.deepEqual(toNormalized(820, 460, big), { x: 0.5, y: 0.5 });
  assert.deepEqual(toNormalized(100, 50, small), { x: 0, y: 0 });
  assert.deepEqual(toNormalized(500, 275, small), { x: 1, y: 1 });
  assert.equal(toNormalized(99, 100, small), null, "outside the slide");
  assert.equal(toNormalized(300, 300, small), null);
  assert.equal(toNormalized(5, 5, { left: 0, top: 0, width: 0, height: 0 }), null);
  assert.deepEqual(toPercent({ x: 0.25, y: 0.5 }), { left: "25.00%", top: "50.00%" });
});
test("coordinates: untrusted network data is cleaned", () => {
  assert.equal(cleanCursor(null), null);
  assert.equal(cleanCursor({ t: "presence", uid: "a" }), null);
  assert.equal(cleanCursor({ t: "cursor", uid: "a", x: "no", y: 1 }), null);
  assert.equal(cleanCursor({ t: "cursor", uid: "a", x: Infinity, y: 1 }), null);
  const c = cleanCursor({ t: "cursor", uid: "a", name: "N".repeat(500), deckId: "d", slideId: 5, x: 3, y: -2 });
  assert.equal(c.x, 1); assert.equal(c.y, 0); assert.equal(c.name.length, 80); assert.equal(c.slideId, null);
  assert.deepEqual(cleanCursor({ t: "cursor", uid: "a", x: null, y: null }), { uid: "a", name: "Teammate", deckId: null, slideId: null, x: null, y: null });
});

// ---------- throttling ----------
test("sender: at most one update per interval, newest position wins, tiny moves skipped, leave sends one hide", async () => {
  const sent = [];
  let t = 1000;
  const timers = [];
  const s = createCursorSender((p) => sent.push(p), { intervalMs: 80, now: () => t, setTimer: (fn, ms) => { timers.push({ fn, at: t + ms }); return timers.length; }, clearTimer: () => {} });
  s.move({ x: 0.1, y: 0.1 });                 // first one goes straight out
  assert.equal(sent.length, 1);
  t += 10; s.move({ x: 0.2, y: 0.2 }); t += 10; s.move({ x: 0.3, y: 0.3 }); // too soon: held back
  assert.equal(sent.length, 1);
  t += 70; timers.shift().fn();               // the held-back timer fires: only the NEWEST position is sent
  assert.deepEqual(sent.at(-1), { x: 0.3, y: 0.3 });
  assert.equal(sent.length, 2);
  t += 200; s.move({ x: 0.3001, y: 0.3001 }); // tiny move: ignored
  assert.equal(sent.length, 2);
  s.leave(); s.leave();                       // one hide, not two
  assert.deepEqual(sent.slice(2), [null]);
});
test("sender: dispose stops a pending update", () => {
  const sent = []; let fired = null;
  const s = createCursorSender((p) => sent.push(p), { intervalMs: 80, now: () => 1000, setTimer: (fn) => { fired = fn; return 1; }, clearTimer: () => { fired = null; } });
  s.move({ x: 0.1, y: 0.1 }); s.move({ x: 0.5, y: 0.5 }); s.dispose();
  assert.equal(fired, null); assert.equal(sent.length, 1);
});

// ---------- visibility / aging ----------
test("visibility: only this deck + this slide, never me, fades then disappears", () => {
  const now = 100000;
  const cur = (o) => ({ uid: "p", deckId: "d1", slideId: "s1", x: 0.5, y: 0.5, at: now, ...o });
  const ctx = { deckId: "d1", slideId: "s1", selfUid: "me" };
  assert.equal(visibleCursors([cur()], ctx, now).length, 1);
  assert.equal(visibleCursors([cur({ deckId: "d2" })], ctx, now).length, 0, "other deck");
  assert.equal(visibleCursors([cur({ slideId: "s2" })], ctx, now).length, 0, "other slide");
  assert.equal(visibleCursors([cur({ uid: "me" })], ctx, now).length, 0, "own cursor");
  assert.equal(visibleCursors([cur({ x: null })], ctx, now).length, 0, "hidden");
  assert.equal(cursorPhase(now - 1000, now), "live");
  assert.equal(cursorPhase(now - CURSOR_IDLE_MS, now), "idle");
  assert.equal(visibleCursors([cur({ at: now - CURSOR_GONE_MS })], ctx, now).length, 0, "stale");
});

// ---------- the engine, with two sessions ----------
test("engine: a cursor reaches a teammate on the same deck, with position and name", async () => {
  const r = room();
  const a = await r.make("ua", "Aarav"), b = await r.make("ub", "Priya");
  a.engine.setFocus({ deckId: "d1", slideId: "s1" }); b.engine.setFocus({ deckId: "d1", slideId: "s1" });
  await wait(30);
  a.engine.sendCursor({ x: 0.25, y: 0.75 });
  const got = b.engine.getCursors();
  assert.equal(got.length, 1);
  assert.deepEqual([got[0].uid, got[0].name, got[0].x, got[0].y, got[0].deckId, got[0].slideId], ["ua", "Aarav", 0.25, 0.75, "d1", "s1"]);
  assert.equal(a.engine.getCursors().length, 0, "I never receive my own cursor");
});
test("engine: nothing is sent when nobody else is in the same deck (no cross-deck leakage)", async () => {
  const r = room();
  const a = await r.make("ua", "Aarav"), b = await r.make("ub", "Priya");
  a.engine.setFocus({ deckId: "d1", slideId: "s1" }); b.engine.setFocus({ deckId: "d2", slideId: "s9" });
  await wait(30);
  a.engine.sendCursor({ x: 0.5, y: 0.5 });
  assert.equal(b.engine.getCursors().length, 0);
  const seen = visibleCursors(b.engine.getCursors(), { deckId: "d2", slideId: "s9", selfUid: "ub" }, Date.now());
  assert.equal(seen.length, 0);
});
test("engine: leaving the slide hides the cursor; moving to another slide drops it", async () => {
  const r = room();
  const a = await r.make("ua", "Aarav"), b = await r.make("ub", "Priya");
  a.engine.setFocus({ deckId: "d1", slideId: "s1" }); b.engine.setFocus({ deckId: "d1", slideId: "s1" });
  await wait(30);
  a.engine.sendCursor({ x: 0.5, y: 0.5 });
  assert.equal(b.engine.getCursors().length, 1);
  a.engine.sendCursor(null);
  assert.equal(b.engine.getCursors().length, 0);
  a.engine.sendCursor({ x: 0.4, y: 0.4 });
  a.engine.setFocus({ deckId: "d1", slideId: "s2" });
  assert.equal(b.engine.getCursors().length, 0, "they moved to another slide");
});
test("engine: a person who leaves, or goes silent, loses their cursor; subscribers are told", async () => {
  const r = room();
  const a = await r.make("ua", "Aarav"), b = await r.make("ub", "Priya");
  a.engine.setFocus({ deckId: "d1", slideId: "s1" }); b.engine.setFocus({ deckId: "d1", slideId: "s1" });
  await wait(30);
  let notified = 0;
  const off = b.engine.subscribeCursors(() => notified++);
  a.engine.sendCursor({ x: 0.5, y: 0.5 });
  assert.ok(notified >= 1);
  a.engine.stop();
  assert.equal(b.engine.getCursors().length, 0, "leaving removes the cursor at once");
  off();
});
test("engine: a dropped connection clears teammates' cursors (stale positions are worse than none)", async () => {
  const r = room();
  let handlers;
  const a = await r.make("ua", "Aarav");
  const transport = { async connect() {}, async fetchHistory() { return []; }, async send() { return { seq: 1, sentAt: 1, by: { uid: "ub", name: "P" }, payload: {} }; }, subscribe(h) { handlers = h; return () => {}; }, sendPresence() {} };
  const b = createEngine({ transport, self: { uid: "ub", name: "Priya" }, options: { tickMs: 20, presenceTtlMs: 400, presenceEveryMs: 60 } });
  await b.start(); engines.push(b);
  b.setFocus({ deckId: "d1", slideId: "s1" });
  handlers.onPresence({ t: "cursor", uid: "ua", name: "Aarav", deckId: "d1", slideId: "s1", x: 0.1, y: 0.1 });
  assert.equal(b.getCursors().length, 1);
  handlers.onConnection("disconnected");
  assert.equal(b.getCursors().length, 0);
  void a;
});
test("engine: garbage cursor messages are ignored", async () => {
  let handlers;
  const transport = { async connect() {}, async fetchHistory() { return []; }, async send() {}, subscribe(h) { handlers = h; return () => {}; }, sendPresence() {} };
  const e = createEngine({ transport, self: { uid: "me", name: "Me" } });
  await e.start(); engines.push(e);
  for (const bad of [null, {}, { t: "cursor" }, { t: "cursor", uid: "a", x: "x", y: 0 }, { t: "cursor", uid: "me", x: 0.5, y: 0.5 }]) handlers.onPresence(bad);
  assert.equal(e.getCursors().length, 0);
});
test("engine: presence carries the selected element and whether the tab is away", async () => {
  const r = room();
  const a = await r.make("ua", "Aarav"), b = await r.make("ub", "Priya");
  a.engine.setFocus({ deckId: "d1", slideId: "s1", elId: "e_7" });
  await wait(30);
  let p = b.engine.getSnapshot().presence.find((x) => x.uid === "ua");
  assert.equal(p.elId, "e_7"); assert.equal(p.away, false);
  a.engine.setAway(true);
  p = b.engine.getSnapshot().presence.find((x) => x.uid === "ua");
  assert.equal(p.away, true);
  a.engine.setAway(false);
  assert.equal(b.engine.getSnapshot().presence.find((x) => x.uid === "ua").away, false);
});

// ---------- voice notes ----------
test("voice: peaks are scaled, bounded and validated", () => {
  const samples = Float32Array.from({ length: 3600 }, (_, i) => Math.sin(i / 20) * (i < 1800 ? 1 : 0.25));
  const p = computePeaks(samples, 36);
  assert.equal(p.length, 36); assert.equal(Math.max(...p), 100); assert.ok(Math.min(...p) >= 8);
  assert.equal(computePeaks([], 36), null);
  assert.deepEqual(computePeaks(new Float32Array(100), 4), [8, 8, 8, 8], "silence is a flat line, not NaN");
  assert.equal(cleanPeaks("nope"), null); assert.equal(cleanPeaks([1, 2]), null); assert.equal(cleanPeaks(new Array(500).fill(5)), null);
  assert.deepEqual(cleanPeaks([-5, 500, 50, 20.4]), [0, 100, 50, 20]);
  assert.equal(cleanPeaks([1, 2, 3, "x"]), null);
});
test("voice: duration only when it is a real number (WebM reports Infinity)", () => {
  assert.equal(cleanDuration(Infinity), 0); assert.equal(cleanDuration(NaN), 0); assert.equal(cleanDuration(-3), 0); assert.equal(cleanDuration(0), 0);
  assert.equal(cleanDuration(12.34), 12.3); assert.equal(cleanDuration(99999), 0);
  assert.equal(formatClock(0), "0:00"); assert.equal(formatClock(65.9), "1:05"); assert.equal(formatClock(Infinity), "0:00"); assert.equal(formatClock(NaN), "0:00");
});
test("voice: each playback failure has plain words", () => {
  for (const c of [1, 2, 3, 4, undefined]) assert.ok(playbackProblem(c).length > 15);
  assert.match(playbackProblem(2), /connection/); assert.match(playbackProblem(3), /damaged/);
});
test("voice: the player reads url, length and bars from a message, and refuses unsafe links", () => {
  const msg = (url, meta = {}) => ({ getMetadata: () => meta, getAttachment: () => ({ getUrl: () => url, getName: () => "v.webm", getMimeType: () => "audio/webm;codecs=opus" }) });
  const ok = readVoiceMessage(msg("https://files.example.com/v.webm", { audioType: "voice_note", duration: 7.26, peaks: [10, 20, 30, 40, 50] }));
  assert.deepEqual([ok.url, ok.mime, ok.duration, ok.peaks, ok.isVoiceNote], ["https://files.example.com/v.webm", "audio/webm", 7.3, [10, 20, 30, 40, 50], true]);
  for (const bad of ["javascript:alert(1)", "data:audio/wav;base64,AAAA", "http://evil.example/x.webm", "blob:https://x/1", "file:///c:/x.wav"]) assert.equal(readVoiceMessage(msg(bad)).url, "", bad);
  assert.equal(readVoiceMessage(msg("http://localhost:5173/x.wav")).url, "http://localhost:5173/x.wav");
  assert.equal(readVoiceMessage(null).url, ""); assert.equal(readVoiceMessage({}).duration, 0);
  assert.equal(readVoiceMessage({ getMetadata: () => ({ peaks: "<script>" }) }).peaks, null);
});
test("voice: sent metadata includes measured length and bars only when valid", () => {
  const file = new File([new Uint8Array(2000)], "voice-note-1.webm", { type: "audio/webm" });
  const m = voiceMetadata(file, { duration: 4.2, peaks: [1, 2, 3, 4, 5] });
  assert.equal(m.audioType, "voice_note"); assert.equal(m.duration, 4.2); assert.deepEqual(m.peaks, [1, 2, 3, 4, 5]);
  const bare = voiceMetadata(file, { duration: Infinity, peaks: null });
  assert.equal("duration" in bare, false); assert.equal("peaks" in bare, false);
  assert.equal(voiceMetadata(file).fileName, "voice-note-1.webm");
});
