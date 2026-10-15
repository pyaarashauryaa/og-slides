import { useEffect, useState } from "react";
import { CometChatProvider, CometChatMessageHeader, CometChatMessageList, CometChatMessageComposer } from "@cometchat/chat-uikit-react";
import { LoaderCircle, Mic, RefreshCw, TriangleAlert } from "lucide-react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { useTeam } from "../team/TeamProvider.jsx";
import { explainError } from "../cometchat/explainError.js";
import { voiceSupport, voiceHelp, explainVoiceError } from "../cometchat/voice.js";
import { useToast } from "../ui/Toast.jsx";
import { ogAudioPlugin } from "../cometchat/audioPlugin.jsx";
import VoiceNoteRecorder from "./VoiceNoteRecorder.jsx";
import { useSession } from "../session/SessionProvider.jsx";

const PLUGINS = [ogAudioPlugin]; // module-level: a new array every render would rebuild the kit's plugin list

// The team chat room. Used on the Team chat page and inside the slide editor.
// It must only be rendered after sign-in (SessionGate / DataGate take care of that).
export default function TeamChatPanel() {
  const session = useSession();
  const team = useTeam();
  const toast = useToast();
  const voice = voiceSupport();
  const [phase, setPhase] = useState("joining");
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (session.dev) return undefined;
    let cancelled = false;
    setPhase("joining");
    setError(null);
    CometChat.getGroup(team.current.chatGuid).then(
      (room) => {
        if (cancelled) return;
        setGroup(room);
        setPhase("ready");
      },
      (e) => {
        if (cancelled) return;
        console.error("OGSlides chat setup failed:", e);
        setError(explainError(e));
        setPhase("error");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, session.uid, session.dev, team.current?.chatGuid]);

  if (session.dev) {
    return (
      <div className="panel panel--busy">
        <p>Team chat needs the real CometChat connection. It is switched off in the dev test mode.</p>
      </div>
    );
  }
  if (phase === "joining") {
    return (
      <div className="panel panel--busy" role="status">
        <LoaderCircle className="spin" size={28} aria-hidden="true" />
        <p>Opening the team room…</p>
      </div>
    );
  }
  if (phase === "error") {
    return (
      <div className="panel" role="alert">
        <TriangleAlert size={28} strokeWidth={1.75} className="panel__icon" aria-hidden="true" />
        <h2>Couldn't open the team room</h2>
        <p className="panel__lead">{error?.friendly}</p>
        <p className="panel__tech">{error?.technical}</p>
        <div className="panel__actions">
          <button className="btn btn--primary" onClick={() => setAttempt((a) => a + 1)}>
            <RefreshCw size={18} aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="chat-shell">
      <CometChatProvider plugins={PLUGINS}>
        <div className="chat-window">
          <CometChatMessageHeader group={group} hideVoiceCallButton hideVideoCallButton />
          <CometChatMessageList group={group} />
          {voice.ok ? (
            <VoiceNoteRecorder group={group} />
          ) : (
            <p className="voice-tip voice-tip--off" role="note">
              <Mic size={14} aria-hidden="true" />
              {voiceHelp(voice.reason)}
            </p>
          )}
          <CometChatMessageComposer
            group={group}
            hideVoiceRecordingButton
            onError={(e) => toast(explainVoiceError(e), "error")}
          />
        </div>
      </CometChatProvider>
    </div>
  );
}
