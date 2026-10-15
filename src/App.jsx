import { useCallback, useEffect, useState } from "react";
import Sidebar, { PAGES } from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import Home from "./pages/Home.jsx";
import Slides from "./pages/Slides.jsx";
import ChatRoom from "./pages/ChatRoom.jsx";
import { Tasks, Resources, Decisions } from "./pages/Boards.jsx";
import { SessionProvider, useSession } from "./session/SessionProvider.jsx";
import { TeamProvider, useTeam } from "./team/TeamProvider.jsx";
import SessionGate from "./session/SessionGate.jsx";
import { WorkspaceProvider } from "./workspace/WorkspaceProvider.jsx";
import { ToastProvider } from "./ui/Toast.jsx";
import { CallProvider, useCall } from "./call/CallProvider.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import ConflictCenter from "./components/ConflictCenter.jsx";
import { useWorkspace } from "./workspace/WorkspaceProvider.jsx";
import { selectDecks } from "./workspace/selectors.js";
import { pageForShortcut } from "./ui/commandLogic.js";
import { installPointerGlow } from "./ui/pointerGlow.js";


const SIDEBAR_KEY = "ogslides.sidebar.collapsed";
const readCollapsed = () => { try { return localStorage.getItem(SIDEBAR_KEY) === "1"; } catch { return false; } };

function Shell() {
  const session = useSession();
  const team = useTeam();
  const { snap, actions } = useWorkspace();
  const call = useCall();
  const [route, setRoute] = useState({ page: "home", deckId: null });
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [palette, setPalette] = useState(false);
  const go = useCallback((page, deckId = null) => setRoute({ page, deckId }), []);
  const toggleSidebar = useCallback(() => setCollapsed((c) => { try { localStorage.setItem(SIDEBAR_KEY, c ? "0" : "1"); } catch { /* fine without storage */ } return !c; }), []);

  useEffect(() => { installPointerGlow(); }, []);

  // Global shortcuts: Ctrl/Cmd+K opens quick jump, Alt+1..6 opens a page.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((o) => !o); return; }
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
        const page = pageForShortcut(e.key);
        if (page) { e.preventDefault(); go(page); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [go]);

  const runCommand = useCallback((cmd) => {
    if (cmd.id.startsWith("go:")) go(cmd.id.slice(3));
    else if (cmd.id.startsWith("deck:")) go("slides", cmd.id.slice(5));
    else if (cmd.id === "act:create" && actions) go("slides", actions.createDeck());
    else if (cmd.id === "act:voice") call?.join("voice");
    else if (cmd.id === "act:video") call?.join("video");
    else if (cmd.id === "act:ring") window.dispatchEvent(new CustomEvent("ogslides:call-picker"));
  }, [go, actions, call]);
  const title = PAGES.find((p) => p.id === route.page)?.label ?? "Home";
  const fill = route.page === "chat" || (route.page === "slides" && route.deckId);

  let body;
  if (route.page === "home") body = <Home onNavigate={go} />;
  else if (route.page === "slides") body = <Slides deckId={route.deckId} onOpen={(id) => go("slides", id)} onBack={() => go("slides")} />;
  else if (route.page === "chat") body = <ChatRoom />;
  else if (route.page === "tasks") body = <Tasks onNavigate={go} />;
  else if (route.page === "resources") body = <Resources onNavigate={go} />;
  else body = <Decisions onNavigate={go} />;

  return (
    <div className={`app${collapsed ? " app--collapsed" : ""}`} data-page={route.page}>
      <a className="skip-link" href="#main-content" onClick={(e) => { e.preventDefault(); document.getElementById("main-content")?.focus(); }}>Skip to content</a>
      <Sidebar current={route.page} onNavigate={go} projectName={team.current?.name || "Your team"} collapsed={collapsed} onToggle={toggleSidebar} onPalette={() => setPalette(true)} />
      <div className="main">
        {session.dev && (
          <div className="devbar" role="status">
            DEV TEST MODE: edits travel between tabs on this computer only. This is <strong>not</strong> CometChat.
          </div>
        )}
        <TopBar workspaceName={team.current?.name || "Your team"} title={title} page={route.page} inEditor={route.page === "slides" && Boolean(route.deckId)} onPalette={() => setPalette(true)} />
        <main id="main-content" tabIndex={-1} key={`${route.page}:${route.deckId ? "edit" : "list"}`} className={`${fill ? "content content--fill" : "content"} page-enter`}>{body}</main>
      </div>
      <ConflictCenter />
      {palette && (
        <CommandPalette
          decks={snap.phase === "ready" ? selectDecks(snap.state) : []}
          canCreate={snap.phase === "ready" && Boolean(actions)}
          callsAvailable={Boolean(call?.available)}
          inCall={Boolean(call?.inRoom)}
          onRun={runCommand}
          onClose={() => setPalette(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <TeamProvider>
        {/* The first screens (landing, create / join a team, team lobby, connecting, sign-in problem) fill the whole window.
            The app itself, with its sidebar and live data, mounts only once someone is in a team's workspace. */}
        <SessionGate>
          <WorkspaceProvider>
            <ToastProvider>
              <CallProvider>
                <Shell />
              </CallProvider>
            </ToastProvider>
          </WorkspaceProvider>
        </SessionGate>
      </TeamProvider>
    </SessionProvider>
  );
}
