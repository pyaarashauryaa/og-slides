import { useCallback, useState } from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatMediaRecorder, usePublishEvent, useCometChatMediaRecorderContext } from "@cometchat/chat-uikit-react";
import { Mic, Send, X, CircleAlert } from "lucide-react";
import { buildVoiceFile, voiceMetadata, analyseRecording } from "../cometchat/voiceNote.js";
import { explainVoiceError } from "../cometchat/voice.js";
import { useToast } from "../ui/Toast.jsx";

function SendButton() {
  const { inlineSend } = useCometChatMediaRecorderContext();
  return (
    <button type="button" className="btn btn--primary btn--small" onClick={inlineSend} aria-label="Send voice note">
      <Send size={16} aria-hidden="true" /> Send
    </button>
  );
}

// OGSlides' own voice-note button. It reuses the chat kit's recorder (record, pause, listen back) but sends the
// file itself, with the correct name and audio type, through CometChat's normal media upload.
export default function VoiceNoteRecorder({ group }) {
  const toast = useToast();
  const publish = usePublishEvent();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [check, setCheck] = useState(null); // { text } shown only when something went wrong

  const onSubmit = useCallback(async (blob) => {
    setOpen(false);
    const built = buildVoiceFile(blob);
    if (!built.ok) {
      toast(built.message, "error");
      return;
    }
    setSending(true);
    setCheck(null);
    let msg = null;
    try {
      // Measured here, once, so everyone who receives the note sees its real length and waveform.
      const info = await analyseRecording(blob);
      msg = new CometChat.MediaMessage(group.getGuid(), built.file, CometChat.MESSAGE_TYPE.AUDIO, CometChat.RECEIVER_TYPE.GROUP);
      msg.setMuid(`_${Math.random().toString(36).slice(2, 11)}`);
      msg.setSentAt(Math.floor(Date.now() / 1000));
      msg.setMetadata(voiceMetadata(built.file, info));
      try { const me = await CometChat.getLoggedinUser(); if (me) msg.setSender(me); } catch { /* sender is filled in by the server */ }
      // Same events the chat kit's own composer publishes, so the message list shows the note straight away
      // ("sending"), then confirms it, or marks it failed.
      publish({ type: "ui:message/sent", message: msg, status: "inprogress" });
      const sent = await CometChat.sendMediaMessage(msg);
      publish({ type: "ui:message/sent", message: sent, status: "success" });
    } catch (e) {
      console.error("OGSlides voice note failed to send:", e?.code || e?.name || "error");
      if (msg) publish({ type: "ui:message/sent", message: msg, status: "error" });
      toast(explainVoiceError(e), "error");
      setCheck({ text: "The voice note could not be sent. Check your connection and try again." });
    } finally {
      setSending(false);
    }
  }, [group, toast, publish]);

  return (
    <div className="voicenote">
      {!open && (
        <div className="voicenote__row">
          <button type="button" className="btn btn--soft btn--small" onClick={() => { setCheck(null); setOpen(true); }} disabled={sending}>
            <Mic size={16} aria-hidden="true" /> {sending ? "Sending voice note…" : "Record voice note"}
          </button>
          <span className="voicenote__hint">Nothing records until you click. You can listen before sending.</span>
        </div>
      )}
      {open && (
        <div className="voicenote__rec" role="group" aria-label="Voice note recorder">
          <CometChatMediaRecorder.Root autoRecording onClose={() => setOpen(false)} onSubmit={onSubmit} onError={(e) => { toast(explainVoiceError(e), "error"); setOpen(false); }}>
            <CometChatMediaRecorder.ErrorView />
            <CometChatMediaRecorder.Controls />
            <CometChatMediaRecorder.RecordingView><CometChatMediaRecorder.Timer /></CometChatMediaRecorder.RecordingView>
            <CometChatMediaRecorder.PreviewView><CometChatMediaRecorder.Timer /></CometChatMediaRecorder.PreviewView>
            <SendButton />
          </CometChatMediaRecorder.Root>
          <button type="button" className="icon-btn icon-btn--sm" onClick={() => setOpen(false)} aria-label="Cancel voice note" title="Cancel"><X size={16} /></button>
        </div>
      )}
      {check && (
        <p className="voicenote__check is-bad" role="status">
          <CircleAlert size={14} aria-hidden="true" /> {check.text}
        </p>
      )}
    </div>
  );
}
