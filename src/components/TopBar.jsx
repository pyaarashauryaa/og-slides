import { ArrowLeftRight, Search, Users } from "lucide-react";
import { useTeam } from "../team/TeamProvider.jsx";
import { PAGES } from "./Sidebar.jsx";
import { useSession } from "../session/SessionProvider.jsx";
import { useWorkspace } from "../workspace/WorkspaceProvider.jsx";
import { Avatar } from "../ui/People.jsx";
import VoiceRoomButton from "../call/VoiceRoomButton.jsx";
import { SaveStatus } from "../slides/Editor.jsx";

function status(session, snap) {
  if (!session.configured) return { cls: "pill--warn", text: "CometChat keys missing" };
  if (!session.user) return { cls: "pill--warn", text: session.phase === "signing-in" ? "Signing in…" : "Not signed in" };
  if (snap.phase === "loading") return { cls: "pill--warn", text: "Loading shared data…" };
  if (snap.connection === "live") return { cls: "pill--ok", text: session.dev ? "Dev sync live" : "Live" };
  if (snap.connection === "connecting") return { cls: "pill--warn", text: "Reconnecting…" };
  return { cls: "pill--bad", text: "Offline" };
}

export default function TopBar({ workspaceName, title, page, inEditor = false, onPalette }) {
  const session = useSession();
  const team = useTeam();
  const { snap, actions } = useWorkspace();
  const s = status(session, snap);
  const name = session.user?.getName?.();
  const Icon = PAGES.find((p) => p.id === page)?.icon;
  return (
    <header className="topbar">
      <div className="topbar__crumbs">
        {Icon && <span className="topbar__tile" aria-hidden="true"><Icon size={20} strokeWidth={2} /></span>}
        <div>
          <span className="topbar__workspace">{workspaceName}</span>
          <h1 className="topbar__title">{title}</h1>
        </div>
      </div>
      {/* Status and account sit together in one cluster so they read as "who and how am I connected". */}
      <div className="topbar__right" role="group" aria-label="Connection and account">
        {/* Unsaved or failed edits must never be silent, on any page. The slide editor shows its own copy. */}
        {!inEditor && (snap.saveState === "failed" || snap.saveState === "offline") && actions && <SaveStatus snap={snap} onRetry={actions.retry} />}
        {onPalette && (
          <button className="icon-btn topbar__search" onClick={onPalette} aria-label="Quick jump (Ctrl K)" aria-keyshortcuts="Control+K Meta+K" data-tip="Quick jump · Ctrl K">
            <Search size={18} aria-hidden="true" />
          </button>
        )}
        <VoiceRoomButton />
        <span className={`pill ${s.cls}`}><span className="pill__dot" aria-hidden="true" /> <span className="pill__text">{s.text}</span></span>
        {session.user && (
          <>
            <span className="userchip"><Avatar uid={session.uid} name={name} size={26} /> <span className="userchip__name">{name}</span></span>
            <button className="icon-btn icon-btn--sm" onClick={team.toLobby} aria-label="Team lobby" title="Team lobby: members and invitation"><Users size={16} aria-hidden="true" /></button>
            <button className="icon-btn icon-btn--sm" onClick={team.toLanding} aria-label="Switch team" title="Switch team"><ArrowLeftRight size={16} aria-hidden="true" /></button>
          </>
        )}
      </div>
    </header>
  );
}
