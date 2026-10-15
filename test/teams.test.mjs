import test from "node:test";
import assert from "node:assert/strict";
import {
  ALPHABET, generateRoomCode, generatePasskey, normalizeCode, normalizePasskey, formatCode, formatPasskey, chatGuidFor, syncGuidFor,
  codeFromChatGuid, validateTeamInput, validateJoinInput, validatePersonName, buildInvitation, NAME_MAX, DESCRIPTION_MAX,
} from "../src/team/teamCodes.js";
import { explainTeamError } from "../src/team/teamErrors.js";
import { createAttemptLimiter } from "../src/team/attemptLimiter.js";

test("codes: made from the safe alphabet, right length, and not repeating", () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const c = generateRoomCode(), k = generatePasskey();
    assert.equal(c.length, 6); assert.equal(k.length, 8);
    assert.ok([...c, ...k].every((ch) => ALPHABET.includes(ch)));
    seen.add(c + k);
  }
  assert.equal(seen.size, 500, "no repeats in 500 draws");
  for (const bad of "01OIL") assert.equal(ALPHABET.includes(bad), false, `${bad} is confusing`);
});
test("codes: uses the secure random source, not Math.random", () => {
  let used = 0;
  const rng = { getRandomValues(a) { used++; for (let i = 0; i < a.length; i++) a[i] = i * 7; return a; } };
  assert.equal(generateRoomCode(rng).length, 6); assert.equal(used, 1);
  const orig = Math.random; Math.random = () => { throw new Error("Math.random must not be used"); };
  try { generateRoomCode(); generatePasskey(); } finally { Math.random = orig; }
});
test("codes: typed codes are forgiven (case, spaces, dashes) but real mistakes are caught", () => {
  assert.equal(normalizeCode("abc-234"), "ABC234"); assert.equal(normalizeCode(" a b c 2 3 4 "), "ABC234");
  assert.equal(normalizeCode("ABC23"), ""); assert.equal(normalizeCode("ABC2345"), ""); assert.equal(normalizeCode("ABC0O1"), "");
  assert.equal(normalizePasskey("abcd-2345"), "ABCD2345"); assert.equal(normalizePasskey("ABCD234"), "");
  assert.equal(formatCode("ABC234"), "ABC-234"); assert.equal(formatPasskey("ABCD2345"), "ABCD-2345");
  assert.equal(normalizeCode(formatCode("ABC234")), "ABC234");
});
test("codes: group ids are stable, lower case, and only chat groups count as teams", () => {
  assert.equal(chatGuidFor("ABC234"), "ogs-abc234"); assert.equal(syncGuidFor("ABC234"), "ogs-abc234-sync");
  assert.equal(codeFromChatGuid("ogs-abc234"), "ABC234");
  assert.equal(codeFromChatGuid("ogs-abc234-sync"), "", "the data group is not a team");
  for (const other of ["ogslides-team-room", "ogs-", "ogs-abc", "cometchat-guid-1", "", null]) assert.equal(codeFromChatGuid(other), "");
  assert.equal(codeFromChatGuid("ogs-abc01o"), "", "characters outside the alphabet");
});
test("forms: team name is required, trimmed and bounded", () => {
  assert.equal(validateTeamInput({ name: "   " }).ok, false);
  assert.deepEqual(validateTeamInput({ name: "  Design   Crew ", description: " hi " }), { ok: true, name: "Design Crew", description: "hi" });
  assert.equal(validateTeamInput({ name: "x".repeat(NAME_MAX + 1) }).ok, false);
  assert.equal(validateTeamInput({ name: "ok", description: "x".repeat(DESCRIPTION_MAX + 1) }).field, "description");
  assert.equal(validateTeamInput({ name: "Just a name" }).description, "");
  assert.equal(validatePersonName("").ok, false); assert.equal(validatePersonName(" Priya  K ").name, "Priya K");
});
test("forms: join needs a well-formed code and passkey, each with its own message", () => {
  assert.equal(validateJoinInput({}).field, "code");
  assert.equal(validateJoinInput({ code: "abc" , passkey: "x"}).field, "code");
  assert.equal(validateJoinInput({ code: "ABC234" }).field, "passkey");
  assert.equal(validateJoinInput({ code: "ABC234", passkey: "short" }).field, "passkey");
  assert.deepEqual(validateJoinInput({ code: "abc-234", passkey: "abcd-2345" }), { ok: true, code: "ABC234", passkey: "ABCD2345" });
});
test("invitation: real values, passkey only when known, never a link", () => {
  const withKey = buildInvitation({ name: "Design Crew", code: "ABC234", passkey: "ABCD2345" });
  assert.match(withKey, /Team: Design Crew/); assert.match(withKey, /Room code: ABC-234/); assert.match(withKey, /Passkey: ABCD-2345/);
  assert.doesNotMatch(withKey, /https?:\/\//, "no link carries the passkey");
  const without = buildInvitation({ name: "Design Crew", code: "ABC234", ownerName: "Priya" });
  assert.match(without, /Passkey: ask Priya/); assert.doesNotMatch(without, /undefined|null/);
});
test("errors: each failure has its own plain explanation", () => {
  assert.equal(explainTeamError({ code: "ERR_GUID_NOT_FOUND" }).kind, "not_found");
  assert.equal(explainTeamError({ code: "ERR_WRONG_GROUP_PASSWORD" }).kind, "wrong_passkey");
  assert.equal(explainTeamError({ message: "Password is wrong" }).kind, "wrong_passkey");
  assert.equal(explainTeamError({ code: "ERR_EMPTY_GROUP_PASS" }).kind, "wrong_passkey");
  assert.equal(explainTeamError({ code: "ERR_GUID_ALREADY_EXISTS" }, "create").kind, "exists");
  assert.equal(explainTeamError(new TypeError("Failed to fetch")).kind, "network");
  assert.equal(explainTeamError({ code: "ERR_BANNED" }).kind, "banned");
  assert.equal(explainTeamError({ code: "SOMETHING_NEW" }).kind, "unknown");
  assert.equal(explainTeamError(null).kind, "unknown");
  for (const k of ["not_found", "wrong_passkey"]) assert.ok(explainTeamError({ code: k === "not_found" ? "ERR_GUID_NOT_FOUND" : "ERR_WRONG_GROUP_PASSWORD" }).message.length > 20);
});
test("limiter: five wrong passkeys for one room pause that room, others are unaffected, success resets", () => {
  let t = 0; const l = createAttemptLimiter({ max: 5, windowMs: 60_000, now: () => t });
  for (let i = 0; i < 5; i++) { assert.equal(l.check("A").ok, true); l.fail("A"); }
  const blocked = l.check("A"); assert.equal(blocked.ok, false); assert.ok(blocked.waitMs > 0 && blocked.waitMs <= 60_000);
  assert.equal(l.check("B").ok, true);
  t = 61_000; assert.equal(l.check("A").ok, true, "waiting works");
  for (let i = 0; i < 5; i++) l.fail("A"); l.success("A"); assert.equal(l.check("A").ok, true);
});

// ---------- team service (dev test version) and wiring ----------
import { createMemoryTeams } from "../src/team/memoryTeams.js";
import { readFileSync } from "node:fs";
import { sessionIdFor } from "../src/call/callLogic.js";
const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const mk = (uid, name, ch) => createMemoryTeams({ uid, name }, { channelName: ch, delay: 1 });

test("team service: create makes a real team with a unique code and the creator as the only member", async () => {
  const a = mk("u1", "Asha", "t-create");
  const codes = new Set();
  for (let i = 0; i < 20; i++) {
    const { team, passkey } = await a.createTeam({ name: `T${i}`, description: "" });
    assert.match(team.code, /^[A-Z2-9]{6}$/);
    assert.match(passkey, /^[A-Z2-9]{8}$/);
    codes.add(team.code);
  }
  assert.equal(codes.size, 20);
  const mine = await a.listMyTeams();
  assert.equal(mine.length, 20);
  a.close();
});

test("team service: wrong passkey and unknown room are refused, right passkey joins, duplicate join adds no second membership", async () => {
  const a = mk("u1", "Asha", "t-join");
  const b = mk("u2", "Ravi", "t-join");
  const { team, passkey } = await a.createTeam({ name: "Heroes", description: "x" });
  await assert.rejects(() => b.joinTeam({ code: team.code, passkey: "ZZZZZZZZ" }), (e) => e.code === "ERR_WRONG_GROUP_PASS");
  await assert.rejects(() => b.joinTeam({ code: "QQQQQQ", passkey }), (e) => e.code === "ERR_GUID_NOT_FOUND");
  assert.deepEqual(await b.listMyTeams(), []); // failed attempts joined nothing
  const first = await b.joinTeam({ code: team.code, passkey });
  assert.equal(first.already, false);
  const again = await b.joinTeam({ code: team.code, passkey });
  assert.equal(again.already, true);
  const members = await a.listMembers(team);
  assert.equal(members.length, 2);
  assert.equal(members.filter((m) => m.uid === "u2").length, 1);
  assert.ok(members.every((m) => m.online === null)); // the test service never invents an online status
  a.close(); b.close();
});

test("team service: only members can open a team, and each person lists only their own teams", async () => {
  const a = mk("u1", "Asha", "t-auth");
  const c = mk("u3", "Chen", "t-auth");
  const { team } = await a.createTeam({ name: "Private", description: "" });
  await assert.rejects(() => c.openTeam(team), (e) => e.code === "ERR_NOT_A_MEMBER");
  assert.deepEqual(await c.listMyTeams(), []);
  assert.equal((await a.listMyTeams()).length, 1);
  a.close(); c.close();
});

test("wiring: real teams use password groups, the transport never creates groups, calls and people are per team", () => {
  const cc = src("../src/team/cometchatTeams.js");
  assert.match(cc, /GROUP_TYPE\.PASSWORD/);
  assert.match(cc, /joinGroup\(chatGuid, PASSWORD\(\), passkey\)/);
  assert.doesNotMatch(cc, /localStorage|sessionStorage/); // the passkey is never stored by the service
  const tr = src("../src/workspace/transports/cometchat.js");
  assert.doesNotMatch(tr, /ensureGroup|createGroup|joinGroup/);
  assert.match(tr, /ERR_NOT_A_MEMBER/);
  assert.match(src("../src/call/CallPeoplePicker.jsx"), /GroupMembersRequestBuilder\(team\.current\.chatGuid\)/);
  assert.notEqual(sessionIdFor("voice", "ABC234"), sessionIdFor("voice", "XYZ789"));
  assert.notEqual(sessionIdFor("voice", "ABC234"), sessionIdFor("video", "ABC234"));
  assert.equal(sessionIdFor("voice", "LEGACY"), sessionIdFor("voice")); // the old room keeps its id
});

test("wiring: passkeys never reach URLs, logs or storage", () => {
  for (const f of ["TeamProvider.jsx", "TeamForms.jsx", "TeamLobby.jsx", "Landing.jsx", "cometchatTeams.js"]) {
    const t = src(`../src/team/${f}`);
    assert.doesNotMatch(t, /console\.(log|error|warn)\([^)]*passkey/i, f);
    assert.doesNotMatch(t, /(location|history)[^;\n]*passkey/i, f);
  }
  const p = src("../src/team/TeamProvider.jsx");
  assert.match(p, /ogslides\.team/);
  assert.doesNotMatch(p, /writeSaved\(\{[^}]*passkey/);
});
