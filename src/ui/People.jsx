const COLORS = ["#c23b80", "#7c5cd6", "#17794f", "#b4561a", "#20739b", "#54213b"];
export const colorFor = (uid = "") => COLORS[[...uid].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
export const initials = (name = "?") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

export function Avatar({ uid, name, size = 30, title }) {
  return (
    <span className="avatar" style={{ background: colorFor(uid), width: size, height: size, fontSize: size * 0.4 }} title={title || name}>
      {initials(name)}
    </span>
  );
}

// "Who is here": you first, then everyone else who sent a recent presence signal.
export function PeopleStack({ self, peers, focusSlideId }) {
  return (
    <div className="people" aria-label="People in this presentation">
      {self && <Avatar uid={self.uid} name={self.name} title={`${self.name} (you)`} />}
      {peers.map((p) => (
        <span key={p.uid} className={`people__peer ${focusSlideId && p.slideId === focusSlideId ? "is-same" : ""}`}>
          <Avatar uid={p.uid} name={p.name} title={`${p.name} is here`} />
        </span>
      ))}
      <span className="people__count">{1 + peers.length} here</span>
    </div>
  );
}
