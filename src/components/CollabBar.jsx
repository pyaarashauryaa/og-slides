import { Avatar } from "../ui/People.jsx";

// "Who is here" for the editor: a chip per person with their cursor colour, name, and whether they are active or away.
// Colours come from the same assignment the slide cursors use, so a chip colour always matches that person's pointer.
// "Away" is only shown when the person's browser tab is really in the background (Page Visibility), never guessed.
export default function CollabBar({ self, peers, colors, focusSlideId, max = 4 }) {
  const people = [self && { uid: self.uid, name: self.name, you: true }, ...peers.map((p) => ({ uid: p.uid, name: p.name, away: p.away, slideId: p.slideId }))].filter(Boolean);
  const shown = people.slice(0, max);
  const extra = people.slice(max);
  const chip = (p) => {
    const c = colors.get(p.uid);
    const state = p.you ? "" : p.away ? "away" : "active";
    return (
      <li key={p.uid} className={`cchip${p.away ? " is-away" : ""}`} style={{ "--rc": c?.bg, "--rc-fg": c?.fg }} title={`${p.name}${p.you ? " (you)" : ""} · ${c?.name || ""} cursor${state ? ` · ${state}` : ""}${!p.you && focusSlideId && p.slideId === focusSlideId ? " · on this slide" : ""}`}>
        <span className="cchip__dot" aria-hidden="true" />
        <span aria-hidden="true"><Avatar uid={p.uid} name={p.name} size={22} /></span>
        <span className="cchip__name">{p.name}</span>
        {p.you ? <em className="cchip__tag">You</em> : state === "away" ? <em className="cchip__tag">Away</em> : null}
        <span className="sr-only">{`${p.you ? "you, " : ""}${c?.name || ""} cursor${state ? `, ${state}` : ""}`}</span>
      </li>
    );
  };
  return (
    <ul className="cbar" aria-label={`People in this presentation: ${people.length}`}>
      {shown.map(chip)}
      {extra.length > 0 && (
        <li className="cchip cchip--more" tabIndex={0} title={extra.map((p) => p.name).join(", ")} aria-label={`${extra.length} more: ${extra.map((p) => p.name).join(", ")}`}>
          +{extra.length}
        </li>
      )}
    </ul>
  );
}
