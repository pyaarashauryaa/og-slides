import { useCallback, useEffect, useRef, useState } from "react";

// Local typing buffer for one shared field.
// - Saves ~0.7s after you stop typing, on blur, and when you leave.
// - Remote changes flow in while you are NOT typing.
// - If someone else changes the field while you ARE typing, we keep your text
//   and report a conflict: saving will replace their version (last write wins).
export function useDraft(remote, commit, remoteByOther, delay = 700) {
  const [draft, setDraft] = useState(remote);
  const [conflict, setConflict] = useState(false);
  const [theirs, setTheirs] = useState(null);
  const dirty = useRef(false);
  const conflictRef = useRef(false); // while a collision is unresolved, nothing is saved over theirs automatically
  const base = useRef(remote);
  const text = useRef(remote);
  const timer = useRef(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const flush = useCallback((force) => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    if (conflictRef.current && force !== true) return; // wait for the person to choose
    dirty.current = false;
    base.current = text.current;
    conflictRef.current = false;
    setConflict(false);
    setTheirs(null);
    commitRef.current(text.current);
  }, []);

  useEffect(() => {
    if (remote === base.current) return;
    if (!dirty.current) {
      base.current = remote;
      text.current = remote;
      setDraft(remote);
    } else if (remote !== text.current && remoteByOther) {
      base.current = remote;
      setTheirs(remote);
      conflictRef.current = true;
      setConflict(true);
    }
  }, [remote, remoteByOther]);

  useEffect(() => flush, [flush]);

  const onChange = (v) => {
    text.current = v;
    dirty.current = true;
    setDraft(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, delay);
  };
  // "Use theirs": drop my unsaved text and show the shared version.
  const useTheirs = () => {
    clearTimeout(timer.current);
    dirty.current = false;
    text.current = base.current;
    conflictRef.current = false;
    setDraft(base.current);
    setConflict(false);
    setTheirs(null);
  };
  return { value: draft, onChange, flush, conflict, theirs, useTheirs, dismiss: () => { conflictRef.current = false; setConflict(false); setTheirs(null); } };
}
