import { useEffect, useRef } from "react";
import { Button } from "./Button.jsx";

// A small accessible dialog: Esc closes, focus moves inside, clicking the backdrop closes.
export default function Modal({ title, onClose, children, actions, wide }) {
  const ref = useRef(null);
  // Keep the latest onClose in a ref: the effect below must run once per dialog, not on every
  // re-render (otherwise typing in a field of a parent-controlled form would keep stealing focus).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector("input,textarea,button")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { closeRef.current(); return; }
      if (e.key !== "Tab" || !ref.current) return;
      const f = [...ref.current.querySelectorAll("button:not([disabled]),input,textarea,select,[href],[tabindex]:not([tabindex='-1'])")];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, []);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && closeRef.current()}>
      <div className={`modal ${wide ? "modal--wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        <div className="modal__body">{children}</div>
        {actions && <div className="modal__actions">{actions}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, text, confirmLabel = "Delete", onConfirm, onClose }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
        </>
      }
    >
      <p>{text}</p>
    </Modal>
  );
}
