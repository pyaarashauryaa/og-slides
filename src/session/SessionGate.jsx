// Shows "add your keys" / "pick a test user" / "connecting" / "error" until someone is signed in.
import { KeyRound, LoaderCircle, RefreshCw, ArrowLeftRight, TriangleAlert } from "lucide-react";
import { useSession } from "./SessionProvider.jsx";
import Welcome, { Doodles } from "./Welcome.jsx";
import { useTeam } from "../team/TeamProvider.jsx";
import TeamFlow from "../team/TeamFlow.jsx";
import Mascot from "../ui/Mascot.jsx";
import Logo from "../components/Logo.jsx";

// Shared backdrop for the "something needs attention" screens, so they feel like the welcome screen.
function GateFrame({ mood, children }) {
  return (
    <main className="gate" id="main-content">
      <Doodles />
      <div className="gate__card">
        <h1 className="sr-only">OGSlides</h1>
        <Logo size={36} />
        <Mascot mood={mood} size={96} className="gate__pip" />
        {children}
      </div>
    </main>
  );
}

function NotConfigured() {
  return (
    <div className="panel">
      <KeyRound size={28} strokeWidth={1.75} className="panel__icon" aria-hidden="true" />
      <h2>Add your CometChat App ID to get started</h2>
      <ol className="panel__steps">
        <li>
          In the project folder, make a file named exactly <code>.env</code> (copy <code>.env.example</code>) and fill in <code>VITE_COMETCHAT_APP_ID</code> and <code>VITE_COMETCHAT_REGION</code>. These two are not secret.
        </li>
        <li>
          Make <code>server/.env</code> (copy <code>server/.env.example</code>) for the private keys. They stay on the sign-in server and never reach the browser.
        </li>
        <li>
          Start the sign-in server with <code>npm.cmd run server</code>, then the app with <code>npm.cmd run dev</code>. Restart the app after changing <code>.env</code>.
        </li>
      </ol>
    </div>
  );
}

function Connecting() {
  return (
    <div className="panel panel--busy" role="status">
      <LoaderCircle className="spin" size={28} aria-hidden="true" />
      <p>Connecting to CometChat and signing in…</p>
    </div>
  );
}

function SignInError({ s }) {
  return (
    <div className="panel" role="alert">
      <TriangleAlert size={28} strokeWidth={1.75} className="panel__icon" aria-hidden="true" />
      <h2>Couldn't sign in</h2>
      <p className="panel__lead">{s.error?.friendly}</p>
      <p className="panel__tech">{s.error?.technical}</p>
      <div className="panel__actions">
        <button className="btn btn--primary" onClick={s.retry}>
          <RefreshCw size={18} aria-hidden="true" /> Try again
        </button>
        <button className="btn btn--ghost" onClick={s.switchUser}>
          <ArrowLeftRight size={18} aria-hidden="true" /> Pick another user
        </button>
      </div>
    </div>
  );
}

// Development only: ?preview=welcome|connecting|error|nokeys lets you look at these screens without a real sign-in.
function devPreview() {
  if (!import.meta.env.DEV) return null;
  try {
    return new URLSearchParams(window.location.search).get("preview");
  } catch {
    return null;
  }
}

export default function SessionGate({ children }) {
  const s = useSession();
  const team = useTeam();
  const preview = devPreview();
  // In the preview, picking a user opens the memory test mode as that user, so every choice can be checked without CometChat keys.
  if (preview === "welcome") return <Welcome onPick={(uid) => { window.location.search = `?dev=memory&as=${uid}`; }} />;
  if (preview === "nokeys") return <GateFrame mood="think"><NotConfigured /></GateFrame>;
  if (preview === "connecting") return <GateFrame mood="wink"><Connecting /></GateFrame>;
  if (preview === "error") return <GateFrame mood="oops"><SignInError s={{ error: { friendly: "Preview: this is how a sign-in problem looks.", technical: "Preview only, no real error." }, retry() {}, switchUser() {} }} /></GateFrame>;
  if (!s.configured) return <GateFrame mood="think"><NotConfigured /></GateFrame>;
  if (s.uid && s.phase === "ready" && team.resuming) return <GateFrame mood="wink"><Connecting /></GateFrame>;
  // Signed out, or signed in but no team opened yet: the team screens (landing, create, join, lobby).
  if (!s.uid || (s.phase === "ready" && !(team.current && team.inWorkspace))) return <TeamFlow />;
  if (s.phase === "signing-in" || s.phase === "idle") return <GateFrame mood="wink"><Connecting /></GateFrame>;
  if (s.phase === "error") return <GateFrame mood="oops"><SignInError s={s} /></GateFrame>;
  return children;
}
