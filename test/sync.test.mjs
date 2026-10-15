// Tests the shared-workspace logic with a SIMULATED server (no CometChat involved).
// Run with:  npm.cmd run test:sync
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/workspace/engine.js";
import { createActions } from "../src/workspace/actions.js";
import { selectDecks, selectSlides, selectTasks, selectResources } from "../src/workspace/selectors.js";
import { initialState, applyOp } from "../src/workspace/reducer.js";
import { isSafeUrl } from "../src/workspace/model.js";

const started = [];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A pretend server: numbers every op, remembers the log, pushes ops to the other clients.
class FakeServer {
  constructor() { this.seq = 100; this.log = []; this.clients = new Set(); this.sends = 0; }
  transport(user, { latency = 0 } = {}) {
    const server = this;
    const client = { user, handlers: null, down: false, reorder: false, latency };
    this.clients.add(client);
    return {
      client,
      async connect() {},
      async fetchHistory() { if (client.down) throw new Error("offline"); return [...server.log]; },
      async send(payload) {
        server.sends++;
        if (client.down) throw Object.assign(new Error("offline"), { code: "FAILED_TO_FETCH" });
        if (client.latency) await wait(client.latency);
        const op = { seq: ++server.seq, sentAt: Date.now(), by: user, payload: JSON.parse(JSON.stringify(payload)) };
        server.log.push(op);
        for (const c of server.clients) if (c !== client && c.handlers && !c.down) {
          const deliver = () => c.handlers.onOp(op);
          c.reorder ? setTimeout(deliver, 15 - (op.seq % 10)) : deliver();
        }
        return op;
      },
      subscribe(handlers) { client.handlers = handlers; return () => { client.handlers = null; }; },
      sendPresence(data) { for (const c of server.clients) if (c !== client && c.handlers && !c.down) c.handlers.onPresence(data); },
    };
  }
}

async function makeClient(server, uid, name, opts = {}) {
  const transport = server.transport({ uid, name }, opts);
  const engine = createEngine({ transport, self: { uid, name }, options: { retryBaseMs: 10, tickMs: 20, presenceTtlMs: 120, presenceEveryMs: 40, ...opts.engine } });
  await engine.start();
  started.push(engine);
  return { engine, actions: createActions(engine), transport, state: () => engine.getSnapshot().state };
}
const settle = async (...cs) => { for (let i = 0; i < 20; i++) { await wait(15); if (cs.every((c) => c.engine.getSnapshot().pending === 0)) break; } await wait(40); };
const same = (a, b) => assert.deepEqual(a.entities, b.entities);

test("two people see the same deck, and a late joiner catches up from history", async () => {
  const s = new FakeServer();
  const a = await makeClient(s, "u1", "Ana"), b = await makeClient(s, "u2", "Ben");
  const deckId = a.actions.createDeck("Pitch");
  await settle(a, b);
  assert.equal(selectDecks(b.state())[0].title, "Pitch");
  const slideId = selectSlides(b.state(), deckId)[0].id;
  b.actions.updateSlide(slideId, { title: "Hello from Ben" });
  await settle(a, b);
  assert.equal(selectSlides(a.state(), deckId)[0].title, "Hello from Ben");
  const c = await makeClient(s, "u3", "Cleo");
  same(c.state(), a.state());
});

test("simultaneous edits converge, later save wins per field", async () => {
  const s = new FakeServer();
  const a = await makeClient(s, "u1", "Ana", { latency: 5 }), b = await makeClient(s, "u2", "Ben", { latency: 5 });
  const deckId = a.actions.createDeck("Race");
  await settle(a, b);
  const id = selectSlides(a.state(), deckId)[0].id;
  a.actions.updateSlide(id, { title: "Ana title", body: "Ana body" });
  b.actions.updateSlide(id, { title: "Ben title" });
  await settle(a, b);
  same(a.state(), b.state());
  const slide = selectSlides(a.state(), deckId)[0];
  assert.equal(slide.body, "Ana body"); // only Ana touched the body, so Ben's edit must not erase it
  assert.ok(["Ana title", "Ben title"].includes(slide.title));
});

test("ops delivered out of order still give the same result", async () => {
  const s = new FakeServer();
  const a = await makeClient(s, "u1", "Ana");
  const b = await makeClient(s, "u2", "Ben"); b.transport.client.reorder = true;
  const deckId = a.actions.createDeck("Order");
  await settle(a, b);
  const id = selectSlides(a.state(), deckId)[0].id;
  for (let i = 1; i <= 8; i++) { a.actions.updateSlide(id, { title: `v${i}` }); await wait(2); }
  await settle(a, b); await wait(80);
  same(a.state(), b.state());
  assert.equal(selectSlides(b.state(), deckId)[0].title, "v8");
});

test("deleting is final and cascades; concurrent slide add + reorder keeps every slide", async () => {
  const s = new FakeServer();
  const a = await makeClient(s, "u1", "Ana"), b = await makeClient(s, "u2", "Ben");
  const deckId = a.actions.createDeck("Structure"); await settle(a, b);
  const first = selectSlides(a.state(), deckId)[0].id;
  const second = a.actions.addSlide(deckId, first); await settle(a, b);
  a.actions.addSlide(deckId, first);
  b.actions.moveSlide(deckId, second, -1);
  await settle(a, b);
  same(a.state(), b.state());
  assert.equal(selectSlides(a.state(), deckId).length, 3);
  const slides = selectSlides(a.state(), deckId);
  a.actions.deleteDeck(deckId); await settle(a, b);
  b.actions.updateSlide(slides[0].id, { title: "ghost" }); await settle(a, b);
  assert.equal(selectDecks(a.state()).length, 0);
  assert.equal(selectSlides(b.state(), deckId).length, 0);
});

test("move up/down reorders", async () => {
  const s = new FakeServer(); const a = await makeClient(s, "u1", "Ana");
  const deckId = a.actions.createDeck("Move"); await settle(a);
  const s1 = selectSlides(a.state(), deckId)[0].id;
  const s2 = a.actions.addSlide(deckId, s1); const s3 = a.actions.addSlide(deckId, s2); await settle(a);
  a.actions.moveSlide(deckId, s3, -1); await settle(a);
  assert.deepEqual(selectSlides(a.state(), deckId).map((x) => x.id), [s1, s3, s2]);
  a.actions.moveSlide(deckId, s1, +1); await settle(a);
  assert.deepEqual(selectSlides(a.state(), deckId).map((x) => x.id), [s3, s1, s2]);
  a.actions.moveSlide(deckId, s3, -1); await settle(a); // already first: no change
  assert.deepEqual(selectSlides(a.state(), deckId).map((x) => x.id), [s3, s1, s2]);
});

test("offline: edits stay visible, are flagged unsaved, then save and reach others after reconnect", async () => {
  const s = new FakeServer();
  const a = await makeClient(s, "u1", "Ana"), b = await makeClient(s, "u2", "Ben");
  const deckId = a.actions.createDeck("Offline"); await settle(a, b);
  const id = selectSlides(a.state(), deckId)[0].id;
  a.transport.client.down = true;
  a.actions.updateSlide(id, { title: "typed while offline" });
  await wait(60);
  assert.equal(selectSlides(a.state(), deckId)[0].title, "typed while offline"); // still on screen
  assert.notEqual(a.engine.getSnapshot().saveState, "saved");
  assert.notEqual(selectSlides(b.state(), deckId)[0].title, "typed while offline");
  a.transport.client.down = false;
  a.engine.retry();
  await settle(a, b);
  assert.equal(a.engine.getSnapshot().saveState, "saved");
  assert.equal(selectSlides(b.state(), deckId)[0].title, "typed while offline");
});

test("reconnect catches up on edits missed while the live link was down", async () => {
  const s = new FakeServer();
  const a = await makeClient(s, "u1", "Ana"), b = await makeClient(s, "u2", "Ben");
  const deckId = a.actions.createDeck("Catchup"); await settle(a, b);
  const id = selectSlides(a.state(), deckId)[0].id;
  b.transport.client.handlers.onConnection("disconnected");
  const handlers = b.transport.client.handlers; b.transport.client.handlers = { ...handlers, onOp() {} }; // misses live pushes
  a.actions.updateSlide(id, { title: "missed by Ben" }); await settle(a);
  assert.notEqual(selectSlides(b.state(), deckId)[0].title, "missed by Ben");
  b.transport.client.handlers = handlers;
  assert.equal(b.engine.getSnapshot().connection, "offline");
  handlers.onConnection("connected");
  await wait(60);
  assert.equal(b.engine.getSnapshot().connection, "live");
  assert.equal(selectSlides(b.state(), deckId)[0].title, "missed by Ben");
});

test("rapid typing is merged into few messages", async () => {
  const s = new FakeServer(); const a = await makeClient(s, "u1", "Ana", { latency: 20 });
  const deckId = a.actions.createDeck("Merge"); await settle(a);
  const id = selectSlides(a.state(), deckId)[0].id; const before = s.sends;
  for (let i = 1; i <= 30; i++) a.actions.updateSlide(id, { body: "x".repeat(i) });
  await settle(a);
  assert.ok(s.sends - before <= 2, `sent ${s.sends - before} messages for 30 keystrokes`);
  assert.equal(selectSlides(a.state(), deckId)[0].body, "x".repeat(30));
});

test("tasks, resources link to a deck; a deleted deck unlinks them", async () => {
  const s = new FakeServer(); const a = await makeClient(s, "u1", "Ana"), b = await makeClient(s, "u2", "Ben");
  const deckId = a.actions.createDeck("Linked"); await settle(a, b);
  a.actions.saveTask({ title: "Write intro", status: "doing", deckId, due: "2026-10-14", owner: "Ben" });
  b.actions.saveResource({ title: "Brand kit", url: "https://example.com", category: "reference", deckId });
  await settle(a, b);
  assert.equal(selectTasks(b.state(), deckId).length, 1);
  assert.equal(selectResources(a.state(), deckId).length, 1);
  a.actions.deleteDeck(deckId); await settle(a, b);
  assert.equal(selectTasks(b.state())[0].deckId, null);
});

test("presence: peers appear, then expire", async () => {
  const s = new FakeServer(); const a = await makeClient(s, "u1", "Ana"), b = await makeClient(s, "u2", "Ben");
  a.actions.setFocus({ deckId: "d_x", slideId: "s_y" }); await wait(30);
  assert.deepEqual(b.engine.getSnapshot().presence.map((p) => [p.name, p.deckId, p.slideId]), [["Ana", "d_x", "s_y"]]);
  a.engine.stop(); await wait(30);
  assert.equal(b.engine.getSnapshot().presence.length, 0); // leaving message
});

test("hostile or broken messages are ignored or cleaned", () => {
  let st = initialState();
  const op = (ops) => ({ seq: 1, sentAt: 1, by: { uid: "x", name: "X" }, payload: { v: 1, ops } });
  st = applyOp(st, op([{ t: "set", k: "__proto__", id: "a", f: { title: "x" } }, { t: "set", k: "deck", id: "bad id!", f: { title: "x" } }, { t: "nope", k: "deck", id: "d1" }]));
  assert.equal(Object.keys(st.entities.deck).length, 0);
  st = applyOp(st, op([{ t: "set", k: "deck", id: "d1", f: { title: "T".repeat(999), theme: "evil", extra: 1 } }]));
  assert.equal(st.entities.deck.d1.title.length, 200);
  assert.equal(st.entities.deck.d1.theme, undefined);
  assert.equal(st.entities.deck.d1.extra, undefined);
  assert.equal(applyOp(st, { payload: "junk" }), st);
  assert.equal(isSafeUrl("javascript:alert(1)"), false);
  assert.equal(isSafeUrl("https://example.com/a?b=1"), true);
});

test("duplicate deliveries are ignored; a lost live message heals on reconcile", async () => {
  const s = new FakeServer();
  const a = await makeClient(s, "u1", "Ana"), b = await makeClient(s, "u2", "Ben");
  const deckId = a.actions.createDeck("Dupes"); await settle(a, b);
  const id = selectSlides(a.state(), deckId)[0].id;
  const handlers = b.transport.client.handlers;
  a.actions.updateSlide(id, { title: "once" }); await settle(a, b);
  const last = s.log[s.log.length - 1];
  handlers.onOp(last); handlers.onOp(last); handlers.onOp(last); // same op three more times
  assert.equal(selectSlides(b.state(), deckId)[0].title, "once");
  b.transport.client.handlers = { ...handlers, onOp() {} }; // Ben silently loses live pushes
  a.actions.updateSlide(id, { title: "lost live" }); await settle(a);
  assert.notEqual(selectSlides(b.state(), deckId)[0].title, "lost live");
  await b.engine.reconcile(); // what the 60 s timer / tab-focus does
  assert.equal(selectSlides(b.state(), deckId)[0].title, "lost live");
  same(a.state(), b.state());
});

test("three clients, random edits, random delays, random reordering: all end identical", async () => {
  const s = new FakeServer(); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const cs = [];
  for (const [u, n] of [["u1", "Ana"], ["u2", "Ben"], ["u3", "Cleo"]]) { const c = await makeClient(s, u, n, { latency: Math.floor(rnd() * 8) }); c.transport.client.reorder = true; cs.push(c); }
  const deckId = cs[0].actions.createDeck("Chaos"); await settle(...cs); await wait(60);
  for (let i = 0; i < 60; i++) {
    const c = cs[Math.floor(rnd() * 3)]; const slides = selectSlides(c.state(), deckId); const sl = slides[Math.floor(rnd() * slides.length)];
    const r = rnd();
    if (!sl || r < 0.2) c.actions.addSlide(deckId, sl?.id);
    else if (r < 0.3 && slides.length > 1) c.actions.deleteSlide(sl.id);
    else if (r < 0.45) c.actions.moveSlide(deckId, sl.id, rnd() < 0.5 ? -1 : 1);
    else if (r < 0.55) c.actions.duplicateSlide(deckId, sl.id);
    else c.actions.updateSlide(sl.id, { title: `t${i}`, body: `b${i}` });
    if (rnd() < 0.5) await wait(Math.floor(rnd() * 5));
  }
  await settle(...cs); await wait(120);
  for (const c of cs) await c.engine.reconcile();
  same(cs[0].state(), cs[1].state()); same(cs[1].state(), cs[2].state());
  assert.deepEqual(selectSlides(cs[0].state(), deckId).map((x) => x.id), selectSlides(cs[2].state(), deckId).map((x) => x.id));
});

test.after(() => started.forEach((e) => e.stop()));
