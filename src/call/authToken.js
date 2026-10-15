// Finds the login token the Calls SDK needs, from the CometChat session that is ALREADY signed in.
//
// Why this file exists (the AUTH_NO_TOKEN bug): in Chat SDK 4.x, CometChat.getLoggedInUser() returns a
// PROMISE, not a user. Calling .getAuthToken() on a Promise gives nothing, so every join looked "unauthenticated".
// The UI Kit's own getLoggedInUser() is synchronous and returns the real user object.
//
// `sources` are passed in so this can be unit-tested without CometChat:
//   sync()  -> user | null           (e.g. CometChatUIKit.getLoggedInUser)
//   async() -> Promise<user | null>  (e.g. CometChat.getLoggedinUser)
const isThenable = (x) => Boolean(x) && typeof x.then === "function";
const tokenOf = (user) => {
  if (!user || isThenable(user) || typeof user.getAuthToken !== "function") return "";
  const t = user.getAuthToken();
  return typeof t === "string" ? t : "";
};

export async function resolveAuthToken({ sync, async: asyncGet } = {}) {
  try {
    const t = tokenOf(sync?.());
    if (t) return t;
  } catch { /* try the next source */ }
  try {
    const t = tokenOf(await asyncGet?.());
    if (t) return t;
  } catch { /* fall through */ }
  return "";
}

// One shared "init the Calls SDK once" promise, so two quick clicks can't initialise it twice.
let initOnce = null;
export function ensureCallsInit(calls, settings, isReady = () => false) {
  if (isReady()) return Promise.resolve();
  if (!initOnce) {
    initOnce = Promise.resolve(calls.init(settings)).then((r) => {
      if (r && r.success === false) throw Object.assign(new Error(r.error?.message || "Calls init failed"), { code: "CALLS_INIT_FAILED" });
    }).catch((e) => {
      initOnce = null; // allow a retry after a failure
      throw e;
    });
  }
  return initOnce;
}
export const _resetCallsInitForTests = () => { initOnce = null; };
