import { useState } from "react";
import { Plus, ArrowRight, KanbanSquare, Link2, ScrollText, Presentation, MessageSquare, Headphones, Video, Phone, Search, X, ExternalLink, TriangleAlert } from "lucide-react";
import EmptyState from "../ui/EmptyState.jsx";
import DataGate from "../components/DataGate.jsx";
import DeckGrid from "../slides/DeckGrid.jsx";
import { HomeSkeleton } from "../ui/Skeleton.jsx";
import { Avatar } from "../ui/People.jsx";
import { useSession } from "../session/SessionProvider.jsx";
import { useWorkspace } from "../workspace/WorkspaceProvider.jsx";
import { useCall } from "../call/CallProvider.jsx";
import { selectDecks, selectTasks, selectDecisions, selectResources } from "../workspace/selectors.js";
import { timeAgo } from "../ui/timeAgo.js";
import { isSafeUrl } from "../workspace/model.js";
import { celebrate } from "../ui/clickBurst.js";
import { useCountUp } from "../ui/useCountUp.js";

const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const TIP_KEY = "ogslides.tip.quickjump";
const tipSeen = () => { try { return localStorage.getItem(TIP_KEY) === "1"; } catch { return false; } };
const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl";

// A gentle, one-line hint. Dismissing it remembers the choice on this device and it never comes back.
function QuickTip() {
  const [gone, setGone] = useState(tipSeen);
  if (gone) return null;
  const close = () => { setGone(true); try { localStorage.setItem(TIP_KEY, "1"); } catch { /* fine without storage */ } };
  return (
    <p className="tip" role="note">
      <Search size={16} aria-hidden="true" />
      <span>Tip: press <kbd>{MOD}</kbd> <kbd>K</kbd> to jump to any page, presentation or action. <kbd>Alt</kbd> + a number opens a page.</span>
      <button className="icon-btn icon-btn--sm" onClick={close} aria-label="Dismiss tip"><X size={14} aria-hidden="true" /></button>
    </p>
  );
}

// A real number that counts up to its value on first show (instant under reduced motion).
function Count({ n }) {
  return <>{useCountUp(n)}</>;
}

// Short "what is this for" hint with a real tooltip (title) and visible text for touch/keyboard users.
const PURPOSE = {
  tasks: "Things your team still has to do",
  resources: "Links and references worth keeping",
  decisions: "What the team agreed, and why",
  slides: "Every presentation in this workspace",
};

function RoomNow({ self, peers }) {
  const people = [self, ...peers].filter(Boolean);
  return (
    <div className="room-now" role="group" aria-label="Who is in the room right now">
      <div className="room-now__faces">
        {people.slice(0, 5).map((p) => <Avatar key={p.uid} uid={p.uid} name={p.name} size={34} title={p.uid === self?.uid ? `${p.name} (you)` : `${p.name} is here`} />)}
      </div>
      <p><strong>{people.length === 1 ? "Just you right now" : `${people.length} people here now`}</strong><span>{people.length === 1 ? "Teammates show up here as they open OGSlides." : people.map((p) => (p.uid === self?.uid ? "You" : p.name)).join(", ")}</span></p>
    </div>
  );
}

function HomeData({ onNavigate }) {
  const session = useSession();
  const call = useCall();
  const { snap, actions } = useWorkspace();
  const decks = selectDecks(snap.state);
  const tasks = selectTasks(snap.state);
  const decisions = selectDecisions(snap.state);
  const links = selectResources(snap.state);
  const create = (e) => { celebrate(e?.currentTarget); onNavigate("slides", actions.createDeck()); };
  const firstName = (session.user?.getName?.() || "").split(/\s+/)[0];
  const callsOn = Boolean(call?.available);
  const today = todayStr();
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.due && t.due < today).length;
  // Overdue first, then by due date, then undated ones, so the top of the list is what needs attention.
  const queue = [...open].sort((a, b) => (a.due || "9999") < (b.due || "9999") ? -1 : (a.due || "9999") > (b.due || "9999") ? 1 : 0).slice(0, 5);

  return (
    <>
      <header className="home-head">
        <div>
          <p className="home-head__hello">{greeting()}{firstName ? `, ${firstName}` : ""} <span className="wave" aria-hidden="true">👋</span></p>
          <h2 className="home-head__title">Your <mark>workspace</mark></h2>
          <p className="home-head__sub">Decks, to-dos and decisions for the whole team, all in one room.</p>
        </div>
        <button className="btn btn--primary btn--lg" onClick={create}><Plus size={18} aria-hidden="true" /> New deck</button>
      </header>

      <nav className="quick stagger" aria-label="Jump to a section">
        {[
          { id: "tasks", icon: KanbanSquare, n: open.length, label: open.length === 1 ? "open task" : "open tasks", note: overdue ? `${overdue} overdue` : "" },
          { id: "resources", icon: Link2, n: links.length, label: links.length === 1 ? "resource" : "resources" },
          { id: "decisions", icon: ScrollText, n: decisions.length, label: decisions.length === 1 ? "decision" : "decisions" },
          { id: "slides", icon: Presentation, n: decks.length, label: decks.length === 1 ? "deck" : "decks" },
        ].map(({ id, icon: Icon, n, label, note }, i) => (
          <button key={id} className={`quick__item quick__item--${id}`} style={{ "--i": i }} title={PURPOSE[id]} onClick={() => onNavigate(id)}>
            <span className="quick__ico"><Icon size={18} aria-hidden="true" /></span>
            <span className="quick__n"><Count n={n} /></span>
            <span className="quick__label">{label}</span>
            <span className="quick__why">{PURPOSE[id]}</span>
            {note && <span className="quick__note">{note}</span>}
          </button>
        ))}
      </nav>

      {decks.length === 0 && (
        <p className="onboard" role="note">
          <span className="onboard__n" aria-hidden="true">1</span>
          <span><strong>New here?</strong> Press <em>New deck</em> to start a presentation. Open OGSlides in a second tab as someone else and you can edit it together.</span>
        </p>
      )}

      <div className="home-cols stagger">
        <section aria-labelledby="decks-title" className="home-main" style={{ "--i": 4 }}>
          <div className="sec-head">
            <h3 id="decks-title">Recent decks</h3>
            <span className="sec-head__hint">Newest edits first</span>
            {decks.length > 0 && <button className="link-btn" onClick={() => onNavigate("slides")}>All decks <ArrowRight size={15} aria-hidden="true" /></button>}
          </div>
          <DeckGrid decks={decks} limit={3} onCreate={create} onOpen={(id) => onNavigate("slides", id)} />
        </section>

        <aside className="home-side" aria-label="Work in progress" style={{ "--i": 5 }}>
          <section className="side-sec side-sec--tasks" aria-labelledby="tasks-title">
            <div className="sec-head"><h3 id="tasks-title">Tasks</h3><button className="link-btn" onClick={() => onNavigate("tasks")}>Open <ArrowRight size={15} aria-hidden="true" /></button></div>
            {queue.length ? (
              <ul className="rows">
                {queue.map((t) => {
                  const late = t.due && t.due < today;
                  return (
                    <li key={t.id} className={`rows__li rows__li--${late ? "late" : t.status === "doing" ? "doing" : "todo"}`}>
                      <span className="rows__main">{t.title}</span>
                      <span className={`rows__meta${late ? " rows__meta--late" : ""}`}>
                        {late && <TriangleAlert size={12} aria-hidden="true" />}
                        {t.due ? `${late ? "Overdue, " : "Due "}${t.due}` : t.status === "doing" ? "In progress" : "No date"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState compact title="No open tasks" action={<button className="btn btn--soft btn--small" onClick={() => onNavigate("tasks")}>Add a task</button>}>Tasks with due dates are listed here.</EmptyState>
            )}
          </section>

          <section className="side-sec side-sec--res" aria-labelledby="res-title">
            <div className="sec-head"><h3 id="res-title">Resources</h3><button className="link-btn" onClick={() => onNavigate("resources")}>Open <ArrowRight size={15} aria-hidden="true" /></button></div>
            {links.length ? (
              <ul className="rows">
                {links.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <span className="rows__main">{r.title}</span>
                    {isSafeUrl(r.url || "") && <a className="rows__meta" href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.title} in a new tab`}>{new URL(r.url).hostname} <ExternalLink size={12} aria-hidden="true" /></a>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact title="No resources yet" action={<button className="btn btn--soft btn--small" onClick={() => onNavigate("resources")}>Save a link</button>}>Links the team needs will be kept here.</EmptyState>
            )}
          </section>

          <section className="side-sec side-sec--dec" aria-labelledby="dec-title">
            <div className="sec-head"><h3 id="dec-title">Decisions</h3><button className="link-btn" onClick={() => onNavigate("decisions")}>Open <ArrowRight size={15} aria-hidden="true" /></button></div>
            {decisions.length ? (
              <ul className="rows">{decisions.slice(0, 3).map((d) => <li key={d.id}><span className="rows__main">{d.title}</span><span className="rows__meta">{timeAgo(d.createdAt)}</span></li>)}</ul>
            ) : (
              <EmptyState compact title="Nothing recorded" action={<button className="btn btn--soft btn--small" onClick={() => onNavigate("decisions")}>Record one</button>}>Write down what the team decided.</EmptyState>
            )}
          </section>
        </aside>
      </div>

      <section className="collab" aria-labelledby="collab-title" style={{ "--i": 6 }}>
        <div className="collab__who">
          <h3 id="collab-title">Make decks together</h3>
          <RoomNow self={snap.self} peers={snap.presence} />
        </div>
        <div className="collab__actions">
          <button className="btn btn--ghost btn--small" onClick={() => onNavigate("chat")}><MessageSquare size={16} aria-hidden="true" /> Team chat</button>
          {callsOn ? (
            <>
              <button className="btn btn--ghost btn--small" onClick={() => call.join("voice")} disabled={Boolean(call.inRoom)}><Headphones size={16} aria-hidden="true" /> Voice room</button>
              <button className="btn btn--ghost btn--small" onClick={() => call.join("video")} disabled={Boolean(call.inRoom)}><Video size={16} aria-hidden="true" /> Video call</button>
              <button className="btn btn--ghost btn--small" onClick={() => window.dispatchEvent(new CustomEvent("ogslides:call-picker"))} disabled={Boolean(call?.ring) || Boolean(call?.inRoom)}><Phone size={16} aria-hidden="true" /> Call a teammate</button>
            </>
          ) : (
            <p className="collab__note">Calls use the live CometChat connection, so they are off in dev test mode.</p>
          )}
        </div>
      </section>

      <QuickTip />
    </>
  );
}

export default function Home({ onNavigate }) {
  return (
    <div className="home">
      <DataGate loading={<HomeSkeleton />}><HomeData onNavigate={onNavigate} /></DataGate>
    </div>
  );
}
