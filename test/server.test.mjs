// Tests for the auth server (server/). CometChat is replaced by a fake, so these run with no internet and no keys.
// They prove OUR rules (who gets a token, input checks, rate limits, no secret leaks). They do NOT prove CometChat itself accepts the calls.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const ROOT = fileURLToPath(new URL("..", import.meta.url)); // (a plain .pathname breaks on Windows)
import { createApp, deviceSecretFor, secretMatches } from "../server/app.js";
import { createCometChatApi, CometChatError } from "../server/cometchatApi.js";
import { parseEnv, readConfig } from "../server/env.js";
import { createRateLimiter } from "../server/rateLimit.js";
import { cleanName, checkLogin, checkDemo, DEMO_UIDS } from "../server/validate.js";
import { registerAccount, loginAccount, loginDemo, AuthApiError } from "../src/cometchat/authApi.js";

const REST_KEY = "REST-KEY-SHOULD-NEVER-LEAK-123";
const SECRET = "s".repeat(40);
const baseConfig = { appId: "abc123def", region: "us", restApiKey: REST_KEY, sessionSecret: SECRET, origins: ["http://localhost:5173"], port: 0, demoAccounts: false, trustProxy: false };

function fakeCometChat() {
  const calls = [];
  return {
    calls,
    failWith: null,
    async createUser(u) { calls.push(["createUser", u]); if (this.failWith) throw this.failWith; return `tok-${u.uid}`; },
    async createAuthToken(uid) { calls.push(["token", uid]); if (this.failWith) throw this.failWith; return `tok-${uid}`; },
  };
}

async function start(overrides = {}, limits = {}) {
  const cc = overrides.cometchat || fakeCometChat();
  const logs = [];
  const app = createApp({ config: { ...baseConfig, ...(overrides.config || {}) }, cometchat: cc, logger: (e) => logs.push(e), limits, now: overrides.now });
  const server = app.server();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, headers = {}) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  return { cc, logs, base, post, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) };
}

test("register: the SERVER makes the id, creates the user, and returns a token + device secret", async () => {
  const s = await start();
  const res = await s.post("/api/auth/register", { name: "  Asha   K  " });
  const j = await res.json();
  assert.equal(res.status, 201);
  assert.match(j.uid, /^og-[0-9a-f]{16}$/);
  assert.equal(j.name, "Asha K");
  assert.equal(j.authToken, `tok-${j.uid}`);
  assert.ok(secretMatches(SECRET, j.uid, j.deviceSecret));
  assert.deepEqual(s.cc.calls[0], ["createUser", { uid: j.uid, name: "Asha K" }]);
  assert.equal(res.headers.get("cache-control"), "no-store");
  await s.close();
});

test("register ignores any user id the visitor sends (no choosing someone else's id)", async () => {
  const s = await start();
  const res = await s.post("/api/auth/register", { name: "Mallory", uid: "og-0123456789abcdef" });
  const j = await res.json();
  assert.notEqual(j.uid, "og-0123456789abcdef");
  assert.notEqual(s.cc.calls[0][1].uid, "og-0123456789abcdef");
  await s.close();
});

test("register: invalid names are refused before CometChat is called", async () => {
  const s = await start({}, { registerPerIp: 100 });
  for (const name of [undefined, null, 5, {}, [], "", "   ", "\u0000\u0007", "x".repeat(41)]) {
    const res = await s.post("/api/auth/register", { name });
    assert.equal(res.status, 400, JSON.stringify(name));
    assert.equal((await res.json()).error.code, "invalid_name");
  }
  assert.equal(s.cc.calls.length, 0);
  await s.close();
});

test("login: right secret gets a token; wrong secret, other user's secret and forged secrets are refused (401)", async () => {
  const s = await start();
  const a = await (await s.post("/api/auth/register", { name: "A" })).json();
  const b = await (await s.post("/api/auth/register", { name: "B" })).json();
  s.cc.calls.length = 0;
  let res = await s.post("/api/auth/login", { uid: a.uid, deviceSecret: a.deviceSecret });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).authToken, `tok-${a.uid}`);
  // Impersonation attempts
  res = await s.post("/api/auth/login", { uid: a.uid, deviceSecret: b.deviceSecret });          // B's secret on A's id
  assert.equal(res.status, 401);
  res = await s.post("/api/auth/login", { uid: a.uid, deviceSecret: "A".repeat(43) });           // well-formed but wrong
  assert.equal(res.status, 401);
  res = await s.post("/api/auth/login", { uid: a.uid, deviceSecret: deviceSecretFor("another-secret-another-secret-another", a.uid) }); // signed with a different server secret
  assert.equal(res.status, 401);
  assert.deepEqual(s.cc.calls, [["token", a.uid]]);   // a token was only ever made for the real owner
  await s.close();
});

test("login: malformed ids and secrets are 400, and a demo id can't be used on /login", async () => {
  const s = await start();
  for (const body of [{}, { uid: "cometchat-uid-1", deviceSecret: "A".repeat(43) }, { uid: "og-xyz", deviceSecret: "A".repeat(43) }, { uid: "og-0123456789abcdef", deviceSecret: "short" }, { uid: 5, deviceSecret: 5 }, null]) {
    const res = await s.post("/api/auth/login", body ?? "null");
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal(s.cc.calls.length, 0);
  await s.close();
});

test("login: an account that no longer exists in CometChat is reported so the browser can forget it", async () => {
  const s = await start();
  const a = await (await s.post("/api/auth/register", { name: "A" })).json();
  s.cc.failWith = new CometChatError("not_found", 404);
  const res = await s.post("/api/auth/login", { uid: a.uid, deviceSecret: a.deviceSecret });
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error.code, "account_missing");
  await s.close();
});

test("demo accounts: off by default; when on, only the five shared test users, never arbitrary ids", async () => {
  let s = await start();
  let res = await s.post("/api/auth/demo", { uid: "cometchat-uid-1" });
  assert.equal(res.status, 403);
  assert.equal(s.cc.calls.length, 0);
  assert.equal((await (await fetch(s.base + "/api/auth/config")).json()).demoAccounts, false);
  await s.close();
  s = await start({ config: { demoAccounts: true } });
  res = await s.post("/api/auth/demo", { uid: "cometchat-uid-3" });
  assert.equal(res.status, 200);
  for (const uid of ["cometchat-uid-6", "og-0123456789abcdef", "admin", "", 7]) {
    assert.equal((await s.post("/api/auth/demo", { uid })).status, 400, String(uid));
  }
  assert.equal((await (await fetch(s.base + "/api/auth/config")).json()).demoAccounts, true);
  await s.close();
});

test("rate limits: register per address, register overall, login per address and per user all answer 429 with Retry-After", async () => {
  let s = await start({}, { registerPerIp: 2 });
  assert.equal((await s.post("/api/auth/register", { name: "a" })).status, 201);
  assert.equal((await s.post("/api/auth/register", { name: "b" })).status, 201);
  let res = await s.post("/api/auth/register", { name: "c" });
  assert.equal(res.status, 429);
  assert.ok(Number(res.headers.get("retry-after")) >= 1);
  assert.equal(s.cc.calls.length, 2);                       // the blocked one never reached CometChat
  await s.close();

  s = await start({}, { registerAll: 1 });
  assert.equal((await s.post("/api/auth/register", { name: "a" })).status, 201);
  assert.equal((await s.post("/api/auth/register", { name: "b" })).status, 429);
  await s.close();

  s = await start({}, { loginPerIp: 3 });
  for (let i = 0; i < 3; i++) assert.equal((await s.post("/api/auth/login", { uid: "og-0123456789abcdef", deviceSecret: "A".repeat(43) })).status, 401);
  assert.equal((await s.post("/api/auth/login", { uid: "og-0123456789abcdef", deviceSecret: "A".repeat(43) })).status, 429);
  await s.close();

  s = await start({}, { loginPerUid: 2 });
  for (let i = 0; i < 2; i++) assert.equal((await s.post("/api/auth/login", { uid: "og-0123456789abcdef", deviceSecret: "A".repeat(43) })).status, 401);
  assert.equal((await s.post("/api/auth/login", { uid: "og-0123456789abcdef", deviceSecret: "A".repeat(43) })).status, 429); // guessing one account's secret is capped
  await s.close();
});

test("rate limiter: the window slides, so people can try again later", () => {
  let t = 0;
  const l = createRateLimiter({ max: 2, windowMs: 1000, now: () => t });
  assert.ok(l.hit("k").ok); assert.ok(l.hit("k").ok);
  const blocked = l.hit("k");
  assert.equal(blocked.ok, false); assert.equal(blocked.retryAfterSec, 1);
  assert.ok(l.hit("other").ok);
  t = 1001;
  assert.ok(l.hit("k").ok);
});

test("request hygiene: wrong content type, huge body, bad JSON, wrong method, unknown path", async () => {
  const s = await start();
  let res = await fetch(s.base + "/api/auth/register", { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" });
  assert.equal(res.status, 415);
  res = await s.post("/api/auth/register", { name: "x".repeat(5000) });
  assert.equal(res.status, 413);
  res = await s.post("/api/auth/register", "{not json");
  assert.equal(res.status, 400);
  res = await fetch(s.base + "/api/auth/register");
  assert.equal(res.status, 405);
  res = await fetch(s.base + "/api/nothing");
  assert.equal(res.status, 404);
  assert.equal(s.cc.calls.length, 0);
  await s.close();
});

test("origin check: only listed web addresses may call the server from a browser", async () => {
  const s = await start();
  let res = await s.post("/api/auth/register", { name: "A" }, { origin: "https://evil.example" });
  assert.equal(res.status, 403);
  assert.equal(res.headers.get("access-control-allow-origin"), null);
  res = await s.post("/api/auth/register", { name: "A" }, { origin: "http://localhost:5173" });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
  res = await fetch(s.base + "/api/auth/login", { method: "OPTIONS", headers: { origin: "http://localhost:5173", "access-control-request-method": "POST" } });
  assert.equal(res.status, 204);
  assert.equal((await fetch(s.base + "/api/auth/login", { method: "OPTIONS", headers: { origin: "https://evil.example" } })).status, 403);
  await s.close();
});

test("CometChat failures become a calm 502 and never leak the REST key, tokens or secrets in responses or logs", async () => {
  const s = await start();
  s.cc.failWith = new CometChatError("unavailable", 503);
  const res = await s.post("/api/auth/register", { name: "Asha" });
  const text = await res.text();
  assert.equal(res.status, 502);
  assert.ok(!text.includes(REST_KEY) && !text.includes(SECRET));
  s.cc.failWith = new Error(`boom ${REST_KEY}`);        // even an unexpected error must not be echoed
  const res2 = await s.post("/api/auth/register", { name: "Asha" });
  const text2 = await res2.text();
  assert.equal(res2.status, 500);
  assert.ok(!text2.includes(REST_KEY));
  s.cc.failWith = null;
  const ok = await (await s.post("/api/auth/register", { name: "Asha" })).json();
  await s.post("/api/auth/login", { uid: ok.uid, deviceSecret: ok.deviceSecret });
  await s.post("/api/auth/login", { uid: ok.uid, deviceSecret: "A".repeat(43) });
  const logged = JSON.stringify(s.logs);
  for (const secret of [REST_KEY, SECRET, ok.deviceSecret, ok.authToken, "Asha"]) assert.ok(!logged.includes(secret), `log leaked ${secret.slice(0, 6)}…`);
  await s.close();
});

test("trust proxy: the client address comes from X-Forwarded-For only when enabled", async () => {
  let s = await start({}, { registerPerIp: 1 });                       // not trusted: header ignored, same address both times
  await s.post("/api/auth/register", { name: "a" }, { "x-forwarded-for": "1.1.1.1" });
  assert.equal((await s.post("/api/auth/register", { name: "b" }, { "x-forwarded-for": "2.2.2.2" })).status, 429);
  await s.close();
  s = await start({ config: { trustProxy: true } }, { registerPerIp: 1 });   // trusted: different clients are counted separately
  assert.equal((await s.post("/api/auth/register", { name: "a" }, { "x-forwarded-for": "1.1.1.1" })).status, 201);
  assert.equal((await s.post("/api/auth/register", { name: "b" }, { "x-forwarded-for": "2.2.2.2" })).status, 201);
  await s.close();
});

test("CometChat REST client: documented URLs, apikey header, and the key never appears in errors", async () => {
  const seen = [];
  const mk = (status, data) => async (url, init) => { seen.push({ url, init }); return { status, ok: status < 300, json: async () => ({ data }) }; };
  let api = createCometChatApi({ appId: "app1", region: "eu", restApiKey: REST_KEY, fetchImpl: mk(200, { authToken: "T1" }) });
  assert.equal(await api.createUser({ uid: "og-0123456789abcdef", name: "Asha" }), "T1");
  assert.equal(seen[0].url, "https://app1.api-eu.cometchat.io/v3/users");
  assert.equal(seen[0].init.headers.apikey, REST_KEY);
  assert.deepEqual(JSON.parse(seen[0].init.body), { uid: "og-0123456789abcdef", name: "Asha", withAuthToken: true });
  await api.createAuthToken("og-0123456789abcdef");
  assert.equal(seen[1].url, "https://app1.api-eu.cometchat.io/v3/users/og-0123456789abcdef/auth_tokens");
  for (const [status, kind] of [[404, "not_found"], [401, "rejected"], [500, "unavailable"], [429, "unavailable"]]) {
    api = createCometChatApi({ appId: "app1", region: "us", restApiKey: REST_KEY, fetchImpl: mk(status, {}) });
    await assert.rejects(() => api.createAuthToken("og-0123456789abcdef"), (e) => e instanceof CometChatError && e.kind === kind && !e.message.includes(REST_KEY));
  }
  api = createCometChatApi({ appId: "app1", region: "us", restApiKey: REST_KEY, fetchImpl: async () => { throw new Error(`net ${REST_KEY}`); } });
  await assert.rejects(() => api.createAuthToken("x"), (e) => e.kind === "unavailable" && !e.message.includes(REST_KEY));
});

test("config: missing or weak settings are named (never their values); a good config passes", () => {
  const bad = readConfig({ COMETCHAT_APP_ID: "x", COMETCHAT_REGION: "mars", OGS_SESSION_SECRET: "short", COMETCHAT_REST_API_KEY: "" });
  assert.equal(bad.ok, false);
  const text = bad.problems.join("|");
  assert.match(text, /COMETCHAT_REST_API_KEY is missing/);
  assert.match(text, /REGION must be/);
  assert.match(text, /SESSION_SECRET must be at least 32/);
  const good = readConfig({ COMETCHAT_APP_ID: "abc123def", COMETCHAT_REGION: "in", COMETCHAT_REST_API_KEY: "k", OGS_SESSION_SECRET: "z".repeat(32) });
  assert.equal(good.ok, true);
  assert.equal(good.config.demoAccounts, false);           // safe by default
  assert.deepEqual(parseEnv('# c\nA=1\nB="two"\nlower=3\nC = x '), { A: "1", B: "two", C: "x" });
});

test("validators", () => {
  assert.equal(cleanName("Zoë 🎉").ok, true);
  assert.equal(cleanName("a‮b").name, "ab");
  assert.equal(checkLogin({ uid: "og-0123456789abcdef", deviceSecret: "A".repeat(43) }).ok, true);
  assert.equal(checkDemo({ uid: DEMO_UIDS[0] }).ok, true);
  assert.equal(checkDemo({ uid: "cometchat-uid-9" }).ok, false);
});

test("browser client (authApi): maps server answers to clear error kinds and never sends an Auth Key", async () => {
  const reply = (status, body) => async (url, init) => { reply.last = { url, init }; return { ok: status < 300, status, json: async () => body }; };
  const r = await registerAccount("Asha", reply(201, { ok: true, uid: "og-0123456789abcdef", authToken: "t", deviceSecret: "d" }));
  assert.equal(r.uid, "og-0123456789abcdef");
  assert.equal(reply.last.url, "/api/auth/register");
  assert.equal(reply.last.init.credentials, "omit");
  assert.deepEqual(JSON.parse(reply.last.init.body), { name: "Asha" });
  await assert.rejects(() => loginAccount({ uid: "u", secret: "s" }, reply(401, { ok: false, error: { code: "not_authorised", message: "no" } })), (e) => e instanceof AuthApiError && e.kind === "not_authorised");
  await assert.rejects(() => loginAccount({ uid: "u", secret: "s" }, reply(429, { ok: false, error: { code: "rate_limited", message: "slow" } })), (e) => e.kind === "rate_limited");
  await assert.rejects(() => loginDemo("cometchat-uid-1", reply(403, { ok: false, error: { code: "demo_disabled", message: "off" } })), (e) => e.kind === "demo_disabled");
  await assert.rejects(() => registerAccount("x", async () => { throw new TypeError("fetch failed"); }), (e) => e.kind === "network");
  await assert.rejects(() => registerAccount("x", async () => ({ ok: false, status: 502, json: async () => { throw new Error("html"); } })), (e) => e.kind === "network"); // a non-JSON 5xx = nothing sensible is answering
  await assert.rejects(() => registerAccount("x", async () => ({ ok: false, status: 403, json: async () => ({ ok: false, error: { code: "origin_not_allowed", message: "no" } }) })), (e) => e.kind === "server");
});

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

test("no secret key reaches browser code: no Auth Key / REST key names in src/, VITE_ files or the front-end config", () => {
  const root = ROOT;
  for (const f of walk(join(root, "src")).filter((p) => /\.(jsx?|css|html)$/.test(p))) {
    const t = readFileSync(f, "utf8");
    assert.doesNotMatch(t, /setAuthKey|createUser\s*\(|AUTH_KEY|REST_API_KEY|OGS_SESSION_SECRET/, f);
    assert.doesNotMatch(t, /\.login\(\s*[a-zA-Z_.]*uid/i, f);   // no login-by-user-id from the browser
  }
  const env = readFileSync(join(root, ".env.example"), "utf8");
  assert.doesNotMatch(env.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n"), /VITE_[A-Z_]*(KEY|SECRET|TOKEN)/);
  const serverEnv = readFileSync(join(root, "server", ".env.example"), "utf8");
  assert.doesNotMatch(serverEnv.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n"), /VITE_/);
  assert.match(readFileSync(join(root, ".gitignore"), "utf8"), /^\.env$/m);
});

import { spawn, spawnSync } from "node:child_process";
test("real server process: refuses to start with missing settings (naming them, not their values) and starts with good ones", async () => {
  const cleanEnv = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };
  const bad = spawnSync(process.execPath, [join("server", "index.js")], { env: { ...cleanEnv, COMETCHAT_APP_ID: "abc123def", OGS_SESSION_SECRET: "tooshort-SECRETVALUE" }, encoding: "utf8", cwd: ROOT });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /COMETCHAT_REST_API_KEY is missing/);
  assert.doesNotMatch(bad.stderr + bad.stdout, /SECRETVALUE/);

  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [join("server", "index.js")], { env: { ...cleanEnv, COMETCHAT_APP_ID: "abc123def", COMETCHAT_REGION: "us", COMETCHAT_REST_API_KEY: "k-LEAKCHECK", OGS_SESSION_SECRET: "q".repeat(40), PORT: String(port) }, cwd: ROOT });
  let out = "";
  child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
  try {
    for (let i = 0; i < 50 && !out.includes("listening"); i++) await new Promise((r) => setTimeout(r, 100));
    assert.match(out, /listening/);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/health`)).status, 200);
    const r = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uid: "x", deviceSecret: "y" }) });
    assert.equal(r.status, 400);
    assert.ok(!out.includes("LEAKCHECK") && !out.includes("q".repeat(40)));
  } finally { child.kill(); }
});
