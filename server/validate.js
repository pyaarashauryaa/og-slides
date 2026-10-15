// Pure input checks for the auth server. Nothing here talks to the network.
export const NAME_MAX = 40;
export const UID_RE = /^og-[0-9a-f]{16}$/;           // ids the SERVER makes; a visitor can never pick one
export const SECRET_RE = /^[A-Za-z0-9_-]{43}$/;      // base64url of a 32-byte HMAC
export const DEMO_UIDS = ["cometchat-uid-1", "cometchat-uid-2", "cometchat-uid-3", "cometchat-uid-4", "cometchat-uid-5"];

// Control characters, zero-width / direction-control characters and line separators are removed from names.
const BAD_CHARS = new RegExp("[" + "\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069" + "]", "g");

export function cleanName(input) {
  if (typeof input !== "string") return { ok: false, message: "Please enter a name." };
  const n = input.replace(BAD_CHARS, "").trim().replace(/\s+/g, " ");
  if (!n) return { ok: false, message: "Please enter a name." };
  if ([...n].length > NAME_MAX) return { ok: false, message: `Names can be up to ${NAME_MAX} characters.` };
  return { ok: true, name: n };
}

export function checkLogin(body) {
  if (!body || typeof body !== "object") return { ok: false };
  const { uid, deviceSecret } = body;
  if (typeof uid !== "string" || !UID_RE.test(uid)) return { ok: false };
  if (typeof deviceSecret !== "string" || !SECRET_RE.test(deviceSecret)) return { ok: false };
  return { ok: true, uid, deviceSecret };
}

export function checkDemo(body) {
  const uid = body && typeof body === "object" ? body.uid : undefined;
  return typeof uid === "string" && DEMO_UIDS.includes(uid) ? { ok: true, uid } : { ok: false };
}
