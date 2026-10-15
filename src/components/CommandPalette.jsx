import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Presentation, Search, Plus, Headphones, Video, Phone, ArrowRight } from "lucide-react";
import { buildCommands, filterCommands } from "../ui/commandLogic.js";

const ICON = { "act:create": Plus, "act:voice": Headphones, "act:video": Video, "act:ring": Phone };

// Ctrl/Cmd + K. One box to jump to any page or presentation or start a call.
// It is a real dialog: focus moves into it, Esc closes it, arrow keys move, Enter chooses, focus returns afterwards.
export default function CommandPalette({ decks, canCreate, callsAvailable, inCall, onRun, onClose }) {
  const [q, setQ] = useState("");
  const [at, setAt] = useState(0);
  const inputRef = useRef(null);
  const listId = useId();
  const all = useMemo(() => buildCommands(decks, { canCreate, callsAvailable, inCall }), [decks, canCreate, callsAvailable, inCall]);
  const shown = useMemo(() => filterCommands(all, q), [all, q]);

  useEffect(() => {
    const prev = document.activeElement;
    inputRef.current?.focus();
    return () => prev?.focus?.();
  }, []);
  useEffect(() => setAt(0), [q]);

  const run = (cmd) => { if (cmd) { onRun(cmd); onClose(); } };
  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setAt((i) => Math.min(shown.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); run(shown[at]); }
    else if (e.key === "Tab") e.preventDefault(); // keep focus in the box; arrows do the moving
  };
  useEffect(() => { document.getElementById(`${listId}-${at}`)?.scrollIntoView?.({ block: "nearest" }); }, [at, listId]);

  let lastGroup = null;
  return (
    <div className="palette-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Quick jump">
        <div className="palette__search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Jump to a page, a presentation or an action…"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={shown[at] ? `${listId}-${at}` : undefined}
            aria-label="Search pages, presentations and actions"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
        </div>
        <ul className="palette__list" id={listId} role="listbox" aria-label="Results">
          {shown.length === 0 && <li className="palette__empty" role="option" aria-disabled="true" aria-selected="false">Nothing matches “{q}”. Try “tasks”, “chat” or part of a presentation’s name.</li>}
          {shown.map((c, i) => {
            const header = c.group !== lastGroup;
            lastGroup = c.group;
            const Icon = ICON[c.id] || (c.id.startsWith("deck:") ? Presentation : ArrowRight);
            return (
              <li key={c.id} role="presentation">
                {header && <div className="palette__group" aria-hidden="true">{c.group}</div>}
                <div id={`${listId}-${i}`} role="option" aria-selected={i === at} className={`palette__item${i === at ? " is-on" : ""}`} onMouseMove={() => setAt(i)} onClick={() => run(c)}>
                  <span className="palette__ico" aria-hidden="true"><Icon size={16} /></span>
                  <span className="palette__label">{c.label}</span>
                  {c.hint && <kbd>{c.hint}</kbd>}
                  {i === at && <CornerDownLeft size={14} aria-hidden="true" className="palette__enter" />}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="palette__foot"><kbd>↑</kbd><kbd>↓</kbd> move <kbd>Enter</kbd> choose <kbd>Esc</kbd> close</p>
      </div>
    </div>
  );
}
