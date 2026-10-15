import { useEffect, useRef } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Avatar } from "../ui/People.jsx";
import { callKindLabel } from "./directCall.js";
import { useCall } from "./CallProvider.jsx";

function Face({ person }) {
  return person.avatar
    ? <img className="avatar" src={person.avatar} alt="" width={56} height={56} />
    : <Avatar uid={person.uid} name={person.name} size={56} />;
}

// Incoming and outgoing ringing cards. They sit at the top of the screen on every page, don't dim or lock the
// page, and can be answered with the keyboard.
export default function CallPopups() {
  const c = useCall();
  const acceptRef = useRef(null);
  const ring = c?.ring;
  const sid = ring?.sid;
  const dir = ring?.dir;

  // A call is urgent, so move focus to "Accept" the moment it rings (once per call).
  useEffect(() => {
    if (dir === "in") acceptRef.current?.focus();
  }, [sid, dir]);

  if (!c || !ring) return null;
  const video = ring.mode === "video";
  const Icon = video ? Video : Phone;
  const label = callKindLabel(ring.mode);

  if (ring.dir === "in") {
    return (
      <div
        className="ringcard ringcard--in"
        role="alertdialog"
        aria-labelledby="ring-title"
        aria-describedby="ring-sub"
        onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); c.declineIncoming(); } }}
      >
        <div className="ringcard__who">
          <span className="ringcard__pulse"><Face person={ring.peer} /></span>
          <div>
            <p className="ringcard__title" id="ring-title">{ring.peer.name}</p>
            <p className="ringcard__sub" id="ring-sub"><Icon size={14} aria-hidden="true" /> Incoming {label}…</p>
            {video && <p className="ringcard__note">Your camera stays off until you turn it on.</p>}
          </div>
        </div>
        <div className="ringcard__actions">
          <button ref={acceptRef} className="btn btn--primary ringcard__btn ringcard__btn--accept" onClick={c.acceptIncoming}>
            <Icon size={18} aria-hidden="true" /> Accept
          </button>
          <button className="btn btn--danger ringcard__btn" onClick={() => c.declineIncoming()}>
            <PhoneOff size={18} aria-hidden="true" /> Decline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ringcard ringcard--out" role="status" aria-live="polite">
      <div className="ringcard__who">
        <span className="ringcard__pulse"><Face person={ring.peer} /></span>
        <div>
          <p className="ringcard__title">Calling {ring.peer.name}…</p>
          <p className="ringcard__sub"><Icon size={14} aria-hidden="true" /> {label[0].toUpperCase() + label.slice(1)} · waiting for them to answer</p>
        </div>
      </div>
      <div className="ringcard__actions">
        <button className="btn btn--danger ringcard__btn" onClick={() => c.cancelOutgoing()}>
          <PhoneOff size={18} aria-hidden="true" /> Cancel
        </button>
      </div>
    </div>
  );
}
