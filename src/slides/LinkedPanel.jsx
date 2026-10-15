import { useState } from "react";
import { TasksInner, ResourcesInner, DecisionsInner } from "../pages/Boards.jsx";

// Tasks, links and decisions attached to THIS presentation (same shared data as the main pages).
export default function LinkedPanel({ deckId }) {
  const [part, setPart] = useState("tasks");
  const Part = { tasks: TasksInner, resources: ResourcesInner, decisions: DecisionsInner }[part];
  return (
    <div className="linked">
      <div className="chips">
        {[["tasks", "Tasks"], ["resources", "Links"], ["decisions", "Decisions"]].map(([id, l]) => (
          <button key={id} className="chip" aria-pressed={part === id} onClick={() => setPart(id)}>{l}</button>
        ))}
      </div>
      <Part fixedDeckId={deckId} onNavigate={() => {}} />
    </div>
  );
}
