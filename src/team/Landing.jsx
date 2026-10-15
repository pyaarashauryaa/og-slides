// The first screen: create a team or join one. Returning users also see their teams here (the "team dashboard").
import { useEffect, useState } from "react";
import { demoAvailable } from "../cometchat/authApi.js";
import { ArrowRight, KeyRound, LoaderCircle, Plus, RefreshCw, TriangleAlert, Users } from "lucide-react";
import Logo from "../components/Logo.jsx";
import Welcome, { Doodles, SlideStack } from "../session/Welcome.jsx";
import { useSession } from "../session/SessionProvider.jsx";
import { useTeam } from "./TeamProvider.jsx";
import { formatCode } from "./teamCodes.js";

function YourTeams() {
  const t = useTeam();
  const [problem, setProblem] = useState("");
  const [busyCode, setBusyCode] = useState("");
  const { phase, list, error } = t.teams;
  const open = async (team) => {
    setProblem("");
    setBusyCode(team.code);
    const r = await t.openTeam(team);
    setBusyCode("");
    if (!r.ok) { setProblem(r.message); t.refreshTeams(); }
  };
  if (phase === "idle" && !t.resuming) return null;
  return (
    <section className="yteams" aria-labelledby="yteams-h">
      <h2 id="yteams-h" className="yteams__h"><Users size={20} aria-hidden="true" /> Your teams</h2>
      {(phase === "loading" || (phase === "idle" && t.resuming)) && list.length === 0 && (
        <p className="yteams__msg" role="status"><LoaderCircle size={16} className="spin" aria-hidden="true" /> Finding your teams…</p>
      )}
      {phase === "error" && (
        <div className="yteams__msg" role="alert">
          <TriangleAlert size={16} aria-hidden="true" /> {error?.message || "Couldn't load your teams."}{" "}
          <button type="button" className="btn btn--soft btn--small" onClick={t.refreshTeams}><RefreshCw size={14} aria-hidden="true" /> Try again</button>
        </div>
      )}
      {phase === "ready" && list.length === 0 && <p className="yteams__msg">No teams yet. Create one or join with a room code.</p>}
      {list.length > 0 && (
        <ul className="yteams__list stagger">
          {list.map((team, i) => (
            <li key={team.code} style={{ "--i": i + 5 }}>
              <button type="button" className="tteam" onClick={() => open(team)} disabled={Boolean(busyCode)}>
                <span className="tteam__badge" aria-hidden="true">{team.name.slice(0, 1).toUpperCase()}</span>
                <span className="tteam__text">
                  <strong>{team.name}</strong>
                  <small>{team.legacy ? "Original shared room" : `Room code ${formatCode(team.code)}`}{team.memberCount ? ` · ${team.memberCount} member${team.memberCount === 1 ? "" : "s"}` : ""}</small>
                </span>
                <span className="tteam__go" aria-hidden="true">{busyCode === team.code ? <LoaderCircle size={18} className="spin" /> : <>Open <ArrowRight size={16} /></>}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {problem && <p className="yteams__msg tform__error" role="alert">{problem}</p>}
    </section>
  );
}

// The big entrance plays the first time the landing page appears in this tab, not every time you come back to it.
let landingPlayed = false;

export default function Landing() {
  const t = useTeam();
  const s = useSession();
  const [demo, setDemo] = useState(false);
  const [demoOk, setDemoOk] = useState(false); // the server says whether shared demo accounts are switched on (development only)
  useEffect(() => { if (s.dev) return undefined; let live = true; demoAvailable().then((v) => { if (live) setDemoOk(v); }); return () => { live = false; }; }, [s.dev]);
  const [again] = useState(() => { const was = landingPlayed; landingPlayed = true; return was; });
  if (demo) return <Welcome onPick={s.pick} onBack={() => setDemo(false)} />;
  const signedIn = s.phase === "ready" && s.user;
  return (
    <main className={`welcome landing${again ? " landing--again" : ""}`} id="main-content">
      <Doodles />
      <div className="welcome__col">
        <header className="welcome__brand"><Logo size={44} /></header>
        <p className="welcome__tag"><span>Team room for slide makers</span></p>
        <h1 className="welcome__title">Big ideas are <mark>better together.</mark></h1>
        <p className="welcome__sub">Create your team, bring your people together, and build amazing presentations — in real time.</p>

        <div className="tchoices stagger">
          <button type="button" className="tchoice tchoice--create" style={{ "--i": 3 }} onClick={() => t.setScreen("create")}>
            <span className="tchoice__icon" aria-hidden="true"><Plus size={26} strokeWidth={2.6} /></span>
            <span className="tchoice__text"><strong>Create a team</strong><small>Start a new room and invite your people</small></span>
            <ArrowRight className="tchoice__go" size={20} aria-hidden="true" />
          </button>
          <button type="button" className="tchoice tchoice--join" style={{ "--i": 4 }} onClick={() => t.setScreen("join")}>
            <span className="tchoice__icon" aria-hidden="true"><KeyRound size={24} strokeWidth={2.4} /></span>
            <span className="tchoice__text"><strong>Join a team</strong><small>Got a room code and passkey? Hop in</small></span>
            <ArrowRight className="tchoice__go" size={20} aria-hidden="true" />
          </button>
        </div>

        {signedIn && <YourTeams />}

        <p className="landing__who">
          {signedIn && (
            <>Signed in as <strong>{s.user.getName?.() || s.uid}</strong>
              {!s.dev && <> · <button type="button" className="linkish" onClick={s.forgetMe}>Not you?</button></>}
            </>
          )}
          {!s.dev && !signedIn && <>New here? You'll pick a display name in the next step.</>}
          {!s.dev && demoOk && <> {signedIn ? "·" : ""} <button type="button" className="linkish" onClick={() => setDemo(true)}>Use a demo account</button></>}
        </p>
      </div>
      <div className="welcome__art"><SlideStack note="your turn! →" /></div>
    </main>
  );
}
