// Per-person undo / redo for the editor.
//
// How it stays safe with teammates:
//  - Only YOUR OWN edits are in your history. You can never undo someone else's work.
//  - Undo changes a field back only if it still holds the value YOUR edit gave it.
//    If a teammate changed it since, that field is skipped and you are told.
//  - Deleted things cannot be revived in the shared log (deletes are final), so undoing a
//    delete re-creates the item under a NEW id. Older history entries are re-pointed to it.
import { fieldNames } from "../workspace/model.js";
import { newId } from "../workspace/ids.js";

const PREFIX = { deck: "d", slide: "s", el: "e", task: "t", resource: "r", decision: "n" };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createHistory({ getState, commit, now = () => Date.now(), limit = 100, coalesceMs = 1200 }) {
  let undoStack = [];
  let redoStack = [];
  const alias = new Map(); // old id -> new id after an undone delete
  const listeners = new Set();
  const emit = () => listeners.forEach((l) => l());
  const resolve = (id) => {
    let cur = id;
    for (let i = 0; i < 20 && alias.has(cur); i++) cur = alias.get(cur);
    return cur;
  };
  const entityOf = (k, id) => {
    const e = getState().entities[k]?.[resolve(id)];
    return e && !e.deleted ? e : null;
  };
  const snapshot = (k, e) => {
    const out = {};
    for (const f of fieldNames(k)) if (e[f] !== undefined) out[f] = e[f];
    return out;
  };

  // Run ops now, and remember how to reverse them.
  function run(ops, { key = null } = {}) {
    if (!ops || !ops.length) return;
    const changes = [];
    for (const o of ops) {
      const cur = entityOf(o.k, o.id);
      if (o.t === "del") {
        if (cur) changes.push({ k: o.k, id: o.id, before: snapshot(o.k, cur), after: null });
      } else if (cur) {
        const before = {};
        for (const f of Object.keys(o.f)) before[f] = cur[f];
        changes.push({ k: o.k, id: o.id, before, after: { ...o.f } });
      } else {
        changes.push({ k: o.k, id: o.id, before: null, after: { ...o.f } });
      }
    }
    commit(ops);
    if (!changes.length) return;
    const last = undoStack[undoStack.length - 1];
    if (key && last && last.key === key && now() - last.at < coalesceMs && last.changes.length === 1 && changes.length === 1 && last.changes[0].id === changes[0].id && last.changes[0].after && changes[0].after) {
      last.changes[0].after = { ...last.changes[0].after, ...changes[0].after };
      for (const f of Object.keys(changes[0].before || {})) if (!(f in last.changes[0].before)) last.changes[0].before[f] = changes[0].before[f];
      last.at = now();
    } else {
      undoStack.push({ key, at: now(), changes });
      if (undoStack.length > limit) undoStack.shift();
    }
    redoStack = [];
    emit();
  }

  const remap = (fields) => {
    const out = { ...fields };
    if (typeof out.slideId === "string") out.slideId = resolve(out.slideId);
    if (typeof out.deckId === "string") out.deckId = resolve(out.deckId);
    return out;
  };

  // direction "undo": go back to `before`; "redo": go forward to `after`.
  function step(from, to, dir) {
    const entry = from.pop();
    if (!entry) return { done: false };
    const ops = [];
    let skipped = 0;
    const list = dir === "undo" ? [...entry.changes].reverse() : entry.changes;
    for (const ch of list) {
      const target = dir === "undo" ? ch.before : ch.after;
      const current = dir === "undo" ? ch.after : ch.before;
      const exists = entityOf(ch.k, ch.id);
      if (target === null) {
        // reverse of a creation (undo) or redo of a deletion: delete it
        if (exists) ops.push({ t: "del", k: ch.k, id: resolve(ch.id) });
        else skipped++;
      } else if (current === null) {
        // reverse of a deletion (undo) or redo of a creation: bring it back under a new id
        if (exists) { skipped++; continue; }
        const fresh = newId(PREFIX[ch.k] || "x");
        alias.set(ch.id, fresh);
        ops.push({ t: "set", k: ch.k, id: fresh, f: remap(target) });
      } else if (!exists) {
        skipped++;
      } else {
        const f = {};
        for (const name of Object.keys(target)) {
          if (name in (current || {}) && !same(exists[name], current[name])) { skipped++; continue; } // a teammate changed it
          if (!same(exists[name], target[name])) f[name] = remap({ v: target[name] }).v;
        }
        if (Object.keys(f).length) ops.push({ t: "set", k: ch.k, id: resolve(ch.id), f });
      }
    }
    if (ops.length) commit(ops);
    to.push(entry);
    emit();
    return { done: true, skipped, changed: ops.length > 0 };
  }

  return {
    run,
    undo: () => step(undoStack, redoStack, "undo"),
    redo: () => step(redoStack, undoStack, "redo"),
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
    subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    clear: () => { undoStack = []; redoStack = []; alias.clear(); emit(); },
    _debug: () => ({ undo: undoStack.length, redo: redoStack.length }),
  };
}
