// Connects the sync engine to React. Starts when someone is signed in, stops when they leave.
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createEngine } from "./engine.js";
import { createActions } from "./actions.js";
import { initialState } from "./reducer.js";
import { createCometChatTransport } from "./transports/cometchat.js";
import { createMemoryTransport } from "./transports/memory.js";
import { useSession } from "../session/SessionProvider.jsx";
import { useTeam } from "../team/TeamProvider.jsx";

const IDLE = {
  phase: "idle", connection: "live", error: null, state: initialState(),
  pending: 0, saveState: "saved", presence: [], self: null, focus: {}, conflicts: [],
};
const noopSubscribe = () => () => {};
const getIdle = () => IDLE;

const WorkspaceContext = createContext(null);
export const useWorkspace = () => useContext(WorkspaceContext);

export function WorkspaceProvider({ children }) {
  const session = useSession();
  const team = useTeam();
  const teamCode = team?.current?.code || "";
  const [engine, setEngine] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const userUid = session.user ? session.user.getUid() : null;

  useEffect(() => {
    if (session.phase !== "ready" || !session.user || !team?.current) {
      setEngine(null);
      return undefined;
    }
    const self = { uid: session.user.getUid(), name: session.user.getName() || session.user.getUid() };
    const transport = session.dev ? createMemoryTransport(self, teamCode) : createCometChatTransport(team.current);
    const eng = createEngine({ transport, self });
    setEngine(eng);
    eng.start();
    return () => eng.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase, userUid, attempt, session.dev, teamCode]);

  const snap = useSyncExternalStore(engine ? engine.subscribe : noopSubscribe, engine ? engine.getSnapshot : getIdle);
  const actions = useMemo(() => (engine ? createActions(engine) : null), [engine]);

  // Warn before closing the tab while edits are still unsaved.
  useEffect(() => {
    const warn = (e) => {
      if (snap.pending > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [snap.pending]);

  // Coming back to the tab: re-read the saved history in case anything was missed.
  useEffect(() => {
    if (!engine) return undefined;
    const onVisible = () => {
      if (document.visibilityState === "visible") engine.reconcile();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [engine]);

  // Tell teammates when this tab goes to the background ("away") and when it comes back.
  useEffect(() => {
    if (!engine) return undefined;
    const sync = () => engine.setAway(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [engine]);

  // Live cursors have their own channel so a moving pointer never re-renders the app.
  const cursorApi = useMemo(() => (engine ? { subscribe: engine.subscribeCursors, get: engine.getCursors, send: engine.sendCursor } : null), [engine]);
  const value = useMemo(() => ({ snap, actions, cursorApi, restart: () => setAttempt((a) => a + 1) }), [snap, actions, cursorApi]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
