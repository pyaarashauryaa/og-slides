import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanAudioMime, extensionFor, voiceFileName, buildVoiceFile, voiceMetadata, probeAudio, explainProbe, isAudioMime,
} from "../src/cometchat/voiceNote.js";

const blob = (type, n = 5000) => new Blob([new Uint8Array(n)], { type });

test("voice note: MIME parameters are removed", () => {
  assert.equal(cleanAudioMime("audio/webm;codecs=opus"), "audio/webm");
  assert.equal(cleanAudioMime("Audio/MP4; codecs=mp4a.40.2"), "audio/mp4");
  assert.equal(cleanAudioMime(""), "audio/webm");
});
test("voice note: extension matches the real format, never .wav for WebM", () => {
  assert.equal(extensionFor("audio/webm;codecs=opus"), "webm");
  assert.equal(extensionFor("audio/mp4"), "m4a");
  assert.equal(extensionFor("audio/ogg;codecs=opus"), "ogg");
  assert.equal(extensionFor("audio/wav"), "wav");
  assert.equal(extensionFor("audio/mpeg"), "mp3");
});
test("voice note: file name is timestamped with the right extension", () => {
  assert.equal(voiceFileName("audio/webm", new Date(2026, 9, 13, 8, 5, 9)), "voice-note-20261013-080509.webm");
  assert.equal(voiceFileName("audio/mp4", new Date(2026, 0, 2, 3, 4, 5)), "voice-note-20260102-030405.m4a");
});
test("voice note: builds a File with the cleaned type and matching extension", () => {
  const r = buildVoiceFile(blob("audio/webm;codecs=opus"));
  assert.equal(r.ok, true);
  assert.equal(r.file.type, "audio/webm");
  assert.match(r.file.name, /\.webm$/);
  assert.doesNotMatch(r.file.name, /\.wav$/);
  assert.equal(r.file.size, 5000);
});
test("voice note: empty and non-audio recordings give a clear error", () => {
  assert.equal(buildVoiceFile(blob("audio/webm", 10)).ok, false);
  assert.match(buildVoiceFile(blob("audio/webm", 10)).message, /empty/);
  assert.equal(buildVoiceFile(null).ok, false);
  const bad = buildVoiceFile(blob("video/mp4"));
  assert.equal(bad.ok, false);
  assert.match(bad.message, /can't send/);
  assert.equal(isAudioMime("audio/webm;codecs=opus"), true);
  assert.equal(isAudioMime("image/png"), false);
});
test("voice note: metadata keeps the chat kit's voice-note tag so its player still renders", () => {
  const { file } = buildVoiceFile(blob("audio/webm"));
  const m = voiceMetadata(file);
  assert.equal(m.audioType, "voice_note");
  assert.equal(m.fileType, "audio/webm");
  assert.equal(m.fileName, file.name);
});

const resp = (over = {}) => ({ ok: true, status: 200, headers: { get: () => "audio/webm" }, arrayBuffer: async () => new ArrayBuffer(100), ...over });
test("probe: ok when downloadable and decodable", async () => {
  const r = await probeAudio("https://x.test/a", { fetchImpl: async () => resp(), decode: async () => {} });
  assert.equal(r.ok, true);
  assert.equal(r.contentType, "audio/webm");
  assert.match(explainProbe(r), /passed/);
});
test("probe: network/CORS block, HTTP error, empty file, decode failure are told apart", async () => {
  const dec = async () => {};
  assert.equal((await probeAudio("https://x.test/a", { fetchImpl: async () => { throw new TypeError("Failed to fetch"); }, decode: dec })).kind, "blocked");
  const h = await probeAudio("https://x.test/a", { fetchImpl: async () => resp({ ok: false, status: 403 }), decode: dec });
  assert.deepEqual([h.kind, h.status], ["http", 403]);
  assert.match(explainProbe(h), /403/);
  assert.equal((await probeAudio("https://x.test/a", { fetchImpl: async () => resp({ arrayBuffer: async () => new ArrayBuffer(0) }), decode: dec })).kind, "empty");
  const d = await probeAudio("https://x.test/a", { fetchImpl: async () => resp(), decode: async () => { throw new Error("bad"); } });
  assert.equal(d.kind, "decode");
  assert.match(explainProbe(d, "audio/webm"), /can't decode/);
  assert.equal((await probeAudio("", { decode: dec })).kind, "no-url");
});
test("probe: results and explanations never contain the file URL", async () => {
  const url = "https://files.example.test/private/secret-token-123.webm";
  const outs = [];
  for (const f of [async () => resp(), async () => { throw new Error("x"); }, async () => resp({ ok: false, status: 404 })]) {
    const r = await probeAudio(url, { fetchImpl: f, decode: async () => {} });
    outs.push(JSON.stringify(r), explainProbe(r));
  }
  for (const o of outs) assert.ok(!o.includes("secret-token-123") && !o.includes("files.example.test"));
});
