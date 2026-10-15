// The only file that talks to CometChat's REST API. Docs checked:
//   Create user        POST https://{appId}.api-{region}.cometchat.io/v3/users            body { uid, name, withAuthToken }
//   Create auth token  POST https://{appId}.api-{region}.cometchat.io/v3/users/{uid}/auth_tokens   body { force }
//   Header             apikey: <REST API key with fullAccess scope>   (server side only)
// Errors thrown from here never contain the API key.
export class CometChatError extends Error {
  constructor(kind, status) {
    super(`CometChat request failed (${kind}${status ? ` ${status}` : ""})`);
    this.kind = kind;       // "not_found" | "rejected" | "unavailable"
    this.status = status || 0;
  }
}

export function createCometChatApi({ appId, region, restApiKey, fetchImpl = globalThis.fetch, timeoutMs = 8000 }) {
  const base = `https://${appId}.api-${region}.cometchat.io/v3`;
  async function call(method, path, body) {
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: { apikey: restApiKey, "content-type": "application/json", accept: "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new CometChatError("unavailable");
    }
    if (res.status === 404) throw new CometChatError("not_found", 404);
    if (res.status >= 500 || res.status === 429) throw new CometChatError("unavailable", res.status);
    if (!res.ok) throw new CometChatError("rejected", res.status);
    let json;
    try { json = await res.json(); } catch { throw new CometChatError("unavailable", res.status); }
    return json?.data ?? {};
  }
  return {
    // Creates the user and returns their first auth token in the same call.
    async createUser({ uid, name }) {
      const data = await call("POST", "/users", { uid, name, withAuthToken: true });
      if (typeof data.authToken === "string" && data.authToken) return data.authToken;
      return this.createAuthToken(uid); // older responses may omit it
    },
    async createAuthToken(uid) {
      const data = await call("POST", `/users/${encodeURIComponent(uid)}/auth_tokens`, {});
      if (typeof data.authToken !== "string" || !data.authToken) throw new CometChatError("unavailable");
      return data.authToken;
    },
  };
}
