// Turns CometChat error codes (listed in the official JS SDK error-codes page)
// into a sentence a person can act on. The raw code is always shown too.
const FRIENDLY = {
  MISSING_PARAMETERS: "The App ID is empty. Check VITE_COMETCHAT_APP_ID in your .env file.",
  AUTH_ERR_EMPTY_APPID: "The App ID is empty. Check VITE_COMETCHAT_APP_ID in your .env file.",
  AUTH_ERR_INVALID_APPID: "CometChat doesn't recognise this App ID in this Region. Check both values in your .env file.",
  ERR_UID_NOT_FOUND: "This test user doesn't exist in your CometChat app. Pick another one.",
  NO_INTERNET_CONNECTION: "Can't reach CometChat. Check your internet connection and try again.",
  FAILED_TO_FETCH: "Can't reach CometChat. Check your internet connection and try again.",
  WS_CONNECTION_FAIL: "Couldn't open the live connection to CometChat. Try again in a moment.",
  ERR_PLAN_RESTRICTION: "Your CometChat plan doesn't include something the app asked for.",
  ERR_TOO_MANY_REQUESTS: "CometChat is rate-limiting requests. Wait a few seconds and try again.",
  TOO_MANY_REQUEST: "CometChat is rate-limiting requests. Wait a few seconds and try again.",
};

const AUTH_HELP = {
  network: "Couldn't reach the OGSlides sign-in server. Start it with `npm.cmd run server` and try again.",
  rate_limited: "Too many sign-in tries. Wait a minute, then try again.",
  not_authorised: "This device's saved account isn't valid any more. Pick \"another user\" to start fresh.",
  account_missing: "That account no longer exists. Pick \"another user\" to create a new one.",
  unavailable: "The chat service isn't available right now. Try again in a moment.",
  demo_disabled: "Demo accounts are turned off on this server.",
};

export function explainError(error) {
  if (error?.name === "AuthApiError" || error?.kind) {
    return { friendly: AUTH_HELP[error.kind] || error.message || "Sign-in failed.", technical: `sign-in: ${error.kind || "error"}` };
  }
  const code = error?.code ? String(error.code) : "";
  const message = error?.message || String(error || "Unknown error");
  const friendly =
    FRIENDLY[code] ||
    "Something went wrong while talking to CometChat. If it mentions the key or the app, re-check your .env values, then restart the dev server.";
  return { friendly, technical: code ? `${code}: ${message}` : message };
}
