import { useState } from "react";
import { Plus, Trash2, Pencil, ChevronLeft, ChevronRight, ExternalLink, Presentation, CalendarDays, KanbanSquare, Link2, ScrollText, Circle, LoaderCircle, CircleCheck, TriangleAlert } from "lucide-react";
import EmptyState from "../ui/EmptyState.jsx";
import PageHead from "../ui/PageHead.jsx";
import DataGate from "../components/DataGate.jsx";
import { useWorkspace } from "../workspace/WorkspaceProvider.jsx";
import { selectDecks, selectTasks, selectResources, selectDecisions, deckTitle } from "../workspace/selectors.js";
import { STATUSES, CATEGORIES, isSafeUrl } from "../workspace/model.js";
import Modal, { ConfirmDialog } from "../ui/Modal.jsx";
import { Button } from "../ui/Button.jsx";
import { useToast } from "../ui/Toast.jsx";
import { timeAgo } from "../ui/timeAgo.js";

function DeckSelect({ value, onChange, decks, label = "Linked presentation", emptyLabel = "None" }) {
  return (
    <label className="field"><span>{label}</span>
      <select value={value || ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">{emptyLabel}</option>
        {decks.map((d) => <option key={d.id} value={d.id}>{d.title || "Untitled presentation"}</option>)}
      </select>
    </label>
  );
}

function DeckChip({ deckId, onNavigate }) {
  const { snap } = useWorkspace();
  const t = deckId && deckTitle(snap.state, deckId);
  if (!t) return null;
  return <button className="deck-chip" onClick={() => onNavigate("slides", deckId)}><Presentation size={12} aria-hidden="true" /> {t}</button>;
}

// A small "edit this record" dialog shared by tasks, links and decisions. Saving sends only a "set" for the
// same id, so the record keeps its identity and links to presentations.
function EditDialog({ title, onSave, onClose, valid = true, children }) {
  return (
    <Modal title={title} onClose={onClose} actions={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={() => { onSave(); onClose(); }} disabled={!valid}>Save changes</Button></>}>
      <div className="editform">{children}</div>
    </Modal>
  );
}
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const STATUS_ICON = { todo: Circle, doing: LoaderCircle, done: CircleCheck };

/* ---------------- Tasks ---------------- */
export function TasksInner({ onNavigate, fixedDeckId }) {
  const { snap, actions } = useWorkspace();
  const toast = useToast();
  const decks = selectDecks(snap.state);
  const [filter, setFilter] = useState(fixedDeckId || "");
  const tasks = selectTasks(snap.state, filter || null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [draft, setDraft] = useState({});
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState("");
  const [deckId, setDeckId] = useState(fixedDeckId || null);
  const add = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    actions.saveTask({ title: title.trim(), status: "todo", due, owner: owner.trim(), deckId: fixedDeckId || deckId });
    toast("Task added. It is in To do for everyone.", "ok", 2500);
    setTitle(""); setDue(""); setOwner("");
  };
  const move = (t, d) => {
    const i = STATUSES.findIndex((s) => s.id === t.status);
    const n = STATUSES[i + d];
    if (n) actions.saveTask({ status: n.id }, t.id);
  };
  return (
    <>
      <form className="addform" onSubmit={add}>
        <label className="field addform__grow"><span>New task</span><input value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" /></label>
        <label className="field"><span>Due</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <label className="field"><span>Owner</span><input value={owner} maxLength={120} onChange={(e) => setOwner(e.target.value)} placeholder="Name" /></label>
        {!fixedDeckId && <DeckSelect value={deckId} onChange={setDeckId} decks={decks} />}
        <button className="btn btn--primary" disabled={!title.trim()}><Plus size={18} aria-hidden="true" /> Add</button>
      </form>
      {!fixedDeckId && decks.length > 0 && <DeckSelect label="Show tasks for" emptyLabel="All presentations" value={filter} onChange={(v) => setFilter(v || "")} decks={decks} />}
      {tasks.length === 0 && (
        <EmptyState tone="coral" icon={KanbanSquare} title="No tasks yet">Add the first thing that needs doing. It shows up in To do, and you can move it along as work happens.</EmptyState>
      )}
      <div className="kanban" hidden={tasks.length === 0}>
        {STATUSES.map((col) => {
          const list = tasks.filter((t) => t.status === col.id);
          return (
            <section key={col.id} className={`kanban__col kanban__col--${col.id}`} aria-label={col.label}>
              <h3>{col.label} <span>{list.length}</span></h3>
              {list.length === 0 && <p className="kanban__empty">Nothing here</p>}
              {list.map((t) => (
                <article key={t.id} className={`task task--${t.status}`}>
                  <div className="task__top">
                    <p className="task__title">{t.title || "Untitled task"}</p>
                    {(() => { const I = STATUS_ICON[t.status] || Circle; const late = t.status !== "done" && t.due && t.due < todayStr();
                      return late ? <span className="status-chip status-chip--late"><TriangleAlert size={12} aria-hidden="true" /> Overdue</span>
                        : <span className={`status-chip status-chip--${t.status}`}><I size={12} aria-hidden="true" /> {col.label}</span>; })()}
                  </div>
                  <div className="task__meta">
                    {t.due && <span><CalendarDays size={12} aria-hidden="true" /> {t.due}</span>}
                    {t.owner && <span>{t.owner}</span>}
                    {!fixedDeckId && <DeckChip deckId={t.deckId} onNavigate={onNavigate} />}
                  </div>
                  <div className="task__tools">
                    <button className="icon-btn" disabled={col.id === "todo"} onClick={() => move(t, -1)} aria-label="Move back"><ChevronLeft size={16} /></button>
                    <button className="icon-btn" disabled={col.id === "done"} onClick={() => move(t, 1)} aria-label="Move forward"><ChevronRight size={16} /></button>
                    <button className="icon-btn" onClick={() => { setDraft({ title: t.title || "", due: t.due || "", owner: t.owner || "", deckId: t.deckId || null }); setEditing(t); }} aria-label={`Edit task ${t.title || ""}`.trim()} title="Edit"><Pencil size={16} aria-hidden="true" /></button>
                    <button className="icon-btn" onClick={() => setDeleting(t)} aria-label={`Delete task ${t.title || ""}`.trim()} title="Delete"><Trash2 size={16} aria-hidden="true" /></button>
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>
      {editing && (
        <EditDialog title="Edit task" valid={Boolean(draft.title?.trim())} onClose={() => setEditing(null)} onSave={() => { actions.saveTask({ title: draft.title.trim(), due: draft.due || "", owner: (draft.owner || "").trim(), deckId: draft.deckId || null }, editing.id); toast("Task updated.", "ok", 2000); }}>
          <label className="field"><span>Task</span><input value={draft.title} maxLength={300} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <label className="field"><span>Due</span><input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></label>
          <label className="field"><span>Owner</span><input value={draft.owner} maxLength={120} onChange={(e) => setDraft({ ...draft, owner: e.target.value })} /></label>
          <DeckSelect value={draft.deckId} onChange={(v) => setDraft({ ...draft, deckId: v })} decks={decks} />
        </EditDialog>
      )}
      {deleting && <ConfirmDialog title="Delete this task?" text={`“${deleting.title || "Untitled task"}” will be removed for everyone.`} onClose={() => setDeleting(null)} onConfirm={() => { actions.deleteTask(deleting.id); toast("Task deleted.", "info", 2500); }} />}
    </>
  );
}
export function Tasks({ onNavigate }) {
  return <DataGate><div className="gallery"><PageHead icon={KanbanSquare} title="Tasks" text="Shared by the whole team. Link a task to a presentation if it belongs to one." /><TasksInner onNavigate={onNavigate} /></div></DataGate>;
}

/* ---------------- Resources ---------------- */
export function ResourcesInner({ onNavigate, fixedDeckId }) {
  const { snap, actions } = useWorkspace();
  const toast = useToast();
  const decks = selectDecks(snap.state);
  const [filter, setFilter] = useState(fixedDeckId || "");
  const items = selectResources(snap.state, filter || null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [draft, setDraft] = useState({});
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("reference");
  const [deckId, setDeckId] = useState(fixedDeckId || null);
  const urlOk = isSafeUrl(url.trim());
  const add = (e) => {
    e.preventDefault();
    if (!title.trim() || !urlOk) return;
    actions.saveResource({ title: title.trim(), url: url.trim(), category, deckId: fixedDeckId || deckId });
    toast("Link saved for the team.", "ok", 2500);
    setTitle(""); setUrl("");
  };
  return (
    <>
      <form className="addform" onSubmit={add}>
        <label className="field addform__grow"><span>Title</span><input value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} placeholder="Brand guidelines" /></label>
        <label className="field addform__grow"><span>Link</span><input value={url} maxLength={2000} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-invalid={url !== "" && !urlOk} />
          {url !== "" && !urlOk && <small className="field__conflict">Links must start with http:// or https://</small>}
        </label>
        <label className="field"><span>Type</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
        </label>
        {!fixedDeckId && <DeckSelect value={deckId} onChange={setDeckId} decks={decks} />}
        <button className="btn btn--primary" disabled={!title.trim() || !urlOk}><Plus size={18} aria-hidden="true" /> Add</button>
      </form>
      {!fixedDeckId && decks.length > 0 && <DeckSelect label="Show links for" emptyLabel="All presentations" value={filter} onChange={(v) => setFilter(v || "")} decks={decks} />}
      {items.length === 0 ? <EmptyState tone="sky" icon={Link2} title="No links yet">Stash the links your team keeps losing. Everyone sees them.</EmptyState> : (
        <div className="res-grid">
          {items.map((r) => (
            <article key={r.id} className={`res res--${r.category}`}>
              <span className="res__cat">{CATEGORIES.find((c) => c.id === r.category)?.label}</span>
              <h3>{r.title || "Untitled link"}</h3>
              {isSafeUrl(r.url || "") ? <a href={r.url} target="_blank" rel="noopener noreferrer">{new URL(r.url).hostname} <ExternalLink size={13} aria-hidden="true" /></a> : <small>Unsafe or invalid link hidden</small>}
              <div className="task__meta">{!fixedDeckId && <DeckChip deckId={r.deckId} onNavigate={onNavigate} />}<span>{timeAgo(r.createdAt)}</span></div>
              <div className="res__tools">
                <button className="icon-btn" onClick={() => { setDraft({ title: r.title || "", url: r.url || "", category: r.category, deckId: r.deckId || null }); setEditing(r); }} aria-label={`Edit link ${r.title || ""}`.trim()} title="Edit"><Pencil size={16} aria-hidden="true" /></button>
                <button className="icon-btn" onClick={() => setDeleting(r)} aria-label={`Delete link ${r.title || ""}`.trim()} title="Delete"><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            </article>
          ))}
        </div>
      )}
      {editing && (
        <EditDialog title="Edit link" valid={Boolean(draft.title?.trim()) && isSafeUrl((draft.url || "").trim())} onClose={() => setEditing(null)} onSave={() => { actions.saveResource({ title: draft.title.trim(), url: draft.url.trim(), category: draft.category, deckId: draft.deckId || null }, editing.id); toast("Link updated.", "ok", 2000); }}>
          <label className="field"><span>Title</span><input value={draft.title} maxLength={300} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <label className="field"><span>Link</span><input value={draft.url} maxLength={2000} aria-invalid={!isSafeUrl((draft.url || "").trim())} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            {!isSafeUrl((draft.url || "").trim()) && <small className="field__conflict">Links must start with http:// or https://</small>}</label>
          <label className="field"><span>Type</span><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <DeckSelect value={draft.deckId} onChange={(v) => setDraft({ ...draft, deckId: v })} decks={decks} />
        </EditDialog>
      )}
      {deleting && <ConfirmDialog title="Delete this link?" text={`“${deleting.title || "Untitled link"}” will be removed for everyone.`} onClose={() => setDeleting(null)} onConfirm={() => { actions.deleteResource(deleting.id); toast("Link deleted.", "info", 2500); }} />}
    </>
  );
}
export function Resources({ onNavigate }) {
  return <DataGate><div className="gallery"><PageHead icon={Link2} title="Resources" text="A shelf for the links your team keeps losing." /><ResourcesInner onNavigate={onNavigate} /></div></DataGate>;
}

/* ---------------- Decisions ---------------- */
export function DecisionsInner({ onNavigate, fixedDeckId }) {
  const { snap, actions } = useWorkspace();
  const toast = useToast();
  const decks = selectDecks(snap.state);
  const [filter, setFilter] = useState(fixedDeckId || "");
  const items = selectDecisions(snap.state, filter || null);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({});
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [deckId, setDeckId] = useState(fixedDeckId || null);
  const [deleting, setDeleting] = useState(null);
  const add = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    actions.saveDecision({ title: title.trim(), content: content.trim(), deckId: fixedDeckId || deckId });
    toast("Decision recorded.", "ok", 2500);
    setTitle(""); setContent("");
  };
  return (
    <>
      <form className="addform" onSubmit={add}>
        <label className="field addform__grow"><span>What did you decide?</span><input value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} placeholder="We'll demo with the pink theme" /></label>
        <label className="field addform__grow"><span>Why / details (optional)</span><input value={content} maxLength={4000} onChange={(e) => setContent(e.target.value)} /></label>
        {!fixedDeckId && <DeckSelect value={deckId} onChange={setDeckId} decks={decks} />}
        <button className="btn btn--primary" disabled={!title.trim()}><Plus size={18} aria-hidden="true" /> Record</button>
      </form>
      {!fixedDeckId && decks.length > 0 && <DeckSelect label="Show decisions for" emptyLabel="All presentations" value={filter} onChange={(v) => setFilter(v || "")} decks={decks} />}
      {items.length === 0 ? <EmptyState tone="violet" icon={ScrollText} title="Nothing decided yet">Write decisions down here so nobody has to scroll the chat to find them.</EmptyState> : (
        <ol className="timeline">
          {items.map((d) => (
            <li key={d.id}>
              <div className="timeline__body">
                <h3>{d.title}</h3>
                {d.content && <p>{d.content}</p>}
                <div className="task__meta"><span>{d.createdBy} · {timeAgo(d.createdAt)}</span>{!fixedDeckId && <DeckChip deckId={d.deckId} onNavigate={onNavigate} />}</div>
              </div>
              <div className="rowtools">
                <button className="icon-btn" onClick={() => { setDraft({ title: d.title || "", content: d.content || "", deckId: d.deckId || null }); setEditing(d); }} aria-label={`Edit decision ${d.title || ""}`.trim()} title="Edit"><Pencil size={16} aria-hidden="true" /></button>
                <button className="icon-btn" onClick={() => setDeleting(d)} aria-label={`Delete decision ${d.title || ""}`.trim()} title="Delete"><Trash2 size={16} aria-hidden="true" /></button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {editing && (
        <EditDialog title="Edit decision" valid={Boolean(draft.title?.trim())} onClose={() => setEditing(null)} onSave={() => { actions.saveDecision({ title: draft.title.trim(), content: (draft.content || "").trim(), deckId: draft.deckId || null }, editing.id); toast("Decision updated.", "ok", 2000); }}>
          <label className="field"><span>What was decided</span><input value={draft.title} maxLength={300} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
          <label className="field"><span>Why / details</span><textarea rows={4} value={draft.content} maxLength={4000} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></label>
          <DeckSelect value={draft.deckId} onChange={(v) => setDraft({ ...draft, deckId: v })} decks={decks} />
        </EditDialog>
      )}
      {deleting && <ConfirmDialog title="Delete this decision?" text={`“${deleting.title}” will be removed for everyone.`} onClose={() => setDeleting(null)} onConfirm={() => actions.deleteDecision(deleting.id)} />}
    </>
  );
}
export function Decisions({ onNavigate }) {
  return <DataGate><div className="gallery"><PageHead icon={ScrollText} title="Decisions" text="What you decided, and when. Newest first." /><DecisionsInner onNavigate={onNavigate} /></div></DataGate>;
}
