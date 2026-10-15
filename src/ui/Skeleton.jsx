// Loading placeholders that match the final layout, so content does not jump when it arrives.
// They are only shown while real work is pending (see DataGate) and are announced once to screen readers.
export function Skel({ w, h = 14, r, className = "", style }) {
  return <span className={`skel ${className}`} style={{ width: w, height: h, borderRadius: r, ...style }} aria-hidden="true" />;
}

export function HomeSkeleton() {
  return (
    <div className="home" role="status" aria-live="polite" aria-label="Loading your team's workspace">
      <span className="sr-only">Loading your team's presentations…</span>
      <div className="home-head" aria-hidden="true">
        <div><Skel w={120} h={14} /><Skel w={220} h={30} r={6} style={{ marginTop: 8 }} /></div>
        <Skel w={120} h={44} r={8} />
      </div>
      <div className="quick" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <Skel key={i} h={48} r={8} />)}
      </div>
      <div className="deck-grid" aria-hidden="true">
        {[0, 1, 2].map((i) => <Skel key={i} h={220} r={8} />)}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="panel panel--skeleton" role="status" aria-live="polite" aria-label="Loading">
      <span className="sr-only">Loading your team's presentations…</span>
      <div aria-hidden="true" style={{ display: "grid", gap: 14 }}>
        <Skel w="40%" h={22} r={8} />
        {Array.from({ length: rows }, (_, i) => <Skel key={i} h={64} r={16} />)}
      </div>
    </div>
  );
}
