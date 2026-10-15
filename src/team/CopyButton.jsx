import { useEffect, useRef, useState } from "react";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { copyText } from "./copyText.js";

// A button that copies `getText()` and shows "Copied!" (or "Couldn't copy") right where you clicked.
// The message is also read out by screen readers (aria-live).
export default function CopyButton({ getText, label, doneLabel = "Copied!", className = "btn btn--soft btn--small", icon = true, children }) {
  const [state, setState] = useState("idle"); // idle | ok | fail
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onClick = async () => {
    const ok = await copyText(getText());
    setState(ok ? "ok" : "fail");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2200);
  };
  return (
    <span className="copyb">
      <button type="button" className={`${className}${state === "ok" ? " is-copied" : ""}`} onClick={onClick} aria-label={label}>
        {icon && (state === "ok" ? <Check size={16} aria-hidden="true" /> : state === "fail" ? <TriangleAlert size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />)}
        {state === "ok" ? doneLabel : state === "fail" ? "Couldn't copy" : children}
      </button>
      <span className="sr-only" role="status" aria-live="polite">{state === "ok" ? doneLabel : state === "fail" ? "Couldn't copy. Select the text and copy it by hand." : ""}</span>
    </span>
  );
}
