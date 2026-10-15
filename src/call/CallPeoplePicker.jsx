import { useCallback, useEffect, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { ArrowLeft, LoaderCircle, Phone, RefreshCw, Video } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import { Button } from "../ui/Button.jsx";
import { Avatar } from "../ui/People.jsx";
import { useSession } from "../session/SessionProvider.jsx";
import { useCall } from "./CallProvider.jsx";
import { selectableUsers } from "./directCall.js";
import { useTeam } from "../team/TeamProvider.jsx";

// Pick ONE teammate, then choose Voice or Video. The person and the call type are shown before anything rings.
export default function CallPeoplePicker({ onClose }) {
  const call = useCall();
  const session = useSession();
  const team = useTeam();
  const [phase, setPhase] = useState("loading"); // loading | ready | error
  const [people, setPeople] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    let cancelled = false;
    setPhase("loading");
    // Only people in THIS team can be called (not everyone who has an account in the app).
    new CometChat.GroupMembersRequestBuilder(team.current.chatGuid).setLimit(100).build().fetchNext().then(
      (users) => {
        if (cancelled) return;
        setPeople(selectableUsers(users, session.uid));
        setPhase("ready");
      },
      (e) => {
        if (cancelled) return;
        console.error("OGSlides: couldn't load teammates:", e?.code || e?.name || "error");
        setPhase("error");
      }
    );
    return () => { cancelled = true; };
  }, [session.uid, team.current?.chatGuid]);

  useEffect(() => load(), [load, attempt]);

  const start = async (type) => {
    setBusy(true);
    const ok = await call.callUser(chosen, type);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title={chosen ? `Call ${chosen.name}` : "Call a teammate"} onClose={onClose}>
      {phase === "loading" && <p role="status" className="picker__msg"><LoaderCircle size={18} className="spin" aria-hidden="true" /> Finding your teammates…</p>}
      {phase === "error" && (
        <div role="alert" className="picker__msg">
          <p>Couldn't load your teammates. Check your connection and try again.</p>
          <Button variant="secondary" size="sm" onClick={() => setAttempt((a) => a + 1)}><RefreshCw size={16} aria-hidden="true" /> Try again</Button>
        </div>
      )}
      {phase === "ready" && !chosen && (
        people.length === 0
          ? <p className="picker__msg">No other teammates found yet. Sign in as a second user in another tab, then reopen this.</p>
          : (
            <ul className="picker" aria-label="Teammates you can call">
              {people.map((p) => (
                <li key={p.uid}>
                  <button className="picker__row" onClick={() => setChosen(p)}>
                    {p.avatar ? <img className="avatar" src={p.avatar} alt="" width={36} height={36} /> : <Avatar uid={p.uid} name={p.name} size={36} />}
                    <span className="picker__name">{p.name}</span>
                    <span className={`picker__status${p.online ? " is-online" : ""}`}>{p.online ? "Online" : "Offline"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
      )}
      {phase === "ready" && chosen && (
        <div className="picker__confirm">
          <div className="picker__who">
            {chosen.avatar ? <img className="avatar" src={chosen.avatar} alt="" width={56} height={56} /> : <Avatar uid={chosen.uid} name={chosen.name} size={56} />}
            <div>
              <p className="picker__big">{chosen.name}</p>
              <p className="picker__small">{chosen.online ? "Online now" : "Offline. They may not see the call."}</p>
            </div>
          </div>
          <p className="picker__small">Only {chosen.name} will be called. Your microphone is used; your camera stays off until you turn it on.</p>
          <div className="picker__actions">
            <Button onClick={() => start("voice")} disabled={busy} aria-label={`Start a voice call with ${chosen.name}`}><Phone size={18} aria-hidden="true" /> Voice call</Button>
            <Button variant="secondary" onClick={() => start("video")} disabled={busy} aria-label={`Start a video call with ${chosen.name}`}><Video size={18} aria-hidden="true" /> Video call</Button>
            <Button variant="ghost" onClick={() => setChosen(null)} disabled={busy}><ArrowLeft size={18} aria-hidden="true" /> Back</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
