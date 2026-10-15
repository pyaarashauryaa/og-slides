// A returning visitor is remembered on this device: the user id the SERVER made for them, their display name, and the
// device secret the server gave them. The secret is what proves "this is really that user" when logging in again.
// No CometChat key is stored here. (localStorage can be read by any script running on this page, so keep the site free of
// untrusted scripts, and see the README's security section.)
const KEY = "ogslides.identity";

export function readIdentity() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v.uid === "string" && /^og-[0-9a-f]{16}$/.test(v.uid) && typeof v.name === "string" && /^[A-Za-z0-9_-]{43}$/.test(v.secret || "")) return { uid: v.uid, name: v.name, secret: v.secret };
  } catch { /* unreadable or blocked storage: treat as a new visitor */ }
  return null;
}

export function saveIdentity(identity) {
  try {
    if (identity) localStorage.setItem(KEY, JSON.stringify({ uid: identity.uid, name: identity.name, secret: identity.secret }));
    else localStorage.removeItem(KEY);
  } catch { /* storage blocked: the app still works for this visit */ }
}
