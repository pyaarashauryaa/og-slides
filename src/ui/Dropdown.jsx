import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// A button that opens a small panel. Esc or a click outside closes it.
export default function Dropdown({ label, icon: Icon, title, children, align = "left", disabled, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div className={`dd ${className}`} ref={ref}>
      <button className="tb-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} title={title || label} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        {Icon && <Icon size={17} aria-hidden="true" />} {label && <span>{label}</span>} <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && <div className={`dd__panel dd__panel--${align}`} role="menu">{typeof children === "function" ? children(() => setOpen(false)) : children}</div>}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick, disabled, hint }) {
  return (
    <button className="dd__item" role="menuitem" disabled={disabled} onClick={onClick}>
      {Icon ? <Icon size={16} aria-hidden="true" /> : <span className="dd__noicon" aria-hidden="true" />} <span className="dd__label">{children}</span>
      {hint && <kbd className="dd__hint">{hint}</kbd>}
    </button>
  );
}
