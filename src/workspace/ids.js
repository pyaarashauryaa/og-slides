// Short random ids for decks, slides, tasks and so on.
export function newId(prefix = "x") {
  let rand;
  if (typeof crypto !== "undefined" && crypto.randomUUID) rand = crypto.randomUUID().replace(/-/g, "").slice(0, 14);
  else rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `${prefix}_${rand}`;
}
