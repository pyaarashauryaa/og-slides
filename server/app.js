// OGSlides auth server. Its one job: give the browser a CometChat login token for the right person, and nobody else.
//
// How it stays safe:
//  * The CometChat REST API key lives only here (server/.env or your host's settings). The browser never receives it.
//  * The SERVER makes the user id (og-<16 random hex>). A visitor cannot choose or guess-and-take someone else's id.
//  * On sign-up the browser gets a "device secret" = HMAC(server secret, user id). To log in again it must send
//    that secret back. Without it, knowing a user id gets you nothing. The server stores nothing: it recomputes the HMAC.
//  * Everything is size-limited, validated and rate limited, and error messages never reveal secrets.
import { createServer } from "node:http";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createCometChatApi, CometChatError } from "./cometchatApi.js";
import { createRateLimiter } from "./rateLimit.js";
import { cleanName, checkLogin, checkDemo } from "./validate.js";

const MAX_BODY = 2048;

export function deviceSecretFor(sessionSecret, uid) {
  return createHmac("sha256", sessionSecret).update(`ogs-device-v1:${uid}`).digest("base64url");
}
export function secretMatches(sessionSecret, uid, given) {
  const a = Buffer.from(deviceSecretFor(sessionSecret, uid));
  const b = Buffer.from(String(given));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp({ config, cometchat, logger = () => {}, now = () => Date.now(), limits = {} }) {
  const api = cometchat || createCometChatApi(config);
  const L = {
    register: createRateLimiter({ max: limits.registerPerIp ?? 5, windowMs: 60 * 60_000, now }),
    registerAll: createRateLimiter({ max: limits.registerAll ?? 200, windowMs: 60 * 60_000, now }),
    login: createRateLimiter({ max: limits.loginPerIp ?? 30, windowMs: 10 * 60_000, now }),
    loginUid: createRateLimiter({ max: limits.loginPerUid ?? 10, windowMs: 10 * 60_000, now }),
    demo: createRateLimiter({ max: limits.demoPerIp ?? 20, windowMs: 10 * 60_000, now }),
  };

  const clientIp = (req) => {
    if (config.trustProxy) {
      const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (xff.length) return xff[xff.length - 1]; // the address your own proxy saw
    }
    return req.socket?.remoteAddress || "unknown";
  };

  function send(res, status, body, extra = {}) {
    res.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extra,
    });
    res.end(JSON.stringify(body));
  }
  const fail = (res, status, code, message, extra) => send(res, status, { ok: false, error: { code, message } }, extra);
  const limited = (res, r) => fail(res, 429, "rate_limited", "Too many tries. Please wait a little and try again.", { "retry-after": String(r.retryAfterSec) });

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      let tooBig = false;
      const chunks = [];
      req.on("data", (c) => {
        size += c.length;
        if (size > MAX_BODY) { if (!tooBig) { tooBig = true; reject(Object.assign(new Error("too big"), { code: "too_big" })); } return; } // keep draining; the connection is closed after we answer
        chunks.push(c);
      });
      req.on("end", () => {
        if (tooBig) return;
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); }
        catch { reject(Object.assign(new Error("bad json"), { code: "bad_json" })); }
      });
      req.on("error", () => reject(Object.assign(new Error("read"), { code: "bad_json" })));
    });
  }

  function cors(req, res) {
    const origin = req.headers.origin;
    if (!origin) return true;                         // not a browser page (curl, server to server)
    if (!config.origins.includes(origin)) return false;
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
    return true;
  }

  async function handler(req, res) {
    const url = new URL(req.url || "/", "http://x");
    const path = url.pathname;
    if (!cors(req, res)) { logger({ event: "origin_denied" }); return fail(res, 403, "origin_not_allowed", "This site is not allowed to use the sign-in server."); }

    if (req.method === "OPTIONS") {
      res.writeHead(204, { "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600" });
      return res.end();
    }
    if (req.method === "GET" && path === "/api/health") return send(res, 200, { ok: true });
    if (req.method === "GET" && path === "/api/auth/config") return send(res, 200, { ok: true, demoAccounts: config.demoAccounts });

    const known = ["/api/auth/register", "/api/auth/login", "/api/auth/demo"];
    if (!known.includes(path)) return fail(res, 404, "not_found", "Not found.");
    if (req.method !== "POST") return fail(res, 405, "method_not_allowed", "Use POST.", { allow: "POST, OPTIONS" });
    if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) return fail(res, 415, "bad_content_type", "Send JSON.");

    const ip = clientIp(req);
    let body;
    try { body = await readBody(req); }
    catch (e) { return e.code === "too_big" ? (res.on("finish", () => req.destroy()), fail(res, 413, "too_big", "That request is too large.", { connection: "close" })) : fail(res, 400, "bad_request", "That request could not be read."); }

    try {
      if (path === "/api/auth/register") {
        const r = L.register.hit(ip);
        if (!r.ok) { logger({ event: "register_limited" }); return limited(res, r); }
        const g = L.registerAll.hit("all");
        if (!g.ok) { logger({ event: "register_capped" }); return limited(res, g); }
        const n = cleanName(body?.name); // any "uid" the visitor sends is ignored on purpose
        if (!n.ok) return fail(res, 400, "invalid_name", n.message);
        const uid = `og-${randomBytes(8).toString("hex")}`;
        const authToken = await api.createUser({ uid, name: n.name });
        logger({ event: "registered" });
        return send(res, 201, { ok: true, uid, name: n.name, authToken, deviceSecret: deviceSecretFor(config.sessionSecret, uid) });
      }

      if (path === "/api/auth/login") {
        const r = L.login.hit(ip);
        if (!r.ok) { logger({ event: "login_limited" }); return limited(res, r); }
        const c = checkLogin(body);
        if (!c.ok) return fail(res, 400, "invalid_request", "That sign-in request was not valid.");
        const u = L.loginUid.hit(c.uid);
        if (!u.ok) { logger({ event: "login_uid_limited" }); return limited(res, u); }
        if (!secretMatches(config.sessionSecret, c.uid, c.deviceSecret)) {
          logger({ event: "login_denied" });
          return fail(res, 401, "not_authorised", "We couldn't sign you in on this device.");
        }
        const authToken = await api.createAuthToken(c.uid);
        return send(res, 200, { ok: true, uid: c.uid, authToken });
      }

      // /api/auth/demo: the five shared CometChat test users. Off unless ALLOW_DEMO_ACCOUNTS=true. Never enable in public.
      if (!config.demoAccounts) return fail(res, 403, "demo_disabled", "Demo accounts are turned off.");
      const r = L.demo.hit(ip);
      if (!r.ok) return limited(res, r);
      const d = checkDemo(body);
      if (!d.ok) return fail(res, 400, "invalid_request", "That sign-in request was not valid.");
      return send(res, 200, { ok: true, uid: d.uid, authToken: await api.createAuthToken(d.uid) });
    } catch (e) {
      if (e instanceof CometChatError) {
        logger({ event: "cometchat_error", kind: e.kind, status: e.status });
        if (e.kind === "not_found") return fail(res, 401, "account_missing", "That account no longer exists. Please create a new one.");
        return fail(res, 502, "upstream_unavailable", "The chat service is not available right now. Please try again in a moment.");
      }
      logger({ event: "server_error" });
      return fail(res, 500, "server_error", "Something went wrong on our side.");
    }
  }

  return { handler, server: () => createServer((req, res) => { handler(req, res).catch(() => { try { fail(res, 500, "server_error", "Something went wrong on our side."); } catch { /* connection already gone */ } }); }) };
}
