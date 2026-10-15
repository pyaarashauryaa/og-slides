// Pure helpers that turn an editing action into "ops" (see workspace/reducer.js).
// They read the current workspace state and return ops, so they can be tested without a browser.
import { newId } from "../workspace/ids.js";
import { selectSlides, selectElements } from "../workspace/selectors.js";
import { fieldNames, SLIDE_W, SLIDE_H } from "../workspace/model.js";
import { templateOf, legacyToElements } from "./templates.js";

const set = (k, id, f) => ({ t: "set", k, id, f });
const del = (k, id) => ({ t: "del", k, id });

function posAfter(slides, afterSlideId) {
  const i = slides.findIndex((s) => s.id === afterSlideId);
  if (i === -1) return slides.length ? slides[slides.length - 1].pos + 1 : 1;
  const next = slides[i + 1];
  return next ? (slides[i].pos + next.pos) / 2 : slides[i].pos + 1;
}

const pick = (obj, kind) => {
  const out = {};
  for (const f of fieldNames(kind)) if (obj[f] !== undefined) out[f] = obj[f];
  return out;
};

// Keeps an element on the canvas so it can never get lost off-screen.
export function clampBox(b) {
  const w = Math.min(Math.max(b.w, 8), SLIDE_W * 1.5);
  const h = Math.min(Math.max(b.h, 2), SLIDE_H * 1.5);
  const x = Math.min(Math.max(b.x, -w + 24), SLIDE_W - 24);
  const y = Math.min(Math.max(b.y, -h + 24), SLIDE_H - 24);
  return { x, y, w, h };
}

export function elementOps(slideId, specs) {
  const ops = [];
  const ids = [];
  specs.forEach((spec, i) => {
    const id = newId("e");
    ids.push(id);
    ops.push(set("el", id, { ...spec, slideId, z: i + 1 }));
  });
  return { ops, ids };
}

export function newSlideFromTemplate(state, deckId, afterSlideId, tplId) {
  const tpl = templateOf(tplId) || templateOf("bullets");
  const slides = selectSlides(state, deckId);
  const slideId = newId("s");
  const specs = tpl.build();
  const firstText = specs.find((s) => s.type === "text" && s.text);
  const { ops } = elementOps(slideId, specs);
  return {
    slideId,
    ops: [
      set("slide", slideId, { deckId, mode: "free", tpl: tpl.id, layout: "bullets", title: (firstText?.text || tpl.label).slice(0, 100), body: "", notes: "", pos: posAfter(slides, afterSlideId) }),
      ...ops,
    ],
  };
}

export function convertToFree(state, slide) {
  const { ops } = elementOps(slide.id, legacyToElements(slide));
  return [set("slide", slide.id, { mode: "free" }), ...ops];
}

export function duplicateSlideOps(state, deckId, slideId) {
  const slides = selectSlides(state, deckId);
  const src = slides.find((s) => s.id === slideId);
  if (!src) return null;
  const id = newId("s");
  const ops = [
    set("slide", id, { ...pick(src, "slide"), deckId, pos: posAfter(slides, slideId) }),
  ];
  for (const e of selectElements(state, slideId)) ops.push(set("el", newId("e"), { ...pick(e, "el"), slideId: id }));
  return { slideId: id, ops };
}

export function deleteSlideOps(state, slideId) {
  return [...selectElements(state, slideId).map((e) => del("el", e.id)), del("slide", slideId)];
}

export function moveSlideOps(state, deckId, slideId, direction) {
  const slides = selectSlides(state, deckId);
  const i = slides.findIndex((s) => s.id === slideId);
  const j = i + direction;
  if (i === -1 || j < 0 || j >= slides.length) return null;
  const lo = direction < 0 ? slides[j - 1] : slides[j];
  const hi = direction < 0 ? slides[j] : slides[j + 1];
  let pos;
  if (lo && hi) pos = (lo.pos + hi.pos) / 2;
  else if (hi) pos = hi.pos - 1;
  else pos = lo.pos + 1;
  return [set("slide", slideId, { pos })];
}

export function addElementOps(state, slideId, spec, minZ = 0) {
  const els = selectElements(state, slideId);
  const z = Math.max(els.length ? els[els.length - 1].z : 0, minZ) + 1;
  const id = newId("e");
  return { id, ops: [set("el", id, { ...spec, slideId, z })] };
}

export function duplicateElementOps(state, el) {
  const els = selectElements(state, el.slideId);
  const id = newId("e");
  const box = clampBox({ ...el, x: el.x + 20, y: el.y + 20 });
  return { id, ops: [set("el", id, { ...pick(el, "el"), ...box, z: (els.length ? els[els.length - 1].z : 0) + 1 })] };
}

// "front" | "back" | "forward" | "backward": z numbers are re-spread so they stay tidy.
export function reorderOps(state, el, how) {
  const els = selectElements(state, el.slideId);
  const i = els.findIndex((e) => e.id === el.id);
  if (i === -1) return [];
  const order = els.map((e) => e.id);
  order.splice(i, 1);
  const to = how === "front" ? order.length : how === "back" ? 0 : how === "forward" ? Math.min(order.length, i + 1) : Math.max(0, i - 1);
  order.splice(to, 0, el.id);
  const ops = [];
  order.forEach((id, n) => {
    const cur = els.find((e) => e.id === id);
    if (cur.z !== n + 1) ops.push(set("el", id, { z: n + 1 }));
  });
  return ops;
}

export function duplicateDeckOps(state, deck, selectSlidesFn = selectSlides) {
  const deckId = newId("d");
  const ops = [set("deck", deckId, { title: `${deck.title || "Untitled"} (copy)`.slice(0, 200), theme: deck.theme || "rani", ...(deck.transition ? { transition: deck.transition } : {}) })];
  for (const s of selectSlidesFn(state, deck.id)) {
    const sid = newId("s");
    ops.push(set("slide", sid, { ...pick(s, "slide"), deckId }));
    for (const e of selectElements(state, s.id)) ops.push(set("el", newId("e"), { ...pick(e, "el"), slideId: sid }));
  }
  return { deckId, ops };
}
