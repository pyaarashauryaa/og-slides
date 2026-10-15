// The very first screen: shown until someone picks which CometChat test user this tab is.
// Layout: left = headline + who-are-you tickets, right = a little illustrated desk (slide stack + Pip).
// It only changes how the choice LOOKS. Picking still calls onPick(uid) exactly as before.
import Logo from "../components/Logo.jsx";
import Mascot from "../ui/Mascot.jsx";
import { TEST_USERS } from "../cometchat/testUsers.js";

// One paper-ticket colour per user. Index-based, so no names or users are invented.
const TICKET = ["rani", "cobalt", "butter", "mint", "lilac"];

export function Doodles() {
  return (
    <div className="doodles" aria-hidden="true">
      <svg className="doodle doodle--star" viewBox="0 0 40 40"><path d="M20 3l4.6 11.6L37 16l-9.5 8.2L30.4 37 20 30.2 9.6 37l2.9-12.8L3 16l12.4-1.4z" fill="var(--butter)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" /></svg>
      <svg className="doodle doodle--squig" viewBox="0 0 90 24"><path d="M3 12q10-14 20 0t20 0 20 0 20 0" fill="none" stroke="var(--rani)" strokeWidth="4.5" strokeLinecap="round" /></svg>
      <svg className="doodle doodle--clip" viewBox="0 0 28 64"><path d="M20 24v26a8 8 0 0 1-16 0V14a10 10 0 0 1 20 0v32a5 5 0 0 1-10 0V22" fill="none" stroke="var(--cobalt)" strokeWidth="3.4" strokeLinecap="round" /></svg>
      <svg className="doodle doodle--ring" viewBox="0 0 60 60"><circle cx="30" cy="30" r="22" fill="none" stroke="var(--ink)" strokeWidth="2.6" strokeDasharray="2 7" strokeLinecap="round" /></svg>
      <svg className="doodle doodle--plus" viewBox="0 0 30 30"><path d="M15 4v22M4 15h22" stroke="var(--coral)" strokeWidth="5" strokeLinecap="round" /></svg>
      <span className="doodle doodle--dot" />
      <span className="doodle doodle--half" />
    </div>
  );
}

export function SlideStack({ note = "hi! pick a seat →" }) {
  return (
    <div className="stack" aria-hidden="true">
      <div className="stack__sheet stack__sheet--back">
        <i /><i /><i />
      </div>
      <div className="stack__sheet stack__sheet--mid">
        <b className="stack__bar" />
        <span className="stack__chart"><i style={{ height: "38%" }} /><i style={{ height: "64%" }} /><i style={{ height: "48%" }} /><i style={{ height: "82%" }} /></span>
      </div>
      <div className="stack__sheet stack__sheet--front">
        <b className="stack__title">Big idea</b>
        <span className="stack__line" /><span className="stack__line stack__line--short" />
        <span className="stack__tape" />
      </div>
      <Mascot className="stack__pip" size={150} mood="happy" />
      <span className="stack__note">{note}</span>
    </div>
  );
}

export default function Welcome({ onPick, onBack }) {
  return (
    <main className="welcome" id="main-content">
      <Doodles />
      <div className="welcome__col">
        <header className="welcome__brand"><Logo size={44} /></header>
        {onBack && <button type="button" className="btn btn--ghost btn--small welcome__back" onClick={onBack}>← Back to start</button>}
        <p className="welcome__tag"><span>Team room for slide makers</span></p>
        <h1 className="welcome__title">
          Good ideas <mark>look good</mark> here.
        </h1>
        <p className="welcome__sub">
          Build a deck with your team, watch edits land as they type, and talk it through in the same room. No emailing files back and forth.
        </p>

        <section className="welcome__who" aria-labelledby="who-h">
          <h2 id="who-h" className="welcome__who-h">Who’s making slides in this tab?</h2>
          <ul className="tickets stagger">
            {TEST_USERS.map((u, i) => (
              <li key={u.uid} style={{ "--i": i + 3 }}>
                <button className={`ticket ticket--${TICKET[i % TICKET.length]}`} onClick={() => onPick(u.uid)}>
                  <span className="ticket__badge" aria-hidden="true">{i + 1}</span>
                  <span className="ticket__text">
                    <strong>{u.label}</strong>
                    <small>{u.uid}</small>
                  </span>
                  <span className="ticket__go" aria-hidden="true">Go →</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="welcome__hint">Open OGSlides in a second tab and pick someone else to work on the same deck together.</p>
        </section>
      </div>

      <div className="welcome__art"><SlideStack /></div>
    </main>
  );
}
