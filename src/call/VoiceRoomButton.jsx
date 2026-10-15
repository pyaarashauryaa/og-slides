import { useEffect, useState } from "react";
import { Headphones, Phone, PhoneOff, Video } from "lucide-react";
import CallPeoplePicker from "./CallPeoplePicker.jsx";
import { useCall } from "./CallProvider.jsx";
import { roomName } from "./callLogic.js";

// The always-visible entry points (in the top bar, so they are on every page): Voice room and Video call.
export default function VoiceRoomButton() {
  const c = useCall();
  const [picking, setPicking] = useState(false);
  // Other parts of the app (Home, quick jump) ask for the "call a teammate" list through this event.
  const canPick = Boolean(c?.available && !c?.inRoom && !c?.ring);
  useEffect(() => {
    const open = () => { if (canPick) setPicking(true); };
    window.addEventListener("ogslides:call-picker", open);
    return () => window.removeEventListener("ogslides:call-picker", open);
  }, [canPick]);
  if (!c) return null;
  if (!c.available) {
    return (
      <span className="voicebtns">
        <button className="btn btn--small btn--ghost voicebtn" disabled title="Calls need the real CometChat connection (switched off in dev test mode or before sign-in)">
          <Headphones size={16} aria-hidden="true" /> <span className="voicebtn__text">Voice room</span>
        </button>
      </span>
    );
  }
  if (c.inRoom) {
    return (
      <span className="voicebtns">
        <button className="btn btn--small btn--ghost voicebtn voicebtn--live" onClick={c.leave} disabled={c.status === "leaving"} title={c.kind === "direct" ? "End this call" : `Leave the ${roomName(c.mode).toLowerCase()}`}>
          <PhoneOff size={16} aria-hidden="true" /> <span className="voicebtn__text">{c.kind === "direct" ? "End call" : `Leave ${c.mode === "video" ? "video" : "voice"}`}</span>
        </button>
      </span>
    );
  }
  return (
    <span className="voicebtns">
      <button className="btn btn--small btn--primary voicebtn" onClick={() => c.join("voice")} title="Join the team voice room. Your browser will ask to use your microphone.">
        <Headphones size={16} aria-hidden="true" /> <span className="voicebtn__text">Voice room</span>
      </button>
      <button className="btn btn--small btn--soft voicebtn" onClick={() => c.join("video")} title="Join the team video call. Your microphone is used; your camera stays off until you turn it on.">
        <Video size={16} aria-hidden="true" /> <span className="voicebtn__text">Video call</span>
      </button>
      <button className="btn btn--small btn--ghost voicebtn" onClick={() => setPicking(true)} disabled={Boolean(c.ring)} title="Ring one teammate with a voice or video call" aria-label="Call a teammate">
        <Phone size={16} aria-hidden="true" /> <span className="voicebtn__text">Call a teammate</span>
      </button>
      {picking && <CallPeoplePicker onClose={() => setPicking(false)} />}
    </span>
  );
}
