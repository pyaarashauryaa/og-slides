import test from "node:test";
import assert from "node:assert/strict";
import { voiceSupport, voiceHelp, explainVoiceError } from "../src/cometchat/voice.js";

const good = { navigator: { mediaDevices: { getUserMedia() {} } }, MediaRecorder: class {}, isSecureContext: true };

test("voice: supported when mic API, recorder and secure page exist", () => {
  assert.deepEqual(voiceSupport(good), { ok: true, reason: "" });
});
test("voice: each missing piece gives its own reason and plain help", () => {
  assert.equal(voiceSupport({ ...good, isSecureContext: false }).reason, "insecure");
  assert.equal(voiceSupport({ ...good, navigator: {} }).reason, "no-mic-api");
  assert.equal(voiceSupport({ ...good, MediaRecorder: undefined }).reason, "no-recorder");
  assert.equal(voiceSupport({}).reason, "no-browser");
  for (const r of ["insecure", "no-mic-api", "no-recorder", "no-browser"]) assert.ok(voiceHelp(r).length > 10);
  assert.equal(voiceHelp(""), "");
});
test("voice: error messages are friendly", () => {
  assert.match(explainVoiceError(new Error("NotAllowedError: Permission denied")), /Microphone access was blocked/);
  assert.match(explainVoiceError({ message: "NotFoundError" }), /No microphone/);
  assert.match(explainVoiceError("Network request failed"), /internet connection/);
  assert.match(explainVoiceError(null), /try again/);
});
