import { GitMerge, Undo2, Check } from "lucide-react";
import { useWorkspace } from "../workspace/WorkspaceProvider.jsx";
import { conflictTitle, describeValue, FIELD_LABEL } from "../workspace/conflicts.js";
import { deckExists } from "../workspace/selectors.js";

// Appears when the saved history proves a teammate replaced something you had just saved.
// It says plainly that only ONE version survives, shows both, and lets you choose.
export default function ConflictCenter() {
  const { snap, actions } = useWorkspace() || {};
  const list = snap?.conflicts || [];
  if (!actions || list.length === 0) return null;
  return (
    <section className="conflicts" role="region" aria-label="Edits that were replaced by a teammate">
      {list.map((c) => {
        const alive = c.kind === "replaced" && !(snap.state.entities[c.k]?.[c.entityId]?.deleted) && (c.k !== "deck" || deckExists(snap.state, c.entityId));
        const label = FIELD_LABEL[c.field] || c.field;
        return (
          <article key={c.id} className="conflict" role="alert">
            <div className="conflict__head"><span className="conflict__ico" aria-hidden="true"><GitMerge size={16} /></span><strong>{conflictTitle(c)}</strong></div>
            {c.kind === "replaced" ? (
              <dl className="conflict__cmp">
                <div><dt>Now shown (theirs)</dt><dd>{describeValue(c.field, c.theirs)}</dd></div>
                <div><dt>Yours (replaced)</dt><dd>{describeValue(c.field, c.mine)}</dd></div>
              </dl>
            ) : (
              <p className="conflict__text">It was removed for everyone, so your change to its {label} can't be kept.</p>
            )}
            {c.kind === "replaced" && <p className="conflict__note">Only one version can be kept. Restoring yours replaces theirs.</p>}
            <div className="conflict__actions">
              <button className="btn btn--small btn--ghost" onClick={() => actions.resolveConflict(c.id, "theirs")}><Check size={15} aria-hidden="true" /> {c.kind === "replaced" ? "Keep theirs" : "Got it"}</button>
              {alive && <button className="btn btn--small btn--primary" onClick={() => actions.resolveConflict(c.id, "mine")}><Undo2 size={15} aria-hidden="true" /> Restore mine</button>}
            </div>
          </article>
        );
      })}
    </section>
  );
}
