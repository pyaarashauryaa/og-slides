// Plain helpers for calling. No React and no SDK in here, so they can be unit-tested.

// Everyone who joins the "Voice room" joins this ONE shared session ID.
export const VOICE_ROOM_SESSION_ID = "ogslides-voice-room";
// The video room is a separate session, so a voice-only room and a video room never mix.
export const VIDEO_ROOM_SESSION_ID = "ogslides-video-room";
// Each team has its own call room: the team code is part of the session id, so teams never end up in each other's call.
// (The old shared room keeps its original ids.)
export const sessionIdFor = (mode, teamCode = "") => {
  const base = mode === "video" ? VIDEO_ROOM_SESSION_ID : VOICE_ROOM_SESSION_ID;
  return teamCode && teamCode !== "LEGACY" ? `${base}-${String(teamCode).toLowerCase()}` : base;
};
export const roomName = (mode) => (mode === "video" ? "Video call" : "Voice room");

// idle | checking-mic | connecting | connected | reconnecting | leaving | failed | ended
export const STATUS_LABEL = {
  idle: "Not in the voice room",
  "checking-mic": "Checking your microphone…",
  connecting: "Connecting…",
  connected: "Connected",
  reconnecting: "Connection lost. Trying to reconnect…",
  leaving: "Leaving…",
  failed: "Couldn't connect",
  ended: "Voice room ended",
};

export const isInRoom = (status) => ["checking-mic", "connecting", "connected", "reconnecting", "leaving"].includes(status);

// Can this browser tab use the microphone at all?
export function callSupport(env = globalThis) {
  if (!env.navigator) return { ok: false, reason: "no-browser" };
  if (env.isSecureContext === false) return { ok: false, reason: "insecure" };
  if (!env.navigator.mediaDevices?.getUserMedia) return { ok: false, reason: "no-mic-api" };
  return { ok: true, reason: "" };
}

export function callSupportHelp(reason) {
  switch (reason) {
    case "insecure":
      return "Calls only work on https:// pages or on localhost. Open the app from localhost or your https address.";
    case "no-mic-api":
    case "no-browser":
      return "This browser can't use a microphone here. Try the latest Chrome, Edge, Firefox or Safari.";
    default:
      return "";
  }
}

// Turn a microphone/camera error into a plain sentence.
export function explainMediaError(err, kind = "microphone") {
  const text = `${err?.name || ""} ${err?.message || err || ""}`;
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return `${cap(kind)} access was blocked. Click the lock icon next to the address bar, allow the ${kind}, then try again.`;
  }
  if (/NotFound|DevicesNotFound|Requested device not found/i.test(text)) {
    return `No ${kind} was found. Plug one in or check your system sound settings, then try again.`;
  }
  if (/NotReadable|TrackStart|in use|Could not start/i.test(text)) {
    return `Your ${kind} is being used by another app. Close that app and try again.`;
  }
  if (/Overconstrained/i.test(text)) return `Your ${kind} can't be used with these settings. Try a different one.`;
  return `The ${kind} couldn't be started. Check your browser's permission and try again.`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Turn any join error (CometChat, network, permission) into { friendly, technical }.
export function explainCallError(err) {
  const raw = err?.code || err?.name || "";
  const message = err?.message || (typeof err === "string" ? err : "");
  const technical = [raw, message].filter(Boolean).join(": ") || "Unknown error";
  const text = `${raw} ${message}`;
  let friendly;
  if (/NotAllowedError|NotFoundError|NotReadableError|OverconstrainedError|Permission denied|Permission dismissed/i.test(text)) {
    friendly = explainMediaError(err, "microphone");
  } else if (/not.?init|CALLS_SDK_MISSING|not available/i.test(text)) {
    friendly = "Calling isn't switched on for this app yet. Check that the calling package is installed and restart the dev server.";
  } else if (/ERR_PLAN|plan|feature.*(not|disabled)|not enabled|CALLS_NOT_ENABLED|403/i.test(text)) {
    friendly = "Voice & Video Calling isn't enabled for this CometChat app. Turn it on in the CometChat dashboard (Calls → Settings), then try again.";
  } else if (/AUTH_NOT_SIGNED_IN|AUTH_NO_TOKEN/i.test(text)) {
    friendly = "You're not signed in to CometChat in this tab yet. Wait for the green \"Live\" badge at the top, then try again.";
  } else if (/CALLS_INIT_FAILED/i.test(text)) {
    friendly = "Calling couldn't start. Check your App ID and Region in .env and that Voice & Video Calling is on in the CometChat dashboard.";
  } else if (/AUTH|token|401|invalid|unauthor/i.test(text)) {
    friendly = "CometChat refused the call token. Sign out and in again, then retry.";
  } else if (/network|fetch|internet|timeout|offline|WS_CONNECTION/i.test(text)) {
    friendly = "Couldn't reach CometChat. Check your internet connection and try again.";
  } else {
    friendly = "Couldn't join the voice room. Try again in a moment.";
  }
  return { friendly, technical };
}

// SDK participants -> what the panel shows. You first, then others by name.
export function normaliseParticipants(list, selfUid) {
  const seen = new Set();
  const out = [];
  for (const p of Array.isArray(list) ? list : []) {
    if (!p || typeof p !== "object") continue;
    const uid = String(p.uid ?? p.pid ?? "");
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    out.push({
      uid,
      pid: p.pid ? String(p.pid) : uid,
      name: String(p.name || uid),
      avatar: typeof p.avatar === "string" && /^https?:\/\//i.test(p.avatar) ? p.avatar : "",
      isSelf: uid === selfUid,
    });
  }
  return out.sort((a, b) => (a.isSelf === b.isSelf ? a.name.localeCompare(b.name) : a.isSelf ? -1 : 1));
}

// Voice room settings. The SDK's own controls are hidden: OGSlides draws its own, so they match the app.
export function voiceSessionSettings() {
  return {
    sessionType: "VOICE",
    layout: "TILE",
    startAudioMuted: false,
    hideControlPanel: true,
    hideHeaderPanel: true,
    hideLeaveSessionButton: true,
    hideToggleAudioButton: true,
    hideScreenSharingButton: true,
    hideRecordingButton: true,
  };
}

// Video call settings. The camera stays OFF until the person presses the camera button themselves.
export function videoSessionSettings() {
  return {
    sessionType: "VIDEO",
    layout: "TILE",
    startAudioMuted: false,
    startVideoPaused: true,
    hideControlPanel: true,
    hideHeaderPanel: true,
    hideLeaveSessionButton: true,
    hideToggleAudioButton: true,
    hideToggleVideoButton: true,
    hideScreenSharingButton: true, // screen sharing is not part of Phase 4
    hideRecordingButton: true,
    hideChangeLayoutButton: true,
    hideVirtualBackgroundButton: true,
    hideRaiseHandButton: true,
    hideShareInviteButton: true,
    hideChatButton: true,
  };
}
export const sessionSettingsFor = (mode) => (mode === "video" ? videoSessionSettings() : voiceSessionSettings());

// The text posted to the team chat when someone presses "Tell the team".
export function inviteText(name, mode) {
  const who = String(name || "Someone").slice(0, 60);
  return mode === "video"
    ? `${who} is in a video call. Open OGSlides and press "Video call" at the top to join. Your camera stays off until you turn it on.`
    : `${who} is in the voice room. Open OGSlides and press "Voice room" at the top to join.`;
}
