import test from "node:test";
import assert from "node:assert/strict";
import {
  VOICE_ROOM_SESSION_ID, callSupport, callSupportHelp, explainMediaError, explainCallError,
  normaliseParticipants, voiceSessionSettings, isInRoom, STATUS_LABEL,
} from "../src/call/callLogic.js";

const good = { navigator: { mediaDevices: { getUserMedia() {} } }, isSecureContext: true };

test("call: support check names each missing piece", () => {
  assert.deepEqual(callSupport(good), { ok: true, reason: "" });
  assert.equal(callSupport({ ...good, isSecureContext: false }).reason, "insecure");
  assert.equal(callSupport({ ...good, navigator: {} }).reason, "no-mic-api");
  assert.equal(callSupport({}).reason, "no-browser");
  for (const r of ["insecure", "no-mic-api", "no-browser"]) assert.ok(callSupportHelp(r).length > 10);
});
test("call: microphone errors are plain sentences", () => {
  assert.match(explainMediaError({ name: "NotAllowedError" }), /Microphone access was blocked/);
  assert.match(explainMediaError({ name: "NotFoundError" }), /No microphone was found/);
  assert.match(explainMediaError({ name: "NotReadableError" }), /another app/);
  assert.match(explainMediaError({ name: "NotAllowedError" }, "camera"), /Camera access was blocked/);
});
test("call: join errors give a friendly line and keep the technical code", () => {
  assert.match(explainCallError({ name: "NotAllowedError", message: "Permission denied" }).friendly, /Microphone access was blocked/);
  assert.match(explainCallError({ code: "ERR_PLAN_RESTRICTION", message: "x" }).friendly, /Voice & Video Calling/);
  assert.match(explainCallError(new Error("Failed to fetch")).friendly, /internet/);
  const e = explainCallError({ code: "WEIRD", message: "boom" });
  assert.equal(e.technical, "WEIRD: boom");
  assert.ok(e.friendly.length > 10);
  assert.ok(explainCallError(undefined).technical);
});
test("call: participants are cleaned, de-duplicated and ordered you-first", () => {
  const list = normaliseParticipants([
    { pid: "p2", uid: "zed", name: "Zed" },
    { pid: "p1", uid: "me", name: "Me", avatar: "https://x.test/a.png" },
    { pid: "p3", uid: "amy", name: "Amy", avatar: "javascript:alert(1)" },
    { pid: "p4", uid: "amy", name: "Amy again" },
    null, 7, { name: "no id" },
  ], "me");
  assert.deepEqual(list.map((p) => p.uid), ["me", "amy", "zed"]);
  assert.equal(list[0].isSelf, true);
  assert.equal(list[0].avatar, "https://x.test/a.png");
  assert.equal(list[1].avatar, ""); // unsafe avatar URLs are dropped
  assert.deepEqual(normaliseParticipants(undefined, "me"), []);
});
test("call: voice room is a VOICE session with OGSlides' own controls", () => {
  const s = voiceSessionSettings();
  assert.equal(s.sessionType, "VOICE");
  assert.equal(s.hideControlPanel, true);
  assert.equal(s.startAudioMuted, false);
  assert.match(VOICE_ROOM_SESSION_ID, /^[a-z0-9-]+$/);
});
test("call: status helpers", () => {
  assert.equal(isInRoom("connected"), true);
  assert.equal(isInRoom("idle"), false);
  assert.equal(isInRoom("failed"), false);
  for (const k of ["idle", "connecting", "connected", "reconnecting", "failed", "ended"]) assert.ok(STATUS_LABEL[k]);
});

import { videoSessionSettings, sessionSettingsFor, sessionIdFor, inviteText, roomName, VIDEO_ROOM_SESSION_ID } from "../src/call/callLogic.js";
test("video: camera is OFF at the start and the SDK's own screen-share / extra buttons are hidden", () => {
  const s = videoSessionSettings();
  assert.equal(s.sessionType, "VIDEO");
  assert.equal(s.startVideoPaused, true);
  assert.equal(s.hideScreenSharingButton, true);
  assert.equal(s.hideControlPanel, true);
  assert.equal(s.startAudioMuted, false);
});
test("video: voice and video rooms use different session IDs and settings", () => {
  assert.notEqual(sessionIdFor("voice"), sessionIdFor("video"));
  assert.equal(sessionIdFor("video"), VIDEO_ROOM_SESSION_ID);
  assert.equal(sessionSettingsFor("voice").sessionType, "VOICE");
  assert.equal(sessionSettingsFor("video").sessionType, "VIDEO");
  assert.equal(sessionSettingsFor("anything-else").sessionType, "VOICE");
  assert.equal(roomName("video"), "Video call");
  assert.equal(roomName("voice"), "Voice room");
});
test("video: invite text is short, honest about the camera and trims long names", () => {
  assert.match(inviteText("Asha", "video"), /camera stays off/);
  assert.match(inviteText("Asha", "voice"), /voice room/);
  assert.ok(inviteText("x".repeat(500), "voice").length < 200);
  assert.match(inviteText(undefined, "voice"), /^Someone/);
});
