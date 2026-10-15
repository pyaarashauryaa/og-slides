// Pure helpers for one-to-one ("ringing") calls. No React and no SDK, so they are unit-tested.
// These sit on CometChat's call signalling: initiateCall / acceptCall / rejectCall / endCall and the CallListener events.

export const RING_SECONDS = 30; // how long a call rings before it counts as "no answer" (caller and recipient)

const str = (v) => (typeof v === "string" ? v : "");
const call_ = (c, m) => (c && typeof c[m] === "function" ? c[m]() : undefined);

export const callType = (call) => (str(call_(call, "getType")).toLowerCase() === "video" ? "video" : "voice");
export const callSid = (call) => str(call_(call, "getSessionId"));
const uidOf = (u) => str(u && typeof u.getUid === "function" ? u.getUid() : u?.uid);
const nameOf = (u) => str(u && typeof u.getName === "function" ? u.getName() : u?.name);
const avatarOf = (u) => {
  const a = str(u && typeof u.getAvatar === "function" ? u.getAvatar() : u?.avatar);
  return /^https?:\/\//i.test(a) ? a : "";
};
export const toPerson = (u) => ({ uid: uidOf(u), name: nameOf(u) || uidOf(u) || "Someone", avatar: avatarOf(u) });

// The OTHER person in a call.
export function peerFromCall(call, selfUid) {
  const sender = call_(call, "getSender");
  const receiver = call_(call, "getReceiver");
  return uidOf(sender) && uidOf(sender) !== selfUid ? toPerson(sender) : toPerson(receiver);
}

// What to do with an incoming-call event.
//   ignore    - not a call for this person to answer (no call, my own call, or a group call)
//   duplicate - this exact call is already ringing (the SDK can deliver an event twice)
//   busy      - I'm already in a call or ringing for a different one: tell the caller "busy"
//   show      - show the pop-up
export function decideIncoming({ call, selfUid, busy, ringSid }) {
  const sid = callSid(call);
  if (!call || !sid) return "ignore";
  if (uidOf(call_(call, "getSender")) === selfUid) return "ignore";
  const rt = str(call_(call, "getReceiverType")).toLowerCase();
  if (rt && rt !== "user") return "ignore";
  if (ringSid && ringSid === sid) return "duplicate";
  if (busy) return "busy";
  return "show";
}

// One plain sentence for what happened to a call.
export function outcomeMessage(status, name) {
  const who = name || "They";
  switch (String(status || "").toLowerCase()) {
    case "rejected": return `${who} declined the call.`;
    case "busy": return `${who} is on another call.`;
    case "cancelled": return `Missed call from ${who}.`;
    case "unanswered": return `${who} didn't answer.`;
    case "ended": return `${who} ended the call.`;
    default: return "The call ended.";
  }
}

export function explainDirectError(err) {
  const text = `${err?.name || ""} ${err?.code || ""} ${err?.message || err || ""}`;
  if (/NotAllowed|NotFound|NotReadable|Permission/i.test(text)) return null; // the media explainer handles these
  if (/ALREADY|IN_PROGRESS|ongoing/i.test(text)) return "You or they are already in a call. Finish that call first.";
  if (/UID_NOT_FOUND|not exist|USER_NOT/i.test(text)) return "That person could not be found.";
  if (/plan|ERR_PLAN|not enabled|403/i.test(text)) return "Voice & Video Calling isn't enabled for this CometChat app. Turn it on in the CometChat dashboard (Calls), then try again.";
  if (/network|fetch|internet|WS_|timeout|offline/i.test(text)) return "Couldn't reach CometChat. Check your internet connection and try again.";
  return "The call couldn't be placed. Try again in a moment.";
}

// People you can call: everyone except you, online first, then by name.
export function selectableUsers(users, selfUid) {
  const seen = new Set();
  const out = [];
  for (const u of Array.isArray(users) ? users : []) {
    const p = toPerson(u);
    if (!p.uid || p.uid === selfUid || seen.has(p.uid)) continue;
    seen.add(p.uid);
    const status = str(u && typeof u.getStatus === "function" ? u.getStatus() : u?.status).toLowerCase();
    out.push({ ...p, online: status === "online" });
  }
  return out.sort((a, b) => (a.online === b.online ? a.name.localeCompare(b.name) : a.online ? -1 : 1));
}

export const directTitle = (mode, peerName) => `${mode === "video" ? "Video" : "Voice"} call with ${peerName || "teammate"}`;
export const callKindLabel = (mode) => (mode === "video" ? "video call" : "voice call");
