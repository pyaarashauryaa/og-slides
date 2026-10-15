// Room codes, passkeys and invitation text. Pure functions (no React, no CometChat) so they can be unit-tested.
//
// How a team is stored: a team is TWO CometChat groups with the same passkey as their group password:
//   chat group  guid "ogs-abc234"        (team chat)
//   data group  guid "ogs-abc234-sync"   (the shared presentations, tasks, cursors, ...)
// The room code (ABC234) is only a NAME for the team. It proves nothing: CometChat's server checks the passkey
// when someone joins, so knowing the code alone never lets anyone in.

// 32 characters with no 0/O/1/I/L, so a code read aloud or typed from a screenshot is hard to get wrong.
export const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;
export const PASSKEY_LENGTH = 8;
export const NAME_MAX = 60;
export const DESCRIPTION_MAX = 140;
export const PERSON_NAME_MAX = 40;

const GUID_PREFIX = "ogs-";

function randomChars(n, rng) {
  const bytes = new Uint8Array(n);
  (rng || globalThis.crypto).getRandomValues(bytes);
  // 256 is a multiple of 32, so taking the remainder is perfectly even (no bias).
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export const generateRoomCode = (rng) => randomChars(CODE_LENGTH, rng);
export const generatePasskey = (rng) => randomChars(PASSKEY_LENGTH, rng);

// Display forms: ABC-234 and ABCD-EFGH. What is stored and sent has no dash.
export const formatCode = (code) => `${code.slice(0, 3)}-${code.slice(3)}`;
export const formatPasskey = (key) => `${key.slice(0, 4)}-${key.slice(4)}`;

const clean = (s) => String(s || "").toUpperCase().replace(/[\s\-_.]/g, "");

// People type codes in lower case, with spaces or dashes. Returns the plain code, or "" when it can't be a real code.
export function normalizeCode(input) {
  const c = clean(input);
  return c.length === CODE_LENGTH && [...c].every((ch) => ALPHABET.includes(ch)) ? c : "";
}
export function normalizePasskey(input) {
  const k = clean(input);
  return k.length === PASSKEY_LENGTH && [...k].every((ch) => ALPHABET.includes(ch)) ? k : "";
}

export const chatGuidFor = (code) => `${GUID_PREFIX}${code.toLowerCase()}`;
export const syncGuidFor = (code) => `${GUID_PREFIX}${code.toLowerCase()}-sync`;
// Only the CHAT group of a team counts when listing teams (the data group is its companion).
export function codeFromChatGuid(guid) {
  const m = /^ogs-([a-z0-9]{6})$/.exec(String(guid || ""));
  if (!m) return "";
  const code = m[1].toUpperCase();
  return normalizeCode(code);
}

export function validateTeamInput({ name, description } = {}) {
  const n = String(name || "").trim().replace(/\s+/g, " ");
  const d = String(description || "").trim();
  if (!n) return { ok: false, field: "name", message: "Give your team a name." };
  if (n.length > NAME_MAX) return { ok: false, field: "name", message: `Team names can be up to ${NAME_MAX} characters.` };
  if (d.length > DESCRIPTION_MAX) return { ok: false, field: "description", message: `Keep the description under ${DESCRIPTION_MAX} characters.` };
  return { ok: true, name: n, description: d };
}

export function validatePersonName(name) {
  const n = String(name || "").trim().replace(/\s+/g, " ");
  if (!n) return { ok: false, message: "Tell us what to call you." };
  if (n.length > PERSON_NAME_MAX) return { ok: false, message: `Names can be up to ${PERSON_NAME_MAX} characters.` };
  return { ok: true, name: n };
}

export function validateJoinInput({ code, passkey } = {}) {
  const c = normalizeCode(code);
  if (!String(code || "").trim()) return { ok: false, field: "code", message: "Enter the room code." };
  if (!c) return { ok: false, field: "code", message: `A room code is ${CODE_LENGTH} letters or numbers, like ABC-234.` };
  const k = normalizePasskey(passkey);
  if (!String(passkey || "").trim()) return { ok: false, field: "passkey", message: "Enter the passkey." };
  if (!k) return { ok: false, field: "passkey", message: `A passkey is ${PASSKEY_LENGTH} letters or numbers, like ABCD-2345.` };
  return { ok: true, code: c, passkey: k };
}

// The text people paste into a message. The passkey is only included when this device really knows it (right after
// creating the team). It never goes into a link: a link can be logged, shared on, or end up in browser history.
export function buildInvitation({ name, code, passkey, ownerName }) {
  const lines = [
    "Come collaborate with me on OGSlides!",
    "",
    `Team: ${name}`,
    `Room code: ${formatCode(code)}`,
    passkey ? `Passkey: ${formatPasskey(passkey)}` : `Passkey: ask ${ownerName || "the person who created the team"}`,
    "",
    'Open OGSlides, choose "Join a team", and enter the room code and passkey.',
  ];
  return lines.join("\n");
}

// A legacy room (the shared room that existed before teams) is a built-in team with fixed groups.
export const LEGACY_CODE = "LEGACY";
