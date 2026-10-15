import test from "node:test";
import assert from "node:assert/strict";
import {
  RING_SECONDS, callType, callSid, peerFromCall, decideIncoming, outcomeMessage, explainDirectError, selectableUsers, directTitle, callKindLabel,
} from "../src/call/directCall.js";

const user = (uid, name, extra = {}) => ({ getUid: () => uid, getName: () => name, getAvatar: () => extra.avatar || "", getStatus: () => extra.status || "offline" });
const call = ({ sid = "s1", type = "video", from = user("a", "Asha"), to = user("b", "Dev"), rt = "user" } = {}) => ({
  getSessionId: () => sid, getType: () => type, getSender: () => from, getReceiver: () => to, getReceiverType: () => rt,
});

test("direct: call type and session id are read safely", () => {
  assert.equal(callType(call({ type: "video" })), "video");
  assert.equal(callType(call({ type: "audio" })), "voice");
  assert.equal(callType(null), "voice");
  assert.equal(callSid(call({ sid: "abc" })), "abc");
  assert.equal(callSid({}), "");
  assert.ok(RING_SECONDS >= 15 && RING_SECONDS <= 60);
});
test("direct: the peer is the OTHER person, from either side", () => {
  const c = call();
  assert.equal(peerFromCall(c, "b").name, "Asha"); // I am Dev: the caller is Asha
  assert.equal(peerFromCall(c, "a").name, "Dev"); // I am Asha: the person I called is Dev
  assert.equal(peerFromCall(call({ from: user("a", "Asha", { avatar: "javascript:x" }) }), "b").avatar, ""); // unsafe avatar dropped
  assert.equal(peerFromCall(call({ from: user("a", "Asha", { avatar: "https://x.test/a.png" }) }), "b").avatar, "https://x.test/a.png");
});
test("direct: one incoming call makes exactly one pop-up (duplicates are ignored)", () => {
  const c = call();
  assert.equal(decideIncoming({ call: c, selfUid: "b", busy: false, ringSid: "" }), "show");
  assert.equal(decideIncoming({ call: c, selfUid: "b", busy: true, ringSid: "s1" }), "duplicate"); // same call delivered twice
  assert.equal(decideIncoming({ call: c, selfUid: "b", busy: true, ringSid: "" }), "busy");
  assert.equal(decideIncoming({ call: c, selfUid: "b", busy: true, ringSid: "other" }), "busy"); // a second, different call while ringing
});
test("direct: my own outgoing call, group calls and empty events never pop up", () => {
  assert.equal(decideIncoming({ call: call(), selfUid: "a", busy: false }), "ignore");
  assert.equal(decideIncoming({ call: call({ rt: "group" }), selfUid: "b", busy: false }), "ignore");
  assert.equal(decideIncoming({ call: null, selfUid: "b" }), "ignore");
  assert.equal(decideIncoming({ call: { getSessionId: () => "" }, selfUid: "b" }), "ignore");
});
test("direct: outcomes read as plain sentences", () => {
  assert.equal(outcomeMessage("rejected", "Dev"), "Dev declined the call.");
  assert.equal(outcomeMessage("busy", "Dev"), "Dev is on another call.");
  assert.equal(outcomeMessage("cancelled", "Asha"), "Missed call from Asha.");
  assert.equal(outcomeMessage("unanswered", "Dev"), "Dev didn't answer.");
  assert.equal(outcomeMessage("ended", "Dev"), "Dev ended the call.");
  assert.equal(outcomeMessage("weird"), "The call ended.");
});
test("direct: errors map to friendly text, permission errors are left to the media explainer", () => {
  assert.match(explainDirectError({ code: "ERR_CALL_IN_PROGRESS" }), /already in a call/);
  assert.match(explainDirectError({ code: "ERR_PLAN_RESTRICTION" }), /dashboard/);
  assert.match(explainDirectError(new Error("Failed to fetch")), /internet/);
  assert.equal(explainDirectError({ name: "NotAllowedError" }), null);
  assert.ok(explainDirectError({ code: "X" }).length > 10);
});
test("direct: callable people exclude me, de-duplicate, and list online people first", () => {
  const list = selectableUsers([user("me", "Me"), user("z", "Zed"), user("a", "Amy", { status: "online" }), user("a", "Amy again"), user("b", "Bob", { status: "online" }), null], "me");
  assert.deepEqual(list.map((u) => u.uid), ["a", "b", "z"]);
  assert.equal(list[0].online, true);
  assert.equal(list[2].online, false);
  assert.deepEqual(selectableUsers(undefined, "me"), []);
});
test("direct: titles name the person and the call type", () => {
  assert.equal(directTitle("video", "Dev"), "Video call with Dev");
  assert.equal(directTitle("voice", "Dev"), "Voice call with Dev");
  assert.equal(callKindLabel("video"), "video call");
});
