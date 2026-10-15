import { Camera, CameraOff, ChevronDown, ChevronUp, LoaderCircle, Maximize2, Megaphone, Mic, MicOff, Minimize2, PhoneOff, RefreshCw, TriangleAlert, X } from "lucide-react";
import { Avatar } from "../ui/People.jsx";
import { STATUS_LABEL } from "./callLogic.js";
import { useCall } from "./CallProvider.jsx";

// The small panel that stays on screen on every page while you are in (or just left) a call.
// It also owns the element the Calls SDK draws video into, so that element exists on every page.
export default function CallDock() {
  const c = useCall();
  if (!c) return null;
  const idle = c.status === "idle";
  const video = c.mode === "video";
  const busy = ["checking-mic", "connecting", "leaving"].includes(c.status);
  const bad = c.status === "failed" || c.status === "ended";
  const tone = bad ? "bad" : c.status === "connected" ? "ok" : "warn";
  const name = c.title;
  const direct = c.kind === "direct";

  return (
    <section
      className={`calldock calldock--${tone}${video ? " calldock--video" : ""}${video && c.large ? " calldock--large" : ""}`}
      aria-label={name}
      hidden={idle}
    >
      <header className="calldock__head">
        <span className="calldock__state" role="status" aria-live="polite">
          {busy ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : bad ? <TriangleAlert size={16} aria-hidden="true" /> : <span className="calldock__dot" aria-hidden="true" />}
          <span>
            <strong>{name}</strong>
            <small>{STATUS_LABEL[c.status]}{c.status === "connected" ? ` · ${c.participants.length || 1} here` : ""}</small>
          </span>
        </span>
        <span className="calldock__headbtns">
          {c.inRoom && video && (
            <button className="icon-btn icon-btn--sm" onClick={() => c.setLarge(!c.large)} aria-pressed={c.large} aria-label={c.large ? "Make the video smaller" : "Make the video larger"} title={c.large ? "Smaller" : "Larger"}>
              {c.large ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          {c.inRoom && (
            <button className="icon-btn icon-btn--sm" onClick={() => c.setExpanded(!c.expanded)} aria-expanded={c.expanded} aria-label={c.expanded ? "Hide the list of people" : "Show who is here"} title={c.expanded ? "Hide people" : "Show people"}>
              {c.expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          )}
          {!c.inRoom && (
            <button className="icon-btn icon-btn--sm" onClick={c.dismiss} aria-label="Close this message" title="Close"><X size={16} /></button>
          )}
        </span>
      </header>

      {/* The SDK draws the call here. In a voice room it is hidden (audio only); in a video call it is the picture. */}
      <div ref={c.stageRef} className={`call-stage${video && c.inRoom ? " call-stage--video" : ""}`} aria-hidden={!video} />
      {video && c.inRoom && !c.cameraOn && c.status === "connected" && (
        <p className="calldock__note">Your camera is off. Press Camera to turn it on.</p>
      )}

      {bad && c.error && (
        <div className="calldock__error" role="alert">
          <p>{c.error.friendly}</p>
          <p className="calldock__tech">{c.error.technical}</p>
          <button className="btn btn--primary btn--small" onClick={() => c.join(c.mode)}><RefreshCw size={16} aria-hidden="true" /> Try again</button>
        </div>
      )}

      {c.inRoom && c.expanded && (
        <ul className="calldock__people" aria-label={`People in ${name}`}>
          {c.participants.length === 0 && <li className="calldock__empty">Waiting for the list of people…</li>}
          {c.participants.map((p) => {
            const isMuted = p.isSelf ? c.muted : Boolean(c.remoteMuted[p.uid]);
            const speaking = c.speakingUid === p.uid && !isMuted;
            return (
              <li key={p.uid} className={`calldock__person${speaking ? " is-speaking" : ""}`}>
                {p.avatar ? <img className="avatar" src={p.avatar} alt="" width={30} height={30} /> : <Avatar uid={p.uid} name={p.name} size={30} />}
                <span className="calldock__name">{p.name}{p.isSelf ? " (you)" : ""}</span>
                {speaking && <span className="calldock__speaking">speaking</span>}
                {isMuted && <MicOff size={15} className="calldock__muted" aria-label="muted" role="img" />}
              </li>
            );
          })}
        </ul>
      )}

      {c.inRoom && (
        <footer className="calldock__controls">
          <button className={`btn btn--small ${c.muted ? "btn--danger" : "btn--soft"}`} onClick={c.toggleMute} disabled={c.status !== "connected"} aria-pressed={c.muted}>
            {c.muted ? <MicOff size={16} aria-hidden="true" /> : <Mic size={16} aria-hidden="true" />}
            {c.muted ? "Unmute" : "Mute"}
          </button>
          {video && (
            <button className={`btn btn--small ${c.cameraOn ? "btn--soft" : "btn--ghost"}`} onClick={c.toggleCamera} disabled={c.status !== "connected"} aria-pressed={c.cameraOn}>
              {c.cameraOn ? <Camera size={16} aria-hidden="true" /> : <CameraOff size={16} aria-hidden="true" />}
              {c.cameraOn ? "Camera on" : "Camera off"}
            </button>
          )}
          <button className="btn btn--small btn--ghost" onClick={c.leave} disabled={c.status === "leaving"}>
            <PhoneOff size={16} aria-hidden="true" /> {direct ? "End call" : "Leave"}
          </button>
        </footer>
      )}
      {c.status === "connected" && !direct && (
        <div className="calldock__invite">
          <button className="btn btn--small btn--ghost" onClick={c.notifyTeam} disabled={c.notified}>
            <Megaphone size={16} aria-hidden="true" /> {c.notified ? "Team told" : "Tell the team in chat"}
          </button>
        </div>
      )}
    </section>
  );
}
