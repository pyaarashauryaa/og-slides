// Sliding-window rate limiter kept in memory: "at most `max` hits per `windowMs` for each key".
// In memory means it resets when the server restarts and is per server copy. That is fine for one small server;
// for several copies behind a load balancer, use a shared store (e.g. Redis) or the host's built-in limiter as well.
export function createRateLimiter({ max, windowMs, now = () => Date.now() }) {
  const hits = new Map();
  let lastSweep = now();
  const sweep = (t) => {
    if (t - lastSweep < windowMs) return;
    lastSweep = t;
    for (const [k, list] of hits) {
      const fresh = list.filter((x) => t - x < windowMs);
      if (fresh.length) hits.set(k, fresh); else hits.delete(k);
    }
  };
  return {
    // Counts a hit. Returns { ok:true } or { ok:false, retryAfterSec }.
    hit(key) {
      const t = now();
      sweep(t);
      const list = (hits.get(key) || []).filter((x) => t - x < windowMs);
      if (list.length >= max) {
        hits.set(key, list);
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (t - list[0])) / 1000)) };
      }
      list.push(t);
      hits.set(key, list);
      return { ok: true };
    },
    size: () => hits.size,
  };
}
