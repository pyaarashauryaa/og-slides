// Voice-note helpers (no React, no CometChat) so they can be unit-tested.
//
// Why: the chat kit's own recorder saves whatever the browser recorded (usually WebM/Opus in Chrome and Edge,
// MP4/AAC in Safari) under the fixed name "voice-recording.wav" with a type like "audio/webm;codecs=opus".
// A .wav name on WebM content, and a MIME type with extra ";codecs" text, are the most likely reasons a stored
// voice note refuses to play. OGSlides now names and types the file to match what was really recorded.

const EXT = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
};

// "audio/webm;codecs=opus" -> "audio/webm". Anything that isn't audio becomes audio/webm only if it is empty.
export function cleanAudioMime(type) {
  const base = String(type || "").split(";")[0].trim().toLowerCase();
  if (!base) return "audio/webm";
  return base;
}
export const isAudioMime = (type) => /^audio\//.test(cleanAudioMime(type)) && cleanAudioMime(type) in EXT;
export const extensionFor = (type) => EXT[cleanAudioMime(type)] || "webm";

const pad = (n) => String(n).padStart(2, "0");
export function voiceFileName(type, when = new Date()) {
  const d = when;
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `voice-note-${stamp}.${extensionFor(type)}`;
}

export const MIN_BYTES = 800; // anything smaller than this is an empty recording

// Returns { ok:true, file } or { ok:false, message }.
export function buildVoiceFile(blob, when = new Date()) {
  if (!blob || typeof blob.size !== "number" || blob.size < MIN_BYTES) {
    return { ok: false, message: "That recording was empty. Hold on a second after pressing record, then try again." };
  }
  const mime = cleanAudioMime(blob.type);
  if (!isAudioMime(mime)) {
    return { ok: false, message: `This browser recorded an audio format OGSlides can't send (${mime}). Try Chrome, Edge or Firefox.` };
  }
  const file = new File([blob], voiceFileName(mime, when), { type: mime, lastModified: when.getTime() });
  return { ok: true, file };
}

// Same metadata keys the chat kit uses, so its voice-note player still renders the message.
// `info` (optional) is { duration, peaks } measured before sending, so every listener sees the real length and
// waveform without having to download and decode the file first.
export function voiceMetadata(file, info) {
  const meta = { file, fileName: file.name, fileType: file.type, fileSize: file.size, audioType: "voice_note" };
  const d = cleanDuration(info?.duration);
  if (d) meta.duration = d;
  const peaks = cleanPeaks(info?.peaks);
  if (peaks) meta.peaks = peaks;
  return meta;
}

export const PEAK_BARS = 36;
const MAX_SECONDS = 60 * 60;

// A duration is only kept when it is a real, finite, positive number (MediaRecorder WebM files report Infinity).
export function cleanDuration(d) {
  const n = Number(d);
  return Number.isFinite(n) && n > 0 && n < MAX_SECONDS ? Math.round(n * 10) / 10 : 0;
}

// Peaks come from other people's messages, so they are validated: an array of 4..128 numbers, each clamped to 0..100.
export function cleanPeaks(p) {
  if (!Array.isArray(p) || p.length < 4 || p.length > 128) return null;
  const out = p.map((v) => Math.min(100, Math.max(0, Math.round(Number(v)))));
  return out.every((v) => Number.isFinite(v)) ? out : null;
}

// Turns raw samples into `bars` loudness bars (0..100), scaled so the loudest bar is 100.
export function computePeaks(samples, bars = PEAK_BARS) {
  const n = samples?.length || 0;
  if (!n) return null;
  const size = Math.max(1, Math.floor(n / bars));
  const raw = [];
  for (let b = 0; b < bars; b++) {
    let max = 0;
    const end = Math.min(n, (b + 1) * size);
    for (let i = b * size; i < end; i++) max = Math.max(max, Math.abs(samples[i]));
    raw.push(max);
  }
  const top = Math.max(...raw);
  if (!(top > 0)) return raw.map(() => 8);
  return raw.map((v) => Math.max(8, Math.round((v / top) * 100)));
}

// Measures duration + peaks of a recording in this browser. Never throws; returns {} when it cannot.
export async function analyseRecording(blob) {
  try {
    const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctx) return {};
    const ctx = new Ctx();
    try {
      const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
      return { duration: cleanDuration(buf.duration), peaks: computePeaks(buf.getChannelData(0)) };
    } finally {
      try { await ctx.close(); } catch { /* ignore */ }
    }
  } catch {
    return {};
  }
}

export function formatClock(sec) {
  const s = Math.max(0, Math.floor(Number.isFinite(sec) ? sec : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// What the browser's <audio> element reports when it cannot play (MediaError.code 1..4) -> plain words.
export function playbackProblem(code) {
  switch (code) {
    case 1: return "Playback was stopped.";
    case 2: return "The audio could not be downloaded. Check your connection, then try again.";
    case 3: return "The audio file is damaged or incomplete.";
    case 4: return "This voice note could not be loaded. The file may have expired, or this browser can't play its format.";
    default: return "This voice note could not be played.";
  }
}

// Reads what the player needs from a CometChat media message (duck-typed, so it is unit-testable).
export function readVoiceMessage(message) {
  const metadata = (typeof message?.getMetadata === "function" ? message.getMetadata() : null) || {};
  let url = "";
  let name = "";
  let mime = "";
  try {
    const att = typeof message?.getAttachment === "function" ? message.getAttachment() : null;
    if (att) {
      url = (typeof att.getUrl === "function" ? att.getUrl() : att.url) || "";
      name = (typeof att.getName === "function" ? att.getName() : att.name) || "";
      mime = (typeof att.getMimeType === "function" ? att.getMimeType() : att.mimeType) || "";
    }
    if (!url) {
      const a0 = typeof message?.getAttachments === "function" ? message.getAttachments()?.[0] : null;
      if (a0) url = (typeof a0.getUrl === "function" ? a0.getUrl() : a0.url) || "";
    }
  } catch { /* fall through to metadata */ }
  const safeUrl = /^https:\/\//i.test(url) || /^http:\/\/localhost[:/]/i.test(url) ? url : "";
  return {
    url: safeUrl,
    name: String(name || metadata.fileName || "voice-note").slice(0, 120),
    mime: cleanAudioMime(mime || metadata.fileType),
    duration: cleanDuration(metadata.duration),
    peaks: cleanPeaks(metadata.peaks),
    localFile: typeof File !== "undefined" && metadata.file instanceof File ? metadata.file : null,
    isVoiceNote: metadata.audioType === "voice_note",
  };
}

// Checks whether a stored voice note can really be fetched and decoded - the same two steps the chat kit's player
// does. Never returns or logs the URL itself.
export async function probeAudio(url, { fetchImpl = globalThis.fetch, decode } = {}) {
  if (!url || typeof fetchImpl !== "function") return { ok: false, kind: "no-url" };
  let res;
  try {
    res = await fetchImpl(url, { method: "GET", credentials: "omit" });
  } catch {
    return { ok: false, kind: "blocked" }; // offline, or the file server refused cross-site access (CORS)
  }
  const contentType = cleanAudioMime(res.headers?.get?.("content-type") || "") || "";
  if (!res.ok) return { ok: false, kind: "http", status: res.status, contentType };
  let buf;
  try {
    buf = await res.arrayBuffer();
  } catch {
    return { ok: false, kind: "blocked", status: res.status, contentType };
  }
  if (!buf || buf.byteLength < 1) return { ok: false, kind: "empty", status: res.status, contentType, bytes: 0 };
  try {
    await decode(buf);
  } catch {
    return { ok: false, kind: "decode", status: res.status, contentType, bytes: buf.byteLength };
  }
  return { ok: true, kind: "ok", status: res.status, contentType, bytes: buf.byteLength };
}

export function explainProbe(r, sentMime = "") {
  switch (r?.kind) {
    case "ok":
      return "Playback check passed: the file can be downloaded and decoded in this browser.";
    case "blocked":
      return "Playback check failed: the browser could not download the stored file (offline, or the file server blocked it with CORS). Open DevTools > Network and look at the voice-note request.";
    case "http":
      return `Playback check failed: the file server answered ${r.status}. The upload may not be accessible to this account.`;
    case "empty":
      return "Playback check failed: the stored file is empty.";
    case "decode":
      return `Playback check failed: the file downloaded (${r.contentType || "unknown type"}, sent as ${sentMime || "unknown"}) but this browser can't decode it.`;
    default:
      return "Playback check skipped: no file link came back from CometChat.";
  }
}

export async function decodeWithWebAudio(buf) {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) throw new Error("no AudioContext");
  const ctx = new Ctx();
  try {
    await ctx.decodeAudioData(buf.slice(0));
  } finally {
    try { await ctx.close(); } catch { /* ignore */ }
  }
}
