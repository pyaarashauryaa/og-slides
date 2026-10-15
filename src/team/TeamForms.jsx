// "Create a team" and "Join a team" forms, and the "Your team is ready!" screen.
import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, Sparkles } from "lucide-react";
import Logo from "../components/Logo.jsx";
import Mascot from "../ui/Mascot.jsx";
import { Doodles } from "../session/Welcome.jsx";
import { celebrate } from "../ui/clickBurst.js";
import { useSession } from "../session/SessionProvider.jsx";
import { useTeam } from "./TeamProvider.jsx";
import CopyButton from "./CopyButton.jsx";
import { buildInvitation, formatCode, formatPasskey, DESCRIPTION_MAX, NAME_MAX, PERSON_NAME_MAX } from "./teamCodes.js";

export function Card({ title, mood = "happy", children, onBack, backLabel = "Back", wide }) {
  return (
    <main className="gate tgate" id="main-content">
      <Doodles />
      <div className={`gate__card tcard${wide ? " tcard--wide" : ""}`}>
        <Logo size={34} />
        <Mascot mood={mood} size={84} className="gate__pip" />
        {onBack && <button type="button" className="btn btn--ghost btn--small tcard__back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> {backLabel}</button>}
        <h1 className="tcard__title">{title}</h1>
        {children}
      </div>
    </main>
  );
}

function Field({ id, label, hint, error, children }) {
  return (
    <div className={`field tfield${error ? " has-error" : ""}`}>
      <label htmlFor={id}><span>{label}</span></label>
      {children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && <small id={`${id}-err`} className="tform__error" role="alert">{error}</small>}
    </div>
  );
}

// Only asked when this device has no account yet. Nobody who is signed in sees it.
function PersonField({ id, value, onChange, error }) {
  const s = useSession();
  if (s.phase === "ready" && s.user) return null;
  return (
    <Field id={id} label="Your name" hint="This is how teammates will see you." error={error}>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} maxLength={PERSON_NAME_MAX} autoComplete="nickname" placeholder="e.g. Asha"
        aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`} />
    </Field>
  );
}

export function CreateTeamForm() {
  const t = useTeam();
  const uid = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [person, setPerson] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState({});
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr({});
    setBusy(true);
    const r = await t.createTeam({ name, description, personName: person });
    setBusy(false);
    if (!r.ok) setErr({ [r.field || "form"]: r.message });
  };
  return (
    <Card title="Create a team" mood="wink" onBack={() => t.setScreen("landing")}>
      <p className="tcard__lead">Give your team a name. We'll make a private room with a room code and a passkey to share.</p>
      <form className="tform" onSubmit={submit} noValidate>
        <Field id={`${uid}-name`} label="Team name (required)" error={err.name}>
          <input id={`${uid}-name`} ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX + 20} required aria-required="true"
            placeholder="e.g. Hackathon Heroes" autoComplete="off" aria-invalid={Boolean(err.name)} aria-describedby={err.name ? `${uid}-name-err` : undefined} />
        </Field>
        <Field id={`${uid}-desc`} label="Short description (optional)" hint={`${description.length}/${DESCRIPTION_MAX}`} error={err.description}>
          <textarea id={`${uid}-desc`} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What are you building together?"
            aria-invalid={Boolean(err.description)} aria-describedby={`${uid}-desc-hint${err.description ? ` ${uid}-desc-err` : ""}`} />
        </Field>
        <PersonField id={`${uid}-person`} value={person} onChange={setPerson} error={err.person} />
        {err.form && <p className="tform__error tform__error--box" role="alert">{err.form}</p>}
        <div className="tform__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <><LoaderCircle size={18} className="spin" aria-hidden="true" /> Creating your team…</> : <><Sparkles size={18} aria-hidden="true" /> Create team</>}
          </button>
        </div>
      </form>
    </Card>
  );
}

export function JoinTeamForm() {
  const t = useTeam();
  const uid = useId();
  const [code, setCode] = useState("");
  const [passkey, setPasskey] = useState("");
  const [person, setPerson] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState({});
  const codeRef = useRef(null);
  useEffect(() => { codeRef.current?.focus(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setErr({});
    setBusy(true);
    const r = await t.joinTeam({ code, passkey, personName: person });
    setBusy(false);
    if (!r.ok) setErr({ [r.field || "form"]: r.message });
  };
  return (
    <Card title="Join a team" mood="happy" onBack={() => t.setScreen("landing")} backLabel="Back to start">
      <p className="tcard__lead">Ask a teammate for the room code and passkey, then enter them below.</p>
      <form className="tform" onSubmit={submit} noValidate>
        <Field id={`${uid}-code`} label="Room code" hint="6 letters or numbers, like ABC-234" error={err.code}>
          <input id={`${uid}-code`} ref={codeRef} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false}
            placeholder="ABC-234" className="tform__mono" aria-invalid={Boolean(err.code)} aria-describedby={`${uid}-code-hint${err.code ? ` ${uid}-code-err` : ""}`} />
        </Field>
        <Field id={`${uid}-key`} label="Passkey" hint="8 letters or numbers, like ABCD-2345" error={err.passkey}>
          <span className="tform__pw">
            <input id={`${uid}-key`} type={show ? "text" : "password"} value={passkey} onChange={(e) => setPasskey(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false}
              placeholder="ABCD-2345" className="tform__mono" aria-invalid={Boolean(err.passkey)} aria-describedby={`${uid}-key-hint${err.passkey ? ` ${uid}-key-err` : ""}`} />
            <button type="button" className="icon-btn tform__eye" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide passkey" : "Show passkey"} aria-pressed={show}>
              {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
            </button>
          </span>
        </Field>
        <PersonField id={`${uid}-person`} value={person} onChange={setPerson} error={err.person} />
        {err.form && <p className="tform__error tform__error--box" role="alert">{err.form}</p>}
        <div className="tform__actions">
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <><LoaderCircle size={18} className="spin" aria-hidden="true" /> Joining…</> : "Join team"}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => t.setScreen("landing")}>Cancel</button>
        </div>
      </form>
    </Card>
  );
}

export function TeamCreated() {
  const t = useTeam();
  const s = useSession();
  const { current: team, passkey } = t;
  const [reveal, setReveal] = useState(false);
  const btnRef = useRef(null);
  useEffect(() => { celebrate(btnRef.current); }, []);
  if (!team) return null;
  const invite = () => buildInvitation({ name: team.name, code: team.code, passkey, ownerName: s.user?.getName?.() });
  return (
    <Card title="Your team is ready!" mood="happy" wide>
      <div className="tdone" ref={btnRef}>
        <p className="tdone__name">{team.name}</p>
        <dl className="tcreds">
          <div className="tcred">
            <dt>Room code</dt>
            <dd><code className="tcred__val" aria-label={`Room code ${team.code.split("").join(" ")}`}>{formatCode(team.code)}</code>
              <CopyButton getText={() => team.code} label="Copy room code" doneLabel="Room code copied!">Copy room code</CopyButton></dd>
          </div>
          <div className="tcred">
            <dt>Passkey</dt>
            <dd>
              <code className="tcred__val" aria-label={reveal ? `Passkey ${passkey.split("").join(" ")}` : "Passkey hidden"}>{reveal ? formatPasskey(passkey) : "••••-••••"}</code>
              <button type="button" className="btn btn--soft btn--small" onClick={() => setReveal((v) => !v)} aria-pressed={reveal}>
                {reveal ? <><EyeOff size={16} aria-hidden="true" /> Hide</> : <><Eye size={16} aria-hidden="true" /> Show</>}
              </button>
              <CopyButton getText={() => passkey} label="Copy passkey" doneLabel="Passkey copied!">Copy passkey</CopyButton>
            </dd>
          </div>
        </dl>
        <p className="tdone__warn" role="note">Save the passkey now. For safety, OGSlides can't show it again after you leave this screen.</p>
        <div className="tform__actions">
          <CopyButton className="btn btn--primary" getText={invite} label="Copy invitation" doneLabel="Invitation copied!">Copy invitation</CopyButton>
          <button type="button" className="btn btn--soft" onClick={() => t.setScreen("lobby")}>Open team lobby</button>
          <button type="button" className="btn btn--ghost" onClick={t.enterWorkspace}>Enter workspace</button>
        </div>
      </div>
    </Card>
  );
}
