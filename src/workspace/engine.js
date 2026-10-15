// The sync engine. It has no React and no CometChat inside, only a "transport"
// (see transports/). That keeps it small, testable, and swappable for a real
// database later.
//
// transport = {
//   connect(): Promise<void>                       // get ready (join the group, etc.)
//   fetchHistory(): Promise<Op[]>                  // every op ever saved
//   send(payload): Promise<Op>                     // save one op; resolves with the saved op
//   subscribe({onOp, onPresence, onConnection}): unsubscribeFn
//   sendPresence(data): void                       // live-only "I'm here" signals
// }
// Op = { seq:number, sentAt:ms, by:{uid,name}, payload }

import { initialState, applyOp } from "./reducer.js";
import { newId } from "./ids.js";
import { createOverwriteTracker } from "./conflicts.js";
import { cleanCursor, CURSOR_GONE_MS } from "./cursors.js";

const PENDING_SEQ = Number.MAX_SAFE_INTEGER;
const unref = (t) => (t && typeof t === "object" && t.unref ? t.unref() : t);

export function createEngine({ transport, self, options = {} }) {
  const opts = {
    presenceEveryMs: 5000,
    presenceTtlMs: 15000,
    tickMs: 3000,
    retryBaseMs: 1500,
    maxAutoRetries: 4,
    reconcileEveryMs: 60000, // re-read the full history now and then, so a lost live message heals itself
    ...options,
  };

  let phase = "idle"; // idle | loading | ready | error
  let connection = "live"; // live | connecting | offline
  let error = null;

  const confirmed = new Map(); // seq -> op
  let confirmedState = initialState();
  let lastSeq = -Infinity;

  const queue = []; // my own edits that are not saved yet: {cid, payload, at, status, attempts}
  let sending = false;
  let retryTimer = null;

  const peers = new Map(); // uid -> {uid,name,deckId,slideId,seen}
  let focus = { deckId: null, slideId: null, elId: null };
  let away = false;
  // Live pointer positions of teammates. Kept apart from the main snapshot on purpose: they change many times a
  // second and must not re-render the whole app.
  const cursors = new Map(); // uid -> {uid,name,deckId,slideId,x,y,at}
  let cursorSnap = [];
  const cursorListeners = new Set();
  const publishCursors = () => { cursorSnap = [...cursors.values()]; cursorListeners.forEach((fn) => fn()); };
  const dropCursor = (uid) => { if (cursors.delete(uid)) publishCursors(); };

  let unsubscribe = null;
  let tickTimer = null;
  let heartbeatTimer = null;
  let reconcileTimer = null;
  let stopped = false;

  // Collisions we can prove from the saved history (see conflicts.js). Newest last, at most 6.
  const tracker = createOverwriteTracker({ selfUid: self.uid });
  let conflicts = [];
  const MAX_CONFLICTS = 6;

  const listeners = new Set();
  let snapshot = null;

  // ---------- helpers ----------
  function rebuild() {
    const sorted = [...confirmed.values()].sort((a, b) => a.seq - b.seq);
    confirmedState = sorted.reduce(applyOp, initialState());
    lastSeq = sorted.length ? sorted[sorted.length - 1].seq : -Infinity;
  }

  // Add saved ops. Returns true if anything new arrived.
  function ingest(ops) {
    let changed = false;
    let needRebuild = false;
    const fresh = [];
    for (const op of ops || []) {
      if (!op || typeof op.seq !== "number" || !Number.isFinite(op.seq) || confirmed.has(op.seq)) continue;
      confirmed.set(op.seq, op);
      fresh.push(op);
      changed = true;
      if (op.seq > lastSeq) {
        confirmedState = applyOp(confirmedState, op);
        lastSeq = op.seq;
      } else {
        needRebuild = true; // an older op arrived late: replay everything in order
      }
    }
    if (needRebuild) rebuild();
    // Only after the first full load: older history is not "a collision that just happened".
    if (phase === "ready") {
      for (const op of fresh.sort((a, b) => a.seq - b.seq)) {
        if (op.by?.uid === self.uid) tracker.recordMine(op);
        else {
          const found = tracker.checkRemote(op);
          if (found.length) conflicts = [...conflicts, ...found.filter((c) => !conflicts.some((x) => x.id === c.id))].slice(-MAX_CONFLICTS);
        }
      }
    }
    return changed;
  }

  function view() {
    let s = confirmedState;
    for (const q of queue) s = applyOp(s, { seq: PENDING_SEQ, sentAt: q.at, by: self, payload: q.payload });
    return s;
  }

  function saveState() {
    if (!queue.length) return "saved";
    if (queue.some((q) => q.status === "failed")) return "failed";
    if (connection === "offline") return "offline";
    return "saving";
  }

  function activePeers() {
    const now = Date.now();
    return [...peers.values()].filter((p) => now - p.seen <= opts.presenceTtlMs);
  }

  function emit() {
    snapshot = {
      phase,
      connection,
      error,
      state: view(),
      pending: queue.length,
      saveState: saveState(),
      presence: activePeers(),
      self,
      focus,
      conflicts,
    };
    listeners.forEach((fn) => fn());
  }

  // ---------- saving my edits ----------
  async function pump() {
    if (sending || stopped || phase !== "ready" || retryTimer || !queue.length) return;
    const item = queue[0];
    sending = true;
    item.status = "sending";
    emit();
    let failed = false;
    try {
      const op = await transport.send(item.payload);
      queue.shift();
      ingest([op]);
    } catch (e) {
      failed = true;
      item.status = "failed";
      item.attempts += 1;
      item.lastError = e;
      if (item.attempts <= opts.maxAutoRetries) {
        retryTimer = unref(setTimeout(() => {
          retryTimer = null;
          item.status = "queued";
          pump();
        }, opts.retryBaseMs * 2 ** (item.attempts - 1)));
      }
    } finally {
      sending = false;
    }
    emit();
    if (!failed) pump();
  }

  // ---------- presence ----------
  function sendPresence(extra) {
    try {
      transport.sendPresence({ t: "presence", uid: self.uid, name: self.name, deckId: focus.deckId, slideId: focus.slideId, elId: focus.elId, away, ...extra });
    } catch {
      /* live-only signal: failing silently is fine */
    }
  }

  function onPresence(data) {
    if (data && data.t === "cursor") { onCursor(data); return; }
    if (!data || data.t !== "presence" || typeof data.uid !== "string" || data.uid === self.uid) return;
    const isNew = !peers.has(data.uid);
    if (data.leaving) {
      dropCursor(data.uid);
      if (peers.delete(data.uid)) emit();
      return;
    }
    peers.set(data.uid, {
      uid: data.uid,
      name: typeof data.name === "string" ? data.name.slice(0, 80) : "Teammate",
      deckId: typeof data.deckId === "string" ? data.deckId : null,
      slideId: typeof data.slideId === "string" ? data.slideId : null,
      elId: typeof data.elId === "string" ? data.elId : null, // the element they have selected, if any
      away: data.away === true,                              // their tab is in the background (Page Visibility)
      seen: Date.now(),
    });
    const c = cursors.get(data.uid);
    if (c && (c.deckId !== (typeof data.deckId === "string" ? data.deckId : null) || c.slideId !== (typeof data.slideId === "string" ? data.slideId : null))) dropCursor(data.uid); // they moved on
    if (isNew) sendPresence(); // tell the newcomer who we are straight away
    emit();
  }

  function onCursor(data) {
    const c = cleanCursor(data);
    if (!c || c.uid === self.uid) return;
    if (c.x === null) { dropCursor(c.uid); return; }
    cursors.set(c.uid, { ...c, at: Date.now() });
    publishCursors();
  }

  // Only worth sending when someone else is looking at the same presentation.
  function sendCursor(point) {
    if (phase !== "ready" || !focus.deckId) return;
    if (!activePeers().some((p) => p.deckId === focus.deckId)) return;
    try {
      transport.sendPresence({ t: "cursor", uid: self.uid, name: self.name, deckId: focus.deckId, slideId: focus.slideId, x: point ? point.x : null, y: point ? point.y : null });
    } catch {
      /* live-only signal: failing silently is fine */
    }
  }

  function setAway(next) {
    if (away === next) return;
    away = next;
    if (phase === "ready") sendPresence();
  }

  // ---------- connection ----------
  async function refreshHistory() {
    try {
      if (ingest(await transport.fetchHistory())) emit();
    } catch {
      /* the next reconnect or retry will try again */
    }
  }

  function onConnection(status) {
    const next = status === "connected" ? "live" : status === "connecting" ? "connecting" : "offline";
    if (next === connection) return;
    const wasLive = connection === "live";
    connection = next;
    if (next !== "live" && cursors.size) { cursors.clear(); publishCursors(); } // stale positions are worse than none
    emit();
    if (next === "live" && !wasLive && phase === "ready") {
      refreshHistory().then(() => {
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        if (queue[0]?.status === "failed") queue[0].status = "queued";
        pump();
      });
    }
  }

  // ---------- public API ----------
  async function start() {
    phase = "loading";
    error = null;
    emit();
    try {
      await transport.connect();
      if (stopped) return;
      unsubscribe = transport.subscribe({
        onOp: (op) => {
          if (ingest([op])) emit();
        },
        onPresence,
        onConnection,
      });
      ingest(await transport.fetchHistory());
      if (stopped) return;
      phase = "ready";
      emit();
      tickTimer = unref(setInterval(() => {
        const before = peers.size;
        const now = Date.now();
        for (const [uid, p] of peers) if (now - p.seen > opts.presenceTtlMs) { peers.delete(uid); cursors.delete(uid); }
        let dropped = false;
        for (const [uid, c] of cursors) if (now - c.at > CURSOR_GONE_MS) { cursors.delete(uid); dropped = true; }
        if (dropped || cursors.size !== cursorSnap.length) publishCursors();
        if (peers.size !== before) emit();
      }, opts.tickMs));
      heartbeatTimer = unref(setInterval(() => sendPresence(), opts.presenceEveryMs));
      reconcileTimer = unref(setInterval(() => refreshHistory(), opts.reconcileEveryMs));
      sendPresence();
      pump();
    } catch (e) {
      if (stopped) return;
      phase = "error";
      error = e;
      emit();
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    clearInterval(tickTimer);
    clearInterval(heartbeatTimer);
    clearInterval(reconcileTimer);
    clearTimeout(retryTimer);
    if (phase === "ready") sendPresence({ leaving: true });
    if (unsubscribe) unsubscribe();
  }

  // ops: [{t:'set'|'del', k, id, f?}]. Returns the id of this message.
  function commit(ops) {
    // A big action (duplicating a slide with many elements) is split into several
    // messages: the reducer reads at most 50 ops per message and CometChat limits
    // a message to 65,536 characters.
    const chunks = [];
    let cur = [];
    let size = 0;
    for (const o of ops) {
      const n = JSON.stringify(o).length;
      if (cur.length && (cur.length >= 40 || size + n > 30000)) {
        chunks.push(cur);
        cur = [];
        size = 0;
      }
      cur.push(o);
      size += n;
    }
    if (cur.length) chunks.push(cur);
    let cid = null;
    for (const c of chunks) cid = commitOne(c);
    return cid;
  }

  function commitOne(ops) {
    const payload = { v: 1, cid: newId("c"), ops };
    const last = queue[queue.length - 1];
    // Merge rapid edits to the same item into one message (typing = many keystrokes).
    if (
      last && last.status === "queued" &&
      last.payload.ops.length === 1 && ops.length === 1 &&
      last.payload.ops[0].t === "set" && ops[0].t === "set" &&
      last.payload.ops[0].k === ops[0].k && last.payload.ops[0].id === ops[0].id
    ) {
      last.payload = { ...last.payload, ops: [{ ...last.payload.ops[0], f: { ...last.payload.ops[0].f, ...ops[0].f } }] };
      last.at = Date.now();
    } else {
      queue.push({ cid: payload.cid, payload, at: Date.now(), status: "queued", attempts: 0 });
    }
    emit();
    pump();
    return payload.cid;
  }

  function retry() {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (queue[0]) {
      queue[0].status = "queued";
      queue[0].attempts = 0;
    }
    pump();
  }

  // "mine": save my version again (it will replace theirs, and the card says so). "theirs": keep what is shown.
  function resolveConflict(id, how) {
    const c = conflicts.find((x) => x.id === id);
    conflicts = conflicts.filter((x) => x.id !== id);
    if (c && how === "mine" && c.kind === "replaced") commit([{ t: "set", k: c.k, id: c.entityId, f: { [c.field]: c.mine } }]);
    else emit();
  }

  function setFocus(next) {
    const f = { deckId: next?.deckId || null, slideId: next?.slideId || null, elId: next?.elId || null };
    if (f.deckId === focus.deckId && f.slideId === focus.slideId && f.elId === focus.elId) return;
    focus = f;
    if (phase === "ready") sendPresence();
    emit();
  }

  snapshot = {
    phase, connection, error, state: initialState(), pending: 0, saveState: "saved", presence: [], self, focus, conflicts: [],
  };

  return {
    start,
    stop,
    commit,
    retry,
    resolveConflict,
    reconcile: refreshHistory,
    uploadImage: (file) => (transport.uploadImage ? transport.uploadImage(file) : Promise.reject(new Error("This connection cannot store pictures."))),
    setFocus,
    setAway,
    sendCursor,
    getCursors: () => cursorSnap,
    subscribeCursors(fn) {
      cursorListeners.add(fn);
      return () => cursorListeners.delete(fn);
    },
    getSnapshot: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
