// The quick-jump menu (Ctrl/Cmd + K): which commands exist, and how typing narrows them.
// Pure functions, so they are unit-tested without a browser.

export const PAGE_COMMANDS = [
  { id: "go:home", group: "Go to", label: "Home", hint: "Alt 1", words: "dashboard start overview" },
  { id: "go:slides", group: "Go to", label: "Slides", hint: "Alt 2", words: "presentations decks editor" },
  { id: "go:chat", group: "Go to", label: "Team chat", hint: "Alt 3", words: "messages talk voice notes" },
  { id: "go:tasks", group: "Go to", label: "Tasks", hint: "Alt 4", words: "todo kanban deadlines" },
  { id: "go:resources", group: "Go to", label: "Resources", hint: "Alt 5", words: "links shelf bookmarks" },
  { id: "go:decisions", group: "Go to", label: "Decisions", hint: "Alt 6", words: "log timeline" },
];

// decks: [{id,title}], opts: { canCreate, callsAvailable, inCall }
export function buildCommands(decks = [], { canCreate = false, callsAvailable = false, inCall = false } = {}) {
  const list = [];
  if (canCreate) list.push({ id: "act:create", group: "Do", label: "Create a new presentation", words: "new add deck slides start" });
  if (callsAvailable && !inCall) {
    list.push({ id: "act:voice", group: "Do", label: "Join the voice room", words: "call talk audio headphones" });
    list.push({ id: "act:video", group: "Do", label: "Join the video call", words: "call camera" });
    list.push({ id: "act:ring", group: "Do", label: "Call a teammate", words: "ring phone direct one to one" });
  }
  list.push(...PAGE_COMMANDS);
  for (const d of decks.slice(0, 30)) list.push({ id: `deck:${d.id}`, group: "Presentations", label: d.title || "Untitled presentation", words: "open edit" });
  return list;
}

// Higher is better. 0 means "does not match".
export function scoreCommand(cmd, query) {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const label = cmd.label.toLowerCase();
  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 60;
  if (label.includes(q)) return 40;
  const hay = `${label} ${cmd.words || ""}`;
  if (q.split(/\s+/).every((part) => hay.includes(part))) return 20;
  // loose "letters in order" match: "tch" finds "Team chat"
  let i = 0;
  for (const ch of label) if (ch === q[i]) i += 1;
  return i === q.length ? 5 : 0;
}

export function filterCommands(commands, query) {
  return commands
    .map((c, i) => ({ c, s: scoreCommand(c, query), i }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c);
}

// Which page does Alt+<number> open?
export function pageForShortcut(key) {
  const i = Number(key) - 1;
  return Number.isInteger(i) && PAGE_COMMANDS[i] ? PAGE_COMMANDS[i].id.slice(3) : null;
}
