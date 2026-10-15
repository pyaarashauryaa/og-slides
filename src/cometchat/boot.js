// Starts CometChat and signs a test user in.
// The order matters: init() must finish, THEN login(), THEN we may show the chat.
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatUIKit, UIKitSettingsBuilder } from "@cometchat/chat-uikit-react";
import { COMETCHAT, isCometChatConfigured } from "../config.js";
import { registerAccount, loginAccount, loginDemo } from "./authApi.js";

let initPromise = null;

function initOnce() {
  if (!initPromise) {
    const settings = new UIKitSettingsBuilder()
      .setAppId(COMETCHAT.appId)
      .setRegion(COMETCHAT.region)
      // Remember the login per browser TAB (not per browser), so two tabs
      // can be two different test users while you test the chat.
      .setStorageMode(CometChat.StorageMode.SESSION)
      .subscribePresenceForAllUsers()
      // Needed for voice rooms and calls. Uses the @cometchat/calls-sdk-javascript package.
      .setCallingEnabled(true)
      .build();

    initPromise = CometChatUIKit.init(settings).catch((error) => {
      initPromise = null; // allow "Try again" after a failure
      throw error;
    });
  }
  return initPromise;
}

// How sign-in works now (no secret key in the browser):
//   1. our server (server/) makes the CometChat user / auth token with its private REST API key
//   2. the browser receives only that user's token and logs in with it: CometChatUIKit.loginWithAuthToken(token)
// React runs effects twice in development: share one in-flight sign-in per person instead of asking the server twice.
const inflight = new Map();
function once(key, fn) {
  if (inflight.has(key)) return inflight.get(key);
  const p = fn().finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
  inflight.set(key, p);
  return p;
}

async function loginWithToken(uid, authToken) {
  const current = CometChatUIKit.getLoggedInUser();
  if (current && current.getUid() === uid) return current;
  if (current) await CometChatUIKit.logout();
  return CometChatUIKit.loginWithAuthToken(authToken);
}

function needConfig() {
  if (!isCometChatConfigured) throw new Error("CometChat App ID and Region are missing from your .env file.");
}

// First visit: the server creates the account. Resolves { user, identity } (identity is what to remember on this device).
export async function createAccount({ name }) {
  needConfig();
  await initOnce();
  const r = await registerAccount(name);
  const user = await loginWithToken(r.uid, r.authToken);
  return { user, identity: { uid: r.uid, name: r.name, secret: r.deviceSecret } };
}

// Returning visitor: reuse this tab's CometChat session if it is already them; otherwise ask the server for a fresh token.
export function signInWithIdentity(identity) {
  return once(`id:${identity.uid}`, () => signInWithIdentityNow(identity));
}
async function signInWithIdentityNow(identity) {
  needConfig();
  await initOnce();
  const current = CometChatUIKit.getLoggedInUser();
  if (current && current.getUid() === identity.uid) return current;
  const r = await loginAccount(identity);
  return loginWithToken(identity.uid, r.authToken);
}

// Shared demo users (cometchat-uid-1..5). The server only allows this when ALLOW_DEMO_ACCOUNTS=true (development).
export function signInDemo(uid) {
  return once(`demo:${uid}`, () => signInDemoNow(uid));
}
async function signInDemoNow(uid) {
  needConfig();
  await initOnce();
  const current = CometChatUIKit.getLoggedInUser();
  if (current && current.getUid() === uid) return current;
  const r = await loginDemo(uid);
  return loginWithToken(uid, r.authToken);
}
