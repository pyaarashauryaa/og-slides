// Everything a person can DO in the workspace. Each action turns into one small
// "op" message (or one batch) that the engine saves and shares.
import { newId } from "./ids.js";
import { selectSlides } from "./selectors.js";

export function createActions(engine) {
  const state = () => engine.getSnapshot().state;
  const set = (k, id, f) => ({ t: "set", k, id, f });
  const del = (k, id) => ({ t: "del", k, id });

  // Position a new slide just after `afterSlideId` (or at the end).
  function posAfter(slides, afterSlideId) {
    const i = slides.findIndex((s) => s.id === afterSlideId);
    if (i === -1) return slides.length ? slides[slides.length - 1].pos + 1 : 1;
    const next = slides[i + 1];
    return next ? (slides[i].pos + next.pos) / 2 : slides[i].pos + 1;
  }

  return {
    createDeck(title = "Untitled presentation") {
      const deckId = newId("d");
      const slideId = newId("s");
      engine.commit([
        set("deck", deckId, { title, theme: "rani" }),
        set("slide", slideId, { deckId, title: "Your big idea goes here", body: "A short line that sets the scene", layout: "cover", pos: 1 }),
      ]);
      return deckId;
    },
    renameDeck: (deckId, title) => engine.commit([set("deck", deckId, { title })]),
    setTheme: (deckId, theme) => engine.commit([set("deck", deckId, { theme })]),
    deleteDeck: (deckId) => engine.commit([del("deck", deckId)]),

    addSlide(deckId, afterSlideId) {
      const slides = selectSlides(state(), deckId);
      const id = newId("s");
      engine.commit([set("slide", id, { deckId, title: "New slide", body: "", layout: "bullets", pos: posAfter(slides, afterSlideId) })]);
      return id;
    },
    duplicateSlide(deckId, slideId) {
      const slides = selectSlides(state(), deckId);
      const src = slides.find((s) => s.id === slideId);
      if (!src) return null;
      const id = newId("s");
      engine.commit([set("slide", id, { deckId, title: src.title, body: src.body, layout: src.layout, pos: posAfter(slides, slideId) })]);
      return id;
    },
    updateSlide: (slideId, fields) => engine.commit([set("slide", slideId, fields)]),
    deleteSlide: (slideId) => engine.commit([del("slide", slideId)]),
    moveSlide(deckId, slideId, direction) {
      const slides = selectSlides(state(), deckId);
      const i = slides.findIndex((s) => s.id === slideId);
      const j = i + direction;
      if (i === -1 || j < 0 || j >= slides.length) return;
      // Put it between the two neighbours on the side we are moving towards.
      const lo = direction < 0 ? slides[j - 1] : slides[j];
      const hi = direction < 0 ? slides[j] : slides[j + 1];
      let pos;
      if (lo && hi) pos = (lo.pos + hi.pos) / 2;
      else if (hi) pos = hi.pos - 1;
      else pos = lo.pos + 1;
      engine.commit([set("slide", slideId, { pos })]);
    },

    // Tasks / resources / decisions: pass an id to edit, or leave it out to create.
    saveTask(fields, id = newId("t")) {
      engine.commit([set("task", id, fields)]);
      return id;
    },
    deleteTask: (id) => engine.commit([del("task", id)]),
    saveResource(fields, id = newId("r")) {
      engine.commit([set("resource", id, fields)]);
      return id;
    },
    deleteResource: (id) => engine.commit([del("resource", id)]),
    saveDecision(fields, id = newId("n")) {
      engine.commit([set("decision", id, fields)]);
      return id;
    },
    deleteDecision: (id) => engine.commit([del("decision", id)]),

    commit: (ops) => engine.commit(ops),
    uploadImage: (file) => engine.uploadImage(file),
    setFocus: (f) => engine.setFocus(f),
    retry: () => engine.retry(),
    resolveConflict: (id, how) => engine.resolveConflict(id, how),
  };
}
