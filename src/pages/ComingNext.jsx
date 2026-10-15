import { Hammer } from "lucide-react";

// Honest placeholder for pages we have not built yet.
export default function ComingNext({ name, note }) {
  return (
    <div className="coming">
      <Hammer size={28} strokeWidth={1.75} aria-hidden="true" />
      <h2>{name} is next on the list</h2>
      <p>{note}</p>
    </div>
  );
}
