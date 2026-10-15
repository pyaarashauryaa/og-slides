import { useMemo } from "react";
import { themeOf } from "./themes.js";
import ElementBody, { boxStyle } from "./ElementView.jsx";
import { useWorkspace } from "../workspace/WorkspaceProvider.jsx";
import { selectElements } from "../workspace/selectors.js";

// One 16:9 slide. Sizes use container-query units (cqw) so it looks identical
// as a tiny thumbnail, in the editor, or full screen.
export default function SlideView({ slide, theme, className = "", els }) {
  const t = themeOf(theme);
  const ws = useWorkspace();
  const free = slide?.mode === "free";
  const own = useMemo(() => (free && !els && ws ? selectElements(ws.snap.state, slide.id) : null), [free, els, ws, slide?.id]);
  const list = els || own;
  const title = slide?.title || "";
  const body = slide?.body || "";
  const layout = slide?.layout || "bullets";
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const style = { "--sl-bg": t.bg, "--sl-ink": t.ink, "--sl-accent": t.accent, "--sl-soft": t.soft, "--sl-panel": t.panel, "--sl-panel-ink": t.panelInk };

  return (
    <div className={`slide-frame ${className}`}>
      {free ? (
        <div className="slide slide--free" style={style}>
          {(list || []).map((el) => (
            <div key={el.id} className="el" style={boxStyle(el)}><ElementBody el={el} theme={theme} /></div>
          ))}
        </div>
      ) : (
      <div className={`slide slide--${layout}`} style={style}>
        <span className="slide__blob slide__blob--a" aria-hidden="true" />
        <span className="slide__blob slide__blob--b" aria-hidden="true" />
        {layout === "split" ? (
          <>
            <div className="slide__side"><p className="slide__title">{title || "Untitled"}</p></div>
            <div className="slide__main">
              {lines.map((l, i) => <p key={i} className="slide__text">{l}</p>)}
            </div>
          </>
        ) : layout === "bullets" ? (
          <div className="slide__main">
            <p className="slide__title">{title || "Untitled"}</p>
            <ul className="slide__list">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </div>
        ) : (
          <div className="slide__main">
            <p className="slide__title">{title || "Untitled"}</p>
            {lines.length > 0 && <p className="slide__sub">{lines.join(" ")}</p>}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
