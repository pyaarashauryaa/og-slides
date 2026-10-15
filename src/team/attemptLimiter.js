// A polite brake on guessing passkeys from THIS browser: after `max` wrong tries for one room code within
// `windowMs`, further tries wait. It is only a courtesy. Real protection has to come from the server (CometChat
// checks every passkey); a determined person can clear this by reloading, so it is not relied on for security.
export function createAttemptLimiter({ max = 5, windowMs = 60_000, now = () => Date.now() } = {}) {
  const fails = new Map(); // key -> [timestamps]
  const recent = (key) => {
    const t = now();
    const list = (fails.get(key) || []).filter((x) => t - x < windowMs);
    fails.set(key, list);
    return list;
  };
  return {
    check(key) {
      const list = recent(key);
      if (list.length < max) return { ok: true, waitMs: 0 };
      return { ok: false, waitMs: windowMs - (now() - list[0]) };
    },
    fail(key) { recent(key).push(now()); },
    success(key) { fails.delete(key); },
  };
}
