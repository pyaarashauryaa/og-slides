import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { mergeToast } from "./toastLogic.js";
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

const ICONS = { ok: CheckCircle2, error: CircleAlert, info: Info, warn: TriangleAlert };

// Polite notifications in the corner. kind: "ok" | "error" | "info" | "warn".
// toast(text, kind, ms, { action: { label, onClick } }) : an optional button (for example "Retry" or "Undo").
// Pass ms = 0 to keep a toast until it is dismissed.
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]);
  const n = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    itemsRef.current = itemsRef.current.filter((t) => t.id !== id);
    setItems(itemsRef.current);
  }, []);

  const toast = useCallback((text, kind = "info", ms = 4500, opts = {}) => {
    const r = mergeToast(itemsRef.current, { id: ++n.current, text, kind, action: opts.action });
    itemsRef.current = r.items;
    setItems(r.items);
    clearTimeout(timers.current.get(r.id));
    if (ms) timers.current.set(r.id, setTimeout(() => dismiss(r.id), ms));
    return r.id;
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const value = useMemo(() => toast, [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications">
        {items.map((t) => {
          const I = ICONS[t.kind] || Info;
          return (
            <div key={t.id} className={`toast toast--${t.kind}`} role={t.kind === "error" ? "alert" : "status"} aria-live={t.kind === "error" ? "assertive" : "polite"}>
              <I size={18} aria-hidden="true" />
              <span key={t.bump} className="toast__text">{t.text}{t.count > 1 && <b className="toast__count" aria-label={`${t.count} times`}>×{t.count}</b>}</span>
              {t.action && <button className="toast__action" onClick={() => { t.action.onClick?.(); dismiss(t.id); }}>{t.action.label}</button>}
              <button className="icon-btn icon-btn--sm" onClick={() => dismiss(t.id)} aria-label="Dismiss notification"><X size={14} aria-hidden="true" /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
