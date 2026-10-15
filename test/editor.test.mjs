// Tests the slide-element model, templates, duplication and undo/redo.
// SIMULATED only: a local reducer or a pretend server. No CometChat, no browser.
// Run with:  npm.cmd run test:editor
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/workspace/engine.js";
import { createActions } from "../src/workspace/actions.js";
import { initialState, applyOp } from "../src/workspace/reducer.js";
import { selectSlides, selectElements, selectTasks } from "../src/workspace/selectors.js";
import { sanitizeFields, fieldNames } from "../src/workspace/model.js";
import { TEMPLATES, legacyToElements } from "../src/slides/templates.js";
import * as ops from "../src/slides/editorOps.js";
import { createHistory } from "../src/slides/history.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const engines = [];
test.after(() => engines.forEach((e) => e.stop()));

// A tiny local "server" for the history tests: applies ops straight to a reducer.
function local() {
  let state = initialState();
  let seq = 0;
  const api = {
    get state() { return state; },
    commit(list, by = { uid: "me", name: "Me" }) { state = applyOp(state, { seq: ++seq, sentAt: 1000 + seq, by, payload: { v: 1, ops: list } }); },
  };
  api.history = createHistory({ getState: () => state, commit: (l) => api.commit(l), coalesceMs: 100000 });
  return api;
}
function seedDeck(l) {
  l.commit([{ t: "set", k: "deck", id: "d1", f: { title: "Deck", theme: "rani" } }]);
  const first = ops.newSlideFromTemplate(l.state, "d1", null, "cover");
  l.commit(first.ops);
  return first.slideId;
}

test("every template builds valid elements that survive validation", () => {
  assert.equal(TEMPLATES.length, 27);
  for (const t of TEMPLATES) {
    const specs = t.build();
    assert.ok(specs.length >= 2, t.id);
    for (const spec of specs) {
      const clean = sanitizeFields("el", { ...spec, slideId: "s1", z: 1 });
      for (const key of Object.keys(spec)) assert.ok(key in clean, `${t.id}: field "${key}" was rejected (value ${JSON.stringify(spec[key])})`);
    }
  }
});

test("a new slide from each template is a free-form slide with elements", () => {
  for (const t of TEMPLATES) {
    const l = local();
    const id = seedDeck(l);
    const made = ops.newSlideFromTemplate(l.state, "d1", id, t.id);
    l.commit(made.ops);
    const slides = selectSlides(l.state, "d1");
    assert.equal(slides.length, 2);
    const s = slides[1];
    assert.equal(s.mode, "free");
    assert.equal(s.tpl, t.id);
    assert.equal(selectElements(l.state, s.id).length, t.build().length);
  }
});

test("old slides without the new fields still load; converting keeps the text", () => {
  const l = local();
  l.commit([{ t: "set", k: "deck", id: "d1", f: { title: "Old", theme: "mint" } }, { t: "set", k: "slide", id: "s1", f: { deckId: "d1", title: "Legacy", body: "a\nb", layout: "bullets", pos: 1 } }]);
  const s = selectSlides(l.state, "d1")[0];
  assert.equal(s.mode, undefined);
  assert.deepEqual(selectElements(l.state, "s1"), []);
  const els = legacyToElements(s);
  assert.ok(els.some((e) => e.text === "Legacy"));
  l.history.run(ops.convertToFree(l.state, s));
  assert.equal(selectSlides(l.state, "d1")[0].mode, "free");
  assert.ok(selectElements(l.state, "s1").some((e) => e.text === "Legacy"));
});

test("duplicating a slide copies elements and notes under fresh ids, and edits stay independent", () => {
  const l = local();
  const id = seedDeck(l);
  l.commit([{ t: "set", k: "slide", id, f: { notes: "say hello" } }]);
  const dup = ops.duplicateSlideOps(l.state, "d1", id);
  l.commit(dup.ops);
  const slides = selectSlides(l.state, "d1");
  assert.equal(slides.length, 2);
  assert.equal(slides[1].id, dup.slideId); // right after the original
  assert.equal(slides[1].notes, "say hello");
  const a = selectElements(l.state, id), b = selectElements(l.state, dup.slideId);
  assert.equal(a.length, b.length);
  const ids = new Set([...a, ...b].map((e) => e.id));
  assert.equal(ids.size, a.length + b.length, "element ids must all be different");
  l.commit([{ t: "set", k: "el", id: b[0].id, f: { text: "changed copy" } }]);
  assert.notEqual(selectElements(l.state, id)[0].text, "changed copy");
});

test("move, resize and nudge elements; boxes are clamped so they cannot get lost", () => {
  const box = ops.clampBox({ x: 5000, y: -5000, w: 100, h: 50 });
  assert.ok(box.x <= 936 && box.y >= -26);
  const clean = sanitizeFields("el", { x: 99999, w: -5, color: "javascript:alert(1)", src: "javascript:alert(1)", font: "Comic Sans" });
  assert.deepEqual(Object.keys(clean).sort(), ["w", "x"]); // bad colour, src and font dropped
  assert.ok(clean.x <= 950 && clean.w >= 8);
});

test("image sources: https and small inline images only (no SVG, no script)", () => {
  assert.equal(sanitizeFields("el", { src: "https://example.com/a.png" }).src, "https://example.com/a.png");
  assert.equal(sanitizeFields("el", { src: "data:image/svg+xml;base64,PHN2Zz4=" }).src, undefined);
  assert.equal(sanitizeFields("el", { src: "http://example.com/a.png" }).src, undefined);
  assert.equal(sanitizeFields("el", { src: "data:text/html;base64,AAAAAAAAAAAAAAAAAAAAAAA" }).src, undefined);
});

test("undo / redo: move, text, add and delete shape, reorder", () => {
  const l = local();
  const id = seedDeck(l);
  const h = l.history;
  const el = () => selectElements(l.state, id);
  const title = el().find((e) => e.font === "Bricolage Grotesque");
  const x0 = title.x;
  h.run([{ t: "set", k: "el", id: title.id, f: { x: 300, y: 200 } }]);
  assert.equal(el().find((e) => e.id === title.id).x, 300);
  h.undo();
  assert.equal(el().find((e) => e.id === title.id).x, x0);
  h.redo();
  assert.equal(el().find((e) => e.id === title.id).x, 300);

  const n0 = el().length;
  const added = ops.addElementOps(l.state, id, { type: "shape", shape: "rect", x: 10, y: 10, w: 100, h: 100, fill: "accent" });
  h.run(added.ops);
  assert.equal(el().length, n0 + 1);
  h.undo();
  assert.equal(el().length, n0);
  h.redo(); // comes back under a new id
  assert.equal(el().length, n0 + 1);

  const shape = el().find((e) => e.type === "shape" && e.w === 100);
  h.run([{ t: "del", k: "el", id: shape.id }]);
  assert.equal(el().length, n0);
  h.undo();
  assert.equal(el().length, n0 + 1);
  h.undo(); h.undo(); // undo "add" (the shape is under an alias id now)
  assert.equal(el().length, n0, "undo through an undone delete must still find the shape");
});

test("undoing a slide delete brings back the slide AND its elements", () => {
  const l = local();
  const id = seedDeck(l);
  const before = selectElements(l.state, id).length;
  l.history.run(ops.deleteSlideOps(l.state, id));
  assert.equal(selectSlides(l.state, "d1").length, 0);
  l.history.undo();
  const slides = selectSlides(l.state, "d1");
  assert.equal(slides.length, 1);
  assert.equal(selectElements(l.state, slides[0].id).length, before);
  l.history.redo();
  assert.equal(selectSlides(l.state, "d1").length, 0);
});

test("undo never overwrites a teammate's newer change", () => {
  const l = local();
  const id = seedDeck(l);
  const t = selectElements(l.state, id)[2];
  l.history.run([{ t: "set", k: "el", id: t.id, f: { text: "mine" } }]);
  l.commit([{ t: "set", k: "el", id: t.id, f: { text: "theirs" } }], { uid: "u2", name: "Ben" });
  const r = l.history.undo();
  assert.equal(r.skipped, 1);
  assert.equal(selectElements(l.state, id).find((e) => e.id === t.id).text, "theirs");
});

test("rapid typing becomes one undo step", () => {
  const l = local();
  const id = seedDeck(l);
  const t = selectElements(l.state, id)[2];
  const orig = t.text;
  for (const s of ["h", "he", "hel", "hell", "hello"]) l.history.run([{ t: "set", k: "el", id: t.id, f: { text: s } }], { key: `text:${t.id}` });
  l.history.undo();
  assert.equal(selectElements(l.state, id).find((e) => e.id === t.id).text, orig);
  assert.equal(l.history.canRedo(), true);
  assert.equal(l.history.canUndo(), false); // all five keystrokes were one step
});

test("reorder (bring to front) changes z order and undoes", () => {
  const l = local();
  const id = seedDeck(l);
  const first = selectElements(l.state, id)[0];
  l.history.run(ops.reorderOps(l.state, first, "front"));
  const order = selectElements(l.state, id);
  assert.equal(order[order.length - 1].id, first.id);
  l.history.undo();
  assert.equal(selectElements(l.state, id)[0].id, first.id);
});

test("duplicating a whole presentation copies slides and elements", () => {
  const l = local();
  seedDeck(l);
  const deck = { id: "d1", title: "Deck", theme: "rani" };
  const dup = ops.duplicateDeckOps(l.state, deck);
  l.commit(dup.ops);
  const copy = selectSlides(l.state, dup.deckId);
  assert.equal(copy.length, 1);
  assert.equal(selectElements(l.state, copy[0].id).length, TEMPLATES[0].build().length);
});

test("two real engines on a pretend server: element edits merge per field", async () => {
  const log = []; const clients = new Set(); let seq = 100;
  const mk = (uid, name) => {
    const client = { handlers: null };
    clients.add(client);
    return { async connect() {}, async fetchHistory() { return [...log]; },
      async send(p) { const op = { seq: ++seq, sentAt: Date.now(), by: { uid, name }, payload: JSON.parse(JSON.stringify(p)) }; log.push(op); for (const c of clients) if (c !== client && c.handlers) c.handlers.onOp(op); return op; },
      subscribe(h) { client.handlers = h; return () => {}; }, sendPresence() {} };
  };
  const mkEngine = async (uid, name) => { const e = createEngine({ transport: mk(uid, name), self: { uid, name }, options: { retryBaseMs: 10, tickMs: 20 } }); await e.start(); engines.push(e); return e; };
  const a = await mkEngine("u1", "Ana"), b = await mkEngine("u2", "Ben");
  const A = createActions(a);
  const deckId = A.createDeck("Race");
  await wait(80);
  const slideId = selectSlides(a.getSnapshot().state, deckId)[0].id;
  const made = ops.newSlideFromTemplate(a.getSnapshot().state, deckId, slideId, "process");
  a.commit(made.ops);
  await wait(120);
  const bs = b.getSnapshot().state;
  const els = selectElements(bs, made.slideId);
  assert.equal(els.length, TEMPLATES.find((t) => t.id === "process").build().length);
  // Ana moves the element, Ben changes its text, at the same time: both survive.
  a.commit([{ t: "set", k: "el", id: els[2].id, f: { x: 400 } }]);
  b.commit([{ t: "set", k: "el", id: els[2].id, f: { text: "Ben's text" } }]);
  await wait(120);
  for (const e of [a, b]) {
    const el = selectElements(e.getSnapshot().state, made.slideId).find((x) => x.id === els[2].id);
    assert.equal(el.x, 400); assert.equal(el.text, "Ben's text");
  }
  assert.deepEqual(a.getSnapshot().state.entities, b.getSnapshot().state.entities);
});

test("a big action is split into several small messages (reducer reads max 50 ops)", async () => {
  const sent = [];
  const t = { async connect() {}, async fetchHistory() { return []; }, async send(p) { sent.push(p); return { seq: sent.length + 1, sentAt: Date.now(), by: { uid: "u", name: "U" }, payload: p }; }, subscribe() { return () => {}; }, sendPresence() {} };
  const e = createEngine({ transport: t, self: { uid: "u", name: "U" }, options: { retryBaseMs: 10, tickMs: 20 } });
  await e.start(); engines.push(e);
  const big = Array.from({ length: 130 }, (_, i) => ({ t: "set", k: "el", id: `e${i}`, f: { slideId: "s1", type: "text", text: "x" } }));
  e.commit(big);
  await wait(200);
  assert.ok(sent.length >= 4, `expected several messages, got ${sent.length}`);
  assert.ok(sent.every((p) => p.ops.length <= 40 && JSON.stringify(p).length < 60000));
  assert.equal(sent.reduce((n, p) => n + p.ops.length, 0), 130);
  assert.equal(Object.keys(e.getSnapshot().state.entities.el).length, 130);
});
