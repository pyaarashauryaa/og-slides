// Phase 6 logic: quick-jump search, toast flood protection, and honest conflict detection.
// Run with:  npm.cmd run test:phase6
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { buildCommands, filterCommands, pageForShortcut } from "../src/ui/commandLogic.js";
import { mergeToast } from "../src/ui/toastLogic.js";
import { createOverwriteTracker, describeValue, conflictTitle } from "../src/workspace/conflicts.js";
import { createEngine } from "../src/workspace/engine.js";
import { createActions } from "../src/workspace/actions.js";
import { selectTasks } from "../src/workspace/selectors.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const engines = [];
after(() => engines.forEach((e) => e.stop()));

/* ---------- quick jump ---------- */
test("quick jump: typing narrows pages, decks and actions sensibly", () => {
  const cmds = buildCommands([{ id: "d1", title: "Investor pitch" }, { id: "d2", title: "" }], { canCreate: true, callsAvailable: true });
  assert.equal(filterCommands(cmds, "task")[0].id, "go:tasks");
  assert.equal(filterCommands(cmds, "inv")[0].id, "deck:d1");
  assert.ok(filterCommands(cmds, "new").some((c) => c.id === "act:create"), "keywords find actions");
  assert.equal(filterCommands(cmds, "tmch")[0].id, "go:chat", "letters in order still match");
  assert.deepEqual(filterCommands(cmds, "zzzzqq"), []);
  assert.equal(filterCommands(cmds, "").length, cmds.length, "empty query shows everything");
  assert.equal(cmds.find((c) => c.id === "deck:d2").label, "Untitled presentation");
});
test("quick jump: call actions only appear when calling works and you are not already in a call", () => {
  const ids = (o) => buildCommands([], o).map((c) => c.id);
  assert.ok(!ids({ callsAvailable: false }).includes("act:voice"));
  assert.ok(!ids({ callsAvailable: true, inCall: true }).includes("act:ring"));
  assert.ok(ids({ callsAvailable: true }).includes("act:ring"));
  assert.ok(!ids({ canCreate: false }).includes("act:create"));
});
test("Alt+number maps to pages in sidebar order and ignores other keys", () => {
  assert.equal(pageForShortcut("1"), "home");
  assert.equal(pageForShortcut("6"), "decisions");
  assert.equal(pageForShortcut("7"), null);
  assert.equal(pageForShortcut("a"), null);
});

/* ---------- toasts ---------- */
test("toasts: the same message does not stack, it counts up", () => {
  let items = [];
  let r = mergeToast(items, { id: 1, text: "Could not save", kind: "error" }); items = r.items;
  r = mergeToast(items, { id: 2, text: "Could not save", kind: "error" });
  assert.equal(r.items.length, 1); assert.equal(r.items[0].count, 2); assert.equal(r.id, 1); assert.equal(r.refreshed, true);
  r = mergeToast(r.items, { id: 3, text: "Could not save", kind: "info" });
  assert.equal(r.items.length, 2, "different kind is a different message");
});
test("toasts: at most four are shown, oldest leave first", () => {
  let items = [];
  for (let i = 1; i <= 6; i++) items = mergeToast(items, { id: i, text: `m${i}`, kind: "info" }).items;
  assert.deepEqual(items.map((t) => t.text), ["m3", "m4", "m5", "m6"]);
});

/* ---------- conflict tracker (pure) ---------- */
const op = (seq, uid, name, ops, sentAt = Date.now()) => ({ seq, sentAt, by: { uid, name }, payload: { ops } });
const set = (k, id, f) => ({ t: "set", k, id, f });

test("conflict: a teammate replacing a field I just saved is reported, with both values", () => {
  const t = createOverwriteTracker({ selfUid: "me" });
  t.recordMine(op(10, "me", "Me", [set("task", "t1", { title: "Ship v2", status: "doing" })]));
  const found = t.checkRemote(op(11, "u2", "Priya", [set("task", "t1", { title: "Ship v3" })]));
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, "replaced");
  assert.equal(found[0].mine, "Ship v2"); assert.equal(found[0].theirs, "Ship v3"); assert.equal(found[0].by, "Priya");
  assert.match(conflictTitle(found[0]), /Priya changed the task title after you did/);
});
test("conflict: edits to DIFFERENT fields never conflict (they merge)", () => {
  const t = createOverwriteTracker({ selfUid: "me" });
  t.recordMine(op(10, "me", "Me", [set("task", "t1", { title: "Ship v2" })]));
  assert.equal(t.checkRemote(op(11, "u2", "Priya", [set("task", "t1", { owner: "Priya", status: "done" })])).length, 0);
});
test("conflict: the same value from both people is not a conflict, and nothing is reported twice", () => {
  const t = createOverwriteTracker({ selfUid: "me" });
  t.recordMine(op(10, "me", "Me", [set("slide", "s1", { title: "Same" })]));
  assert.equal(t.checkRemote(op(11, "u2", "P", [set("slide", "s1", { title: "Same" })])).length, 0);
  t.recordMine(op(12, "me", "Me", [set("slide", "s1", { title: "A" })]));
  assert.equal(t.checkRemote(op(13, "u2", "P", [set("slide", "s1", { title: "B" })])).length, 1);
  assert.equal(t.checkRemote(op(14, "u3", "Q", [set("slide", "s1", { title: "C" })])).length, 0, "my edit was already replaced once");
});
test("conflict: an older op that arrives late (lower seq) did not replace mine", () => {
  const t = createOverwriteTracker({ selfUid: "me" });
  t.recordMine(op(20, "me", "Me", [set("task", "t1", { title: "Mine" })]));
  assert.equal(t.checkRemote(op(15, "u2", "P", [set("task", "t1", { title: "Theirs" })])).length, 0);
});
test("conflict: old edits (outside the time window) are forgotten", () => {
  let clock = 1000;
  const t = createOverwriteTracker({ selfUid: "me", windowMs: 500, now: () => clock });
  t.recordMine(op(10, "me", "Me", [set("task", "t1", { title: "Mine" })], 1000));
  clock = 5000;
  assert.equal(t.checkRemote(op(11, "u2", "P", [set("task", "t1", { title: "Theirs" })], 5000)).length, 0);
  // history re-read long after the fact is never "recent"
  const t2 = createOverwriteTracker({ selfUid: "me", windowMs: 500, now: () => 9000 });
  t2.recordMine(op(1, "me", "Me", [set("task", "t1", { title: "Old" })], 1000));
  assert.equal(t2.size(), 0);
});
test("conflict: a teammate deleting something I just edited is reported as deleted", () => {
  const t = createOverwriteTracker({ selfUid: "me" });
  t.recordMine(op(10, "me", "Me", [set("decision", "n1", { title: "Pink theme" })]));
  const found = t.checkRemote(op(11, "u2", "Ben", [{ t: "del", k: "decision", id: "n1" }]));
  assert.equal(found.length, 1); assert.equal(found[0].kind, "deleted");
  assert.match(conflictTitle(found[0]), /Ben deleted a decision you just edited/);
});
test("conflict: fields that are noise (position, size) are never tracked", () => {
  const t = createOverwriteTracker({ selfUid: "me" });
  t.recordMine(op(10, "me", "Me", [set("el", "e1", { x: 10, y: 20, w: 100 })]));
  assert.equal(t.size(), 0);
});
test("describeValue never dumps raw data into the interface", () => {
  assert.equal(describeValue("title", ""), "(empty)");
  assert.equal(describeValue("src", "data:image/png;base64,AAAA"), "a different picture");
  assert.match(describeValue("tdata", JSON.stringify([["a"], ["b"]])), /table \(2 rows\)/);
  assert.ok(describeValue("body", "x".repeat(300)).length <= 80);
});

/* ---------- through the real engine with a fake server ---------- */
class Server {
  constructor() { this.seq = 100; this.log = []; this.clients = new Set(); }
  transport(user) {
    const server = this; const c = { handlers: null }; this.clients.add(c);
    return {
      async connect() {}, async fetchHistory() { return [...server.log]; },
      async send(payload) {
        await wait(2);
        const o = { seq: ++server.seq, sentAt: Date.now(), by: user, payload: JSON.parse(JSON.stringify(payload)) };
        server.log.push(o);
        for (const x of server.clients) if (x !== c && x.handlers) x.handlers.onOp(o);
        return o;
      },
      subscribe(h) { c.handlers = h; return () => { c.handlers = null; }; }, sendPresence() {},
    };
  }
}
async function client(server, uid, name) {
  const self = { uid, name };
  const engine = createEngine({ transport: server.transport(self), self, options: { retryBaseMs: 10, tickMs: 1000, presenceEveryMs: 100000, reconcileEveryMs: 100000 } });
  await engine.start(); engines.push(engine);
  return { engine, actions: createActions(engine), snap: () => engine.getSnapshot() };
}
const quiet = async (...cs) => { for (let i = 0; i < 30; i++) { await wait(10); if (cs.every((c) => c.snap().pending === 0)) break; } await wait(20); };

test("engine: the person whose edit is replaced gets a conflict card; the winner does not", async () => {
  const s = new Server();
  const a = await client(s, "ua", "Ana"), b = await client(s, "ub", "Ben");
  const id = a.actions.saveTask({ title: "Draft", status: "todo" });
  await quiet(a, b);
  a.actions.saveTask({ title: "Ana's wording" }, id);
  await quiet(a, b);
  b.actions.saveTask({ title: "Ben's wording" }, id);
  await quiet(a, b);
  assert.equal(selectTasks(a.snap().state)[0].title, "Ben's wording", "last writer wins, everywhere");
  assert.equal(a.snap().conflicts.length, 1);
  assert.equal(a.snap().conflicts[0].by, "Ben");
  assert.equal(b.snap().conflicts.length, 0, "the writer who won is not told they lost");
});
test("engine: Restore mine saves my version again; Keep theirs just dismisses", async () => {
  const s = new Server();
  const a = await client(s, "ua", "Ana"), b = await client(s, "ub", "Ben");
  const id = a.actions.saveTask({ title: "Draft", status: "todo" });
  await quiet(a, b);
  a.actions.saveTask({ title: "Ana v1" }, id); await quiet(a, b);
  b.actions.saveTask({ title: "Ben v1" }, id); await quiet(a, b);
  const c = a.snap().conflicts[0];
  a.actions.resolveConflict(c.id, "mine");
  await quiet(a, b);
  assert.equal(a.snap().conflicts.length, 0);
  assert.equal(selectTasks(b.snap().state)[0].title, "Ana v1", "Ben now sees Ana's restored version");
  // Ben's own edit was just replaced by Ana's restore, so Ben gets the card (nothing is silent)
  assert.equal(b.snap().conflicts.length, 1);
  b.actions.resolveConflict(b.snap().conflicts[0].id, "theirs");
  assert.equal(b.snap().conflicts.length, 0);
  assert.equal(selectTasks(b.snap().state)[0].title, "Ana v1");
});
test("engine: edits to different fields at the same time raise no conflict at all", async () => {
  const s = new Server();
  const a = await client(s, "ua", "Ana"), b = await client(s, "ub", "Ben");
  const id = a.actions.saveTask({ title: "Task", status: "todo" });
  await quiet(a, b);
  a.actions.saveTask({ title: "Ana title" }, id);
  b.actions.saveTask({ owner: "Ben" }, id);
  await quiet(a, b);
  assert.equal(a.snap().conflicts.length + b.snap().conflicts.length, 0);
  const t = selectTasks(a.snap().state)[0];
  assert.equal(t.title, "Ana title"); assert.equal(t.owner, "Ben");
});
test("engine: history loaded at start never produces conflicts", async () => {
  const s = new Server();
  const a = await client(s, "ua", "Ana");
  const id = a.actions.saveTask({ title: "One" }); await quiet(a);
  const b = await client(s, "ub", "Ben"); b.actions.saveTask({ title: "Two" }, id); await quiet(a, b);
  const late = await client(s, "ua", "Ana");
  assert.equal(late.snap().conflicts.length, 0);
});
