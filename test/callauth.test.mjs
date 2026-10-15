import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthToken, ensureCallsInit, _resetCallsInitForTests } from "../src/call/authToken.js";
import { explainCallError } from "../src/call/callLogic.js";

const user = (t) => ({ getAuthToken: () => t });

test("auth: REGRESSION - a Promise (what CometChat.getLoggedInUser() returns in Chat SDK 4.x) is never read as a user", async () => {
  const t = await resolveAuthToken({ sync: () => Promise.resolve(user("secret-from-promise")) });
  assert.equal(t, ""); // old code read the token off the Promise and got nothing
});
test("auth: reads the token from the synchronous UI Kit user", async () => {
  assert.equal(await resolveAuthToken({ sync: () => user("tok1") }), "tok1");
});
test("auth: falls back to the async Chat SDK lookup (resumed sessions)", async () => {
  assert.equal(await resolveAuthToken({ sync: () => null, async: async () => user("tok2") }), "tok2");
});
test("auth: signed-out user gives an empty token, never throws", async () => {
  assert.equal(await resolveAuthToken({ sync: () => null, async: async () => null }), "");
  assert.equal(await resolveAuthToken({ sync: () => { throw new Error("x"); }, async: async () => { throw new Error("y"); } }), "");
  assert.equal(await resolveAuthToken({}), "");
  assert.equal(await resolveAuthToken(), "");
  assert.equal(await resolveAuthToken({ sync: () => ({ getAuthToken: () => 42 }) }), "");
});
test("auth: not-signed-in error is friendly and does NOT tell people to sign out and in", () => {
  const e = explainCallError(Object.assign(new Error("Not signed in to CometChat"), { code: "AUTH_NOT_SIGNED_IN" }));
  assert.match(e.friendly, /not signed in/i);
  assert.doesNotMatch(e.friendly, /sign out/i);
  assert.match(explainCallError({ code: "AUTH_NO_TOKEN" }).friendly, /not signed in/i);
});
test("auth: the Calls SDK is initialised only once, even with two quick joins", async () => {
  _resetCallsInitForTests();
  let n = 0;
  const calls = { init: async () => { n++; return { success: true }; } };
  await Promise.all([ensureCallsInit(calls, {}), ensureCallsInit(calls, {})]);
  assert.equal(n, 1);
  _resetCallsInitForTests();
  await ensureCallsInit(calls, {}, () => true); // already ready: no call
  assert.equal(n, 1);
});
test("auth: a failed init can be retried and reports a clear code", async () => {
  _resetCallsInitForTests();
  let n = 0;
  const calls = { init: async () => (++n === 1 ? { success: false, error: { message: "bad" } } : { success: true }) };
  await assert.rejects(ensureCallsInit(calls, {}), (e) => e.code === "CALLS_INIT_FAILED");
  await ensureCallsInit(calls, {});
  assert.equal(n, 2);
});
