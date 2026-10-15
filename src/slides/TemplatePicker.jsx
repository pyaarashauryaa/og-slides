import { useState } from "react";
import Modal from "../ui/Modal.jsx";
import SlideView from "./SlideView.jsx";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "./templates.js";

const withIds = (specs) => specs.map((s, i) => ({ ...s, id: `p${i}`, z: i + 1 }));

// A gallery of real previews, grouped by purpose. Picking one inserts a new slide with editable content.
export default function TemplatePicker({ theme, onPick, onClose }) {
  const [cat, setCat] = useState("all");
  const shown = cat === "all" ? TEMPLATES : TEMPLATES.filter((t) => t.cat === cat);
  return (
    <Modal title="Choose a slide layout" onClose={onClose} wide>
      <div className="tpl-cats" role="group" aria-label="Layout categories">
        {[{ id: "all", label: `All (${TEMPLATES.length})` }, ...TEMPLATE_CATEGORIES.map((c) => ({ ...c, label: `${c.label} (${TEMPLATES.filter((t) => t.cat === c.id).length})` }))].map((c) => (
          <button key={c.id} className="chip" aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</button>
        ))}
      </div>
      <div className="tpl-grid">
        {shown.map((t) => (
          <button key={t.id} className="tpl" data-cat={t.cat} style={{ animationDelay: `${Math.min(shown.indexOf(t), 10) * 35}ms` }} onClick={() => onPick(t.id)}>
            <span className="tpl__thumb"><SlideView slide={{ mode: "free", id: t.id }} theme={theme} els={withIds(t.build())} /></span>
            <strong>{t.label}</strong>
            <small>{t.hint}</small>
          </button>
        ))}
      </div>
    </Modal>
  );
}
