// Development-only test mode (never active in a production build).
// Open  http://localhost:5173/?dev=memory&as=cometchat-uid-1  to skip CometChat and test
// the editor between tabs of one browser. A banner makes it obvious.
export function getDevIdentity() {
  if (!import.meta.env.DEV) return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get("dev") !== "memory") return null;
  const uid = q.get("as") || "dev-user-1";
  return { uid, name: q.get("name") || `Dev ${uid.slice(-1)}` };
}
