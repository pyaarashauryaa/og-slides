// Reads server/.env (if it exists) into process.env WITHOUT overriding real environment variables
// (so a hosting provider's own settings always win). It never prints any value.
import { readFileSync } from "node:fs";

export function parseEnv(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (/^[A-Z][A-Z0-9_]*$/.test(key)) out[key] = val;
  }
  return out;
}

export function loadEnvFile(path, target = process.env) {
  let text;
  try { text = readFileSync(path, "utf8"); } catch { return false; } // no file: use the real environment only
  for (const [k, v] of Object.entries(parseEnv(text))) if (target[k] === undefined) target[k] = v;
  return true;
}

// Turns raw environment values into a checked config, or lists WHICH settings are wrong (never their values).
export function readConfig(env = process.env) {
  const problems = [];
  const need = (name) => { const v = String(env[name] ?? "").trim(); if (!v) problems.push(`${name} is missing`); return v; };
  const appId = need("COMETCHAT_APP_ID");
  const region = need("COMETCHAT_REGION").toLowerCase();
  const restApiKey = need("COMETCHAT_REST_API_KEY");
  const sessionSecret = need("OGS_SESSION_SECRET");
  if (appId && !/^[a-z0-9]{6,40}$/i.test(appId)) problems.push("COMETCHAT_APP_ID looks wrong");
  if (region && !["us", "eu", "in"].includes(region)) problems.push("COMETCHAT_REGION must be us, eu or in");
  if (sessionSecret && sessionSecret.length < 32) problems.push("OGS_SESSION_SECRET must be at least 32 characters");
  const origins = String(env.OGS_ALLOWED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173").split(",").map((s) => s.trim()).filter(Boolean);
  const port = Number(env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push("PORT must be a number between 1 and 65535");
  return {
    ok: problems.length === 0,
    problems,
    config: {
      appId, region, restApiKey, sessionSecret, origins, port,
      demoAccounts: String(env.ALLOW_DEMO_ACCOUNTS || "").toLowerCase() === "true",
      trustProxy: String(env.TRUST_PROXY || "").toLowerCase() === "true",
    },
  };
}
