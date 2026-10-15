// Turns the raw workspace into the lists the screens need.
const live = (bucket) => Object.values(bucket).filter((e) => !e.deleted);
const bySlidePos = (a, b) => a.pos - b.pos || (a.id < b.id ? -1 : 1);

export function deckExists(state, deckId) {
  const d = state.entities.deck[deckId];
  return Boolean(d && !d.deleted);
}

export function selectSlides(state, deckId) {
  if (!deckExists(state, deckId)) return [];
  return live(state.entities.slide)
    .filter((s) => s.deckId === deckId)
    .map((s) => ({ ...s, pos: typeof s.pos === "number" ? s.pos : 0 }))
    .sort(bySlidePos);
}

export function selectDecks(state) {
  const slides = live(state.entities.slide);
  return live(state.entities.deck)
    .map((d) => {
      const mine = slides.filter((s) => s.deckId === d.id).map((s) => ({ ...s, pos: typeof s.pos === "number" ? s.pos : 0 })).sort(bySlidePos);
      let updatedAt = d.updatedAt;
      let updatedBy = d.updatedBy;
      for (const s of mine) {
        if (s.updatedAt > updatedAt) {
          updatedAt = s.updatedAt;
          updatedBy = s.updatedBy;
        }
      }
      return { ...d, firstSlide: mine[0] || null, slideCount: mine.length, updatedAt, updatedBy };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function selectDeck(state, deckId) {
  return selectDecks(state).find((d) => d.id === deckId) || null;
}

// A link to a deleted presentation counts as "no link".
function cleanDeckId(state, deckId) {
  return deckId && deckExists(state, deckId) ? deckId : null;
}

export function selectTasks(state, deckId) {
  return live(state.entities.task)
    .map((t) => ({ ...t, deckId: cleanDeckId(state, t.deckId), status: t.status || "todo" }))
    .filter((t) => !deckId || t.deckId === deckId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function selectResources(state, deckId) {
  return live(state.entities.resource)
    .map((r) => ({ ...r, deckId: cleanDeckId(state, r.deckId), category: r.category || "other" }))
    .filter((r) => !deckId || r.deckId === deckId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function selectDecisions(state, deckId) {
  return live(state.entities.decision)
    .map((d) => ({ ...d, deckId: cleanDeckId(state, d.deckId) }))
    .filter((d) => !deckId || d.deckId === deckId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function deckTitle(state, deckId) {
  const d = state.entities.deck[deckId];
  return d && !d.deleted ? d.title || "Untitled presentation" : null;
}

// Names of everyone who has ever edited something: handy for "owner" suggestions.
export function knownPeople(state) {
  const names = new Set();
  for (const bucket of Object.values(state.entities)) for (const e of Object.values(bucket)) if (e.createdBy) names.add(e.createdBy);
  return [...names].sort();
}

// ---- slide elements (free-form slides) ----
export function selectElements(state, slideId) {
  const s = state.entities.slide[slideId];
  if (!s || s.deleted) return [];
  return Object.values(state.entities.el)
    .filter((e) => !e.deleted && e.slideId === slideId && e.type)
    .map((e) => ({ ...e, z: typeof e.z === "number" ? e.z : 0 }))
    .sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : 1));
}
