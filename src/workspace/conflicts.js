// Honest conflict detection for the shared workspace.
//
// What the sync engine really knows: every edit becomes an op with a server number (seq) and the
// author. When two people change the SAME field, the op with the higher seq wins (the reducer is
// "last writer wins, field by field"). Nothing is merged, so exactly one version survives.
//
// This module notices the moment that happens to YOU: you saved a value, and a teammate then
// saved a different value for the very same field. It does not guess about edits it cannot see
// (for example text still being typed on another computer): it only reports what the saved
// history proves. Edits to different fields are never reported (they merge cleanly).

// Fields whose loss a person would care about. Position, size and z-order are left out on purpose
// (two people nudging the same box is normal and would be noise).
export const WATCHED = {
  deck: ["title", "theme", "transition"],
  slide: ["title", "body", "layout", "notes"],
  el: ["text", "src", "tdata", "cdata", "ctitle"],
  task: ["title", "status", "due", "owner"],
  resource: ["title", "url", "category"],
  decision: ["title", "content"],
};

export const KIND_LABEL = { deck: "presentation", slide: "slide", el: "slide item", task: "task", resource: "link", decision: "decision" };
export const FIELD_LABEL = {
  title: "title", theme: "theme", transition: "transition", body: "text", layout: "layout", notes: "speaker notes",
  text: "text", src: "picture", tdata: "table contents", cdata: "chart data", ctitle: "chart title",
  status: "status", due: "due date", owner: "owner", url: "link", category: "type", content: "details",
};
export const RECENT_MS = 120000; // only edits from the last two minutes can "collide" with a new arrival

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const MAX_SHOWN = 80;

// A short, human description of a value (never dumps raw JSON or a data URL into the UI).
export function describeValue(field, value) {
  if (value === undefined || value === null || value === "") return "(empty)";
  if (field === "src") return "a different picture";
  if (field === "tdata") {
    try { const rows = JSON.parse(value); return `a table (${rows.length} rows)`; } catch { return "table contents"; }
  }
  if (field === "cdata") return "chart data";
  const s = String(value).replace(/\s+/g, " ").trim();
  return s.length > MAX_SHOWN ? `${s.slice(0, MAX_SHOWN - 1)}…` : s;
}

export function createOverwriteTracker({ selfUid, windowMs = RECENT_MS, now = Date.now }) {
  const mine = new Map(); // "kind:id:field" -> { value, seq, at }

  const setsOf = (op) => (Array.isArray(op?.payload?.ops) ? op.payload.ops : []);

  return {
    // Call for every saved op that is mine.
    recordMine(op) {
      if (!op || typeof op.seq !== "number") return;
      // Use the time the edit was really saved, so re-reading old history never creates "recent" edits.
      const at = Math.min(now(), typeof op.sentAt === "number" ? op.sentAt : now());
      if (now() - at > windowMs) return;
      for (const o of setsOf(op)) {
        if (o?.t !== "set" || !WATCHED[o.k] || !o.f) continue;
        for (const f of WATCHED[o.k]) {
          if (f in o.f) mine.set(`${o.k}:${o.id}:${f}`, { value: o.f[f], seq: op.seq, at });
        }
      }
    },
    // Call for every saved op that belongs to someone else. Returns the collisions it proves.
    checkRemote(op) {
      const out = [];
      if (!op || typeof op.seq !== "number") return out;
      const by = op.by?.name || "A teammate";
      const t = now();
      for (const o of setsOf(op)) {
        if (!o || !WATCHED[o.k]) continue;
        if (o.t === "del") {
          for (const key of [...mine.keys()]) {
            if (!key.startsWith(`${o.k}:${o.id}:`)) continue;
            const e = mine.get(key);
            mine.delete(key);
            if (t - e.at > windowMs || op.seq <= e.seq) continue;
            const field = key.split(":")[2];
            out.push({ id: `${key}:${op.seq}`, kind: "deleted", k: o.k, entityId: o.id, field, mine: e.value, theirs: null, by, at: t });
          }
        } else if (o.t === "set" && o.f) {
          for (const f of WATCHED[o.k]) {
            if (!(f in o.f)) continue;
            const key = `${o.k}:${o.id}:${f}`;
            const e = mine.get(key);
            if (!e) continue;
            if (t - e.at > windowMs || op.seq <= e.seq) { mine.delete(key); continue; }
            mine.delete(key);
            if (same(e.value, o.f[f])) continue; // they saved the same thing: nothing was lost
            out.push({ id: `${key}:${op.seq}`, kind: "replaced", k: o.k, entityId: o.id, field: f, mine: e.value, theirs: o.f[f], by, at: t });
          }
        }
      }
      return out;
    },
    size: () => mine.size,
  };
}

// Plain-language sentence for a conflict card.
export function conflictTitle(c) {
  const what = `${KIND_LABEL[c.k] || "item"} ${FIELD_LABEL[c.field] || c.field}`;
  return c.kind === "deleted" ? `${c.by} deleted a ${KIND_LABEL[c.k] || "item"} you just edited` : `${c.by} changed the ${what} after you did`;
}
