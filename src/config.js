// Reads the CometChat settings from your local ".env" file.
// App ID and Region only say WHICH CometChat app to talk to. They are not secrets.
// The sign-in SERVER (server/) holds the REST API key. No secret key is ever read here.
const env = import.meta.env || {}; // (empty when the code runs under plain Node, e.g. in tests)
export const COMETCHAT = {
  appId: env.VITE_COMETCHAT_APP_ID || "",
  region: env.VITE_COMETCHAT_REGION || "",
};

// Where the sign-in server lives. Empty = the same website (in development Vite forwards /api to the server).
// Only set VITE_AUTH_API_URL when the server runs on a different address, e.g. https://auth.example.com
export const AUTH_API_URL = (env.VITE_AUTH_API_URL || "").replace(/\/+$/, "");

export const isCometChatConfigured = Boolean(COMETCHAT.appId && COMETCHAT.region);
