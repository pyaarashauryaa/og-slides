import { useState } from "react";
import { Plus, Pencil, Trash2, Presentation, Sparkles, Copy, Layers, ArrowUpRight } from "lucide-react";
import EmptyState from "../ui/EmptyState.jsx";
import { Button } from "../ui/Button.jsx";
import { THEMES } from "./themes.js";
import SlideView from "./SlideView.jsx";
import Modal, { ConfirmDialog } from "../ui/Modal.jsx";
import { timeAgo } from "../ui/timeAgo.js";
import { useWorkspace } from "../workspace/WorkspaceProvider.jsx";
import { useToast } from "../ui/Toast.jsx";
import { duplicateDeckOps } from "./editorOps.js";

export function RenameDialog({ initial, title = "Rename presentation", onSave, onClose }) {
  const [v, setV] = useState(initial);
  const save = () => { if (v.trim()) { onSave(v.trim()); onClose(); } };
  return (
    <Modal title={title} onClose={onClose} actions={<>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button onClick={save} disabled={!v.trim()}>Save</Button>
    </>}>
      <label className="field"><span>Title</span>
        <input value={v} maxLength={200} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} />
      </label>
    </Modal>
  );
}

export function EmptyDecks({ onCreate }) {
  return (
    <EmptyState
      tone="rani"
      title="No presentations yet"
      art={(
        <div className="empty-art" aria-hidden="true">
          <span className="mini mini--a" /><span className="mini mini--b" /><span className="mini mini--c" />
          <Sparkles className="empty-art__spark" size={26} />
        </div>
      )}
      action={<Button onClick={onCreate}><Plus size={18} aria-hidden="true" /> Create presentation</Button>}
    >
      Make the first one and your whole team can edit it together, live.
    </EmptyState>
  );
}

function DeckCard({ deck, onOpen, onRename, onDelete, onDuplicate, index }) {
  return (
    <article className="deck-card glow" style={{ animationDelay: `${Math.min(index, 8) * 70}ms`, "--deck-accent": THEMES[deck.theme]?.accent }}>
      <button className="deck-card__thumb" onClick={() => onOpen(deck.id)} aria-label={`Open ${deck.title || "presentation"}`}>
        {deck.firstSlide ? <SlideView slide={deck.firstSlide} theme={deck.theme} /> : <div className="deck-card__blank"><Presentation /></div>}
        <span className="deck-card__count" aria-hidden="true"><Layers size={12} aria-hidden="true" /> {deck.slideCount}</span>
        <span className="deck-card__open" aria-hidden="true">Open <ArrowUpRight size={14} aria-hidden="true" /></span>
      </button>
      <div className="deck-card__meta">
        <div>
          <h3 title={deck.title}><span className="deck-card__dot" style={{ background: THEMES[deck.theme]?.accent }} aria-hidden="true" />{deck.title || "Untitled presentation"}</h3>
          <p>{deck.slideCount} slide{deck.slideCount === 1 ? "" : "s"} · edited {timeAgo(deck.updatedAt)}{deck.updatedBy ? ` by ${deck.updatedBy}` : ""}</p>
        </div>
        <div className="deck-card__tools">
          <button className="icon-btn" onClick={() => onRename(deck)} aria-label="Rename" title="Rename"><Pencil size={16} /></button>
          <button className="icon-btn" onClick={() => onDuplicate(deck)} aria-label="Duplicate" title="Duplicate"><Copy size={16} /></button>
          <button className="icon-btn" onClick={() => onDelete(deck)} aria-label="Delete" title="Delete"><Trash2 size={16} /></button>
        </div>
      </div>
    </article>
  );
}

export default function DeckGrid({ decks, onOpen, onCreate, limit }) {
  const { snap, actions } = useWorkspace();
  const toast = useToast();
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  if (!decks.length) return <EmptyDecks onCreate={onCreate} />;
  const shown = limit ? decks.slice(0, limit) : decks;
  return (
    <>
      <div className="deck-grid">
        {shown.map((d, i) => <DeckCard key={d.id} deck={d} index={i} onOpen={onOpen} onRename={setRenaming} onDelete={setDeleting} onDuplicate={(deck) => { const r = duplicateDeckOps(snap.state, deck); actions.commit(r.ops); toast("Duplicated. The copy is in your list.", "ok", 3000); }} />)}
      </div>
      {renaming && <RenameDialog initial={renaming.title} onClose={() => setRenaming(null)} onSave={(t) => actions.renameDeck(renaming.id, t)} />}
      {deleting && <ConfirmDialog title="Delete this presentation?" text={`“${deleting.title || "Untitled"}” and all its slides will be removed for everyone on the team.`} onClose={() => setDeleting(null)} onConfirm={() => actions.deleteDeck(deleting.id)} />}
    </>
  );
}
