// Talks to OUR sign-in server (server/). It returns a CometChat login token for the right person.
// The browser never sees a CometChat secret key: only a per-user token and (once, at sign-up) a device secret.
import { AUTH_API_URL } from "../config.js";

export class AuthApiError extends Error {
  constructor(kind, message, status = 0) {
    super(message);
    this.name = "AuthApiError";
    this.kind = kind; // network | rate_limited | not_authorised | account_missing | invalid | unavailable | demo_disabled | server
    this.status = status;
  }
}

const KIND_BY_CODE = {
  rate_limited: "rate_limited", not_authorised: "not_authorised", account_missing: "account_missing", invalid_name: "invalid",
  invalid_request: "invalid", upstream_unavailable: "unavailable", demo_disabled: "demo_disabled", origin_not_allowed: "server",
};

async function post(path, body, fetchImpl = globalThis.fetch) {
  let res;
  try {
    res = await fetchImpl(`${AUTH_API_URL}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), credentials: "omit" });
  } catch {
    throw new AuthApiError("network", "Couldn't reach the OGSlides sign-in server. Is it running?");
  }
  let json = null;
  try { json = await res.json(); } catch { /* not JSON: handled below */ }
  if (res.ok && json?.ok) return json;
  // An error page that is not our JSON (e.g. the dev proxy saying "nothing is listening") means the server isn't reachable.
  if (!json && res.status >= 500) throw new AuthApiError("network", "Couldn't reach the OGSlides sign-in server. Is it running?", res.status);
  const code = json?.error?.code;
  throw new AuthApiError(KIND_BY_CODE[code] || "server", json?.error?.message || "The sign-in server had a problem.", res.status);
}

export const registerAccount = (name, f) => post("/api/auth/register", { name }, f);
export const loginAccount = ({ uid, secret }, f) => post("/api/auth/login", { uid, deviceSecret: secret }, f);
export const loginDemo = (uid, f) => post("/api/auth/demo", { uid }, f);

export async function demoAvailable(fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(`${AUTH_API_URL}/api/auth/config`, { credentials: "omit" });
    const json = await res.json();
    return Boolean(json?.ok && json.demoAccounts);
  } catch {
    return false;
  }
}
