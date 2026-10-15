// Voice notes use the chat kit's own recorder (CometChatMediaRecorder inside the message composer).
// It asks for the microphone only when the person clicks the mic button, and sends the recording
// through CometChat's normal media upload. This file only checks whether the browser CAN record,
// so we can show a clear message instead of a mic button that silently does nothing.
export function voiceSupport(env = globalThis) {
  const nav = env.navigator;
  if (!nav) return { ok: false, reason: "no-browser" };
  const secure = env.isSecureContext !== false; // microphones only work on https:// or localhost
  if (!secure) return { ok: false, reason: "insecure" };
  if (!nav.mediaDevices || typeof nav.mediaDevices.getUserMedia !== "function") return { ok: false, reason: "no-mic-api" };
  if (typeof env.MediaRecorder === "undefined") return { ok: false, reason: "no-recorder" };
  return { ok: true, reason: "" };
}

export function voiceHelp(reason) {
  switch (reason) {
    case "insecure":
      return "Voice notes need a secure page (https:// or localhost). Open OGSlides from localhost or your https link.";
    case "no-mic-api":
    case "no-recorder":
    case "no-browser":
      return "This browser can't record audio. Voice notes work in current Chrome, Edge, Firefox and Safari.";
    default:
      return "";
  }
}

// Turns a chat-kit error into one plain sentence for a toast.
export function explainVoiceError(err) {
  const text = String(err?.message || err?.code || err || "").toLowerCase();
  if (/permission|notallowed|denied/.test(text)) return "Microphone access was blocked. Allow the microphone in your browser's address bar, then try again.";
  if (/notfound|no.*(device|microphone)/.test(text)) return "No microphone was found. Plug one in and try again.";
  if (/network|offline|timeout|fetch/.test(text)) return "Couldn't send. Check your internet connection and try again.";
  return "Something went wrong with the message. Please try again.";
}
