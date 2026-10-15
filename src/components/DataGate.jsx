// Everything that shows shared data sits behind this: signed in, then workspace loaded.
import { useEffect, useState } from "react";
import { RefreshCw, TriangleAlert, WifiOff } from "lucide-react";
import SessionGate from "../session/SessionGate.jsx";
import { useWorkspace } from "../workspace/WorkspaceProvider.jsx";
import { explainError } from "../cometchat/explainError.js";
import { ListSkeleton } from "../ui/Skeleton.jsx";

const SLOW_MS = 20000;

function WorkspaceGate({ children, loading }) {
  const { snap, restart } = useWorkspace();
  const [slow, setSlow] = useState(false);
  // Never leave someone staring at a placeholder forever: after a while, say so and offer a retry.
  useEffect(() => {
    if (snap.phase === "ready" || snap.phase === "error") { setSlow(false); return undefined; }
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [snap.phase]);
  if (snap.phase === "ready") return children;
  if (snap.phase === "error") {
    const e = explainError(snap.error);
    return (
      <div className="panel" role="alert">
        <TriangleAlert size={28} strokeWidth={1.75} className="panel__icon" aria-hidden="true" />
        <h2>Couldn't load the shared workspace</h2>
        <p className="panel__lead">{e.friendly}</p>
        <p className="panel__tech">{e.technical}</p>
        <div className="panel__actions">
          <button className="btn btn--primary" onClick={restart}>
            <RefreshCw size={18} aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    );
  }
  return (
    <>
      {loading || <ListSkeleton />}
      {slow && (
        <div className="slownote" role="status">
          <WifiOff size={18} aria-hidden="true" />
          <span>This is taking longer than usual. Check your internet connection.</span>
          <button className="btn btn--small btn--ghost" onClick={restart}><RefreshCw size={15} aria-hidden="true" /> Try again</button>
        </div>
      )}
    </>
  );
}

export default function DataGate({ children, loading }) {
  return (
    <SessionGate>
      <WorkspaceGate loading={loading}>{children}</WorkspaceGate>
    </SessionGate>
  );
}
