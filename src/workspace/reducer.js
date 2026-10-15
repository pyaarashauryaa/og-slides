// The heart of the shared workspace.
//
// Every edit is an "op" (one chat-style message stored by CometChat). The server
// gives each op a number (seq). Every browser replays ALL ops in seq order with the
// rules below, so every browser ends up with exactly the same workspace.
//
// Rules:
//  - "set" merges the given fields into an item. Later ops win, field by field.
//  - "del" marks an item deleted. Deleted is final: later "set" ops are ignored.
//  - Unknown kinds, bad ids and odd values are dropped (see model.js).

import { KINDS, isValidId, sanitizeFields } from "./model.js";

export function initialState() {
  const entities = {};
  for (const k of KINDS) entities[k] = {};
  return { entities };
}

const MAX_OPS_PER_MESSAGE = 50;

function applyOne(entities, o, op) {
  if (!o || typeof o !== "object") return entities;
  if (!KINDS.includes(o.k) || !isValidId(o.id)) return entities;
  const bucket = entities[o.k];
  const existing = bucket[o.id];
  const by = op.by?.name || "Someone";

  if (o.t === "del") {
    if (existing?.deleted) return entities;
    const next = { ...(existing || { id: o.id, createdAt: op.sentAt, createdBy: by }), deleted: true, updatedAt: op.sentAt, updatedBy: by };
    return { ...entities, [o.k]: { ...bucket, [o.id]: next } };
  }

  if (o.t === "set") {
    if (existing?.deleted) return entities;
    const fields = sanitizeFields(o.k, o.f);
    const base = existing || { id: o.id, createdAt: op.sentAt, createdBy: by, createdByUid: op.by?.uid };
    const next = { ...base, ...fields, updatedAt: op.sentAt, updatedBy: by };
    return { ...entities, [o.k]: { ...bucket, [o.id]: next } };
  }
  return entities;
}

export function applyOp(state, op) {
  const list = op?.payload?.ops;
  if (!Array.isArray(list)) return state;
  let entities = state.entities;
  for (const o of list.slice(0, MAX_OPS_PER_MESSAGE)) entities = applyOne(entities, o, op);
  return entities === state.entities ? state : { ...state, entities };
}
