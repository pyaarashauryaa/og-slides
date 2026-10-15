// Who is signed in to CometChat in THIS browser tab. Shared by Home, Slides and Chat.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isCometChatConfigured } from "../config.js";
import { signInWithIdentity, signInDemo, createAccount } from "../cometchat/boot.js";
import { readIdentity, saveIdentity } from "../cometchat/identity.js";
import { readSavedUid, saveUid } from "../cometchat/testUsers.js";
import { explainError } from "../cometchat/explainError.js";
import { getDevIdentity } from "../dev.js";

const SessionContext = createContext(null);
export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }) {
  const dev = useMemo(() => getDevIdentity(), []);
  const [uid, setUid] = useState(() => (dev ? dev.uid : readSavedUid() || readIdentity()?.uid || null));
  const signedUpRef = useRef(null); // uid we just created and signed in, so the effect does not sign in twice
  const [phase, setPhase] = useState(dev ? "ready" : "idle"); // idle | signing-in | ready | error
  const [user, setUser] = useState(() => (dev ? { getUid: () => dev.uid, getName: () => dev.name } : null));
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (dev) return undefined;
    if (!isCometChatConfigured || !uid) {
      setPhase("idle");
      setUser(null);
      return undefined;
    }
    if (signedUpRef.current === uid) return undefined;
    let cancelled = false;
    setPhase("signing-in");
    setError(null);
    setUser(null);
    // Demo accounts (development) and real accounts sign in differently; both end in a CometChat token login.
    const identity = readIdentity();
    const demo = readSavedUid() === uid;
    const attempt_ = demo
      ? signInDemo(uid)
      : identity && identity.uid === uid
        ? signInWithIdentity(identity)
        : Promise.reject(Object.assign(new Error("No saved sign-in for this device."), { kind: "not_authorised" }));
    attempt_.then(
      (u) => {
        if (cancelled) return;
        setUser(u);
        setPhase("ready");
      },
      (e) => {
        if (cancelled) return;
        console.error("OGSlides sign-in failed:", e?.kind || e?.code || e?.name || "error");
        // The server said this device's saved account is no longer valid: forget it so "pick another" starts fresh.
        if (e?.kind === "not_authorised" || e?.kind === "account_missing") saveIdentity(null);
        setError(explainError(e));
        setPhase("error");
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uid, attempt, dev]);

  // First visit: make a real CometChat account with the chosen display name, then sign in. Resolves with the user.
  const signUp = useCallback(async (name) => {
    const { user: u, identity } = await createAccount({ name });
    saveIdentity(identity);
    saveUid(null); // the demo-account choice no longer applies
    signedUpRef.current = identity.uid;
    setUser(u);
    setError(null);
    setPhase("ready");
    setUid(identity.uid);
    return u;
  }, []);

  // "Not you?": forget this device's identity (the CometChat account stays; it is just no longer remembered here).
  const forgetMe = useCallback(() => {
    saveIdentity(null);
    saveUid(null);
    signedUpRef.current = null;
    setUser(null);
    setPhase("idle");
    setUid(null);
  }, []);

  const pick = useCallback((next) => {
    saveUid(next);
    setUid(next);
  }, []);

  const value = useMemo(
    () => ({
      dev,
      configured: isCometChatConfigured || Boolean(dev),
      uid,
      phase,
      user,
      error,
      pick,
      signUp,
      forgetMe,
      displayName: dev ? dev.name : user?.getName?.() || readIdentity()?.name || "",
      switchUser: () => pick(null),
      retry: () => setAttempt((a) => a + 1),
    }),
    [dev, uid, phase, user, error, pick, signUp, forgetMe]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
