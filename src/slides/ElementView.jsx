import { resolveColor } from "./themes.js";
import { chartPrimitives, connectorPrimitives, parseTable, columnShares, withAlpha, TABLE_PAD } from "./vector.js";
import { SLIDE_W, SLIDE_H } from "../workspace/model.js";

// Positions are stored as numbers on a 960 x 540 canvas, drawn as percentages so the slide
// looks the same at any size. Font sizes use cqw (1% of the slide width).
export const U = SLIDE_W / 100; // 9.6 canvas units per cqw

export function boxStyle(el, over) {
  const b = { x: el.x, y: el.y, w: el.w, h: el.h, ...over };
  return { left: `${(b.x / SLIDE_W) * 100}%`, top: `${(b.y / SLIDE_H) * 100}%`, width: `${(b.w / SLIDE_W) * 100}%`, height: `${(b.h / SLIDE_H) * 100}%`, zIndex: el.z || 0 };
}

// Comfortable inner padding for text boxes (canvas units). Boxes with a coloured background get a little more.
// export/render.js uses the same numbers, so what you see is what you export.
export const TEXT_PAD = { plain: { x: 10, y: 6 }, filled: { x: 14, y: 8 } };

export function textStyle(el, theme) {
  const bw = el.bw || 0;
  const pad = el.bg && el.bg !== "none" ? TEXT_PAD.filled : TEXT_PAD.plain;
  return {
    fontFamily: `"${el.font || "Figtree"}", system-ui, sans-serif`,
    fontSize: `${(el.size || 28) / U}cqw`,
    fontWeight: el.bold ? 800 : 400,
    fontStyle: el.italic ? "italic" : "normal",
    textDecoration: el.underline ? "underline" : "none",
    textAlign: el.align || "left",
    lineHeight: el.lh || 1.3,
    letterSpacing: el.ls ? `${el.ls / U}cqw` : undefined,
    color: resolveColor(el.color || "ink", theme),
    background: el.bg && el.bg !== "none" ? resolveColor(el.bg, theme) : undefined,
    border: bw ? `${bw / U}cqw solid ${resolveColor(el.bc || "accent", theme)}` : undefined,
    padding: `${pad.y / U}cqw ${pad.x / U}cqw`,
    borderRadius: el.bg && el.bg !== "none" ? `${12 / U}cqw` : undefined,
  };
}

function Shape({ el, theme }) {
  const w = el.w, h = el.h;
  const fill = resolveColor(el.fill, theme);
  const stroke = resolveColor(el.stroke, theme);
  const sw = el.sw || 0;
  const common = { fill, stroke: sw ? stroke : "none", strokeWidth: sw, opacity: el.op ?? 1, strokeLinecap: "round", strokeLinejoin: "round" };
  let body;
  switch (el.shape) {
    case "ellipse": case "blob":
      body = <ellipse cx={w / 2} cy={h / 2} rx={Math.max(0, w / 2 - sw / 2)} ry={Math.max(0, h / 2 - sw / 2)} {...common} />; break;
    case "round":
      body = <rect x={sw / 2} y={sw / 2} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} rx={Math.min(w, h) * 0.18} {...common} />; break;
    case "line":
      body = <line x1={sw / 2} y1={h / 2} x2={w - sw / 2} y2={h / 2} {...common} fill="none" stroke={resolveColor(el.stroke === "none" ? el.fill : el.stroke, theme)} strokeWidth={sw || 4} />; break;
    case "arrow": {
      const c = resolveColor(el.stroke === "none" ? el.fill : el.stroke, theme);
      const t = sw || 4, head = Math.min(h, w * 0.5, 28);
      body = <g stroke={c} strokeWidth={t} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={el.op ?? 1}>
        <line x1={t} y1={h / 2} x2={w - t} y2={h / 2} />
        <polyline points={`${w - head},${h / 2 - head / 2} ${w - t},${h / 2} ${w - head},${h / 2 + head / 2}`} />
      </g>; break;
    }
    case "divider":
      body = <rect x="0" y="0" width={w} height={h} rx={Math.min(w, h) / 2} {...common} stroke="none" />; break;
    case "diamond":
      body = <polygon points={`${w / 2},${sw / 2} ${w - sw / 2},${h / 2} ${w / 2},${h - sw / 2} ${sw / 2},${h / 2}`} {...common} />; break;
    case "chevron": {
      const n = Math.min(h / 2, w * 0.3);
      body = <polygon points={`${sw / 2},${sw / 2} ${w - n},${sw / 2} ${w - sw / 2},${h / 2} ${w - n},${h - sw / 2} ${sw / 2},${h - sw / 2} ${n},${h / 2}`} {...common} />; break;
    }
    default:
      body = <rect x={sw / 2} y={sw / 2} width={Math.max(0, w - sw)} height={Math.max(0, h - sw)} {...common} />;
  }
  return <svg className="el__svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">{body}</svg>;
}


// ---- shared drawing instructions (see vector.js) rendered as SVG ----
const wedgePath = (p) => {
  const pt = (r, a) => [p.cx + r * Math.cos(a), p.cy + r * Math.sin(a)];
  const large = p.a1 - p.a0 > Math.PI ? 1 : 0;
  const [x0, y0] = pt(p.r, p.a0), [x1, y1] = pt(p.r, p.a1);
  if (!p.r0) return `M${p.cx},${p.cy} L${x0},${y0} A${p.r},${p.r} 0 ${large} 1 ${x1},${y1} Z`;
  const [x2, y2] = pt(p.r0, p.a1), [x3, y3] = pt(p.r0, p.a0);
  return `M${x0},${y0} A${p.r},${p.r} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${p.r0},${p.r0} 0 ${large} 0 ${x3},${y3} Z`;
};
export function PrimSvg({ prims, w, h, overflow = "hidden" }) {
  const font = `"Figtree", system-ui, sans-serif`;
  return (
    <svg className="el__svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ overflow }} aria-hidden="true">
      {prims.map((p, i) => {
        switch (p.k) {
          case "rect": return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.r || 0} style={{ fill: p.fill }} />;
          case "line": return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} style={{ stroke: p.stroke, strokeWidth: p.sw, opacity: p.opacity ?? 1 }} />;
          case "circle": return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} style={{ fill: p.fill, stroke: p.stroke || "none", strokeWidth: p.sw || 0 }} />;
          case "wedge": return <path key={i} d={wedgePath(p)} style={{ fill: p.fill, stroke: p.gap ? "#fff" : "none", strokeWidth: p.gap ? 2 : 0 }} />;
          case "poly": return <polyline key={i} points={p.pts.map((q) => q.join(",")).join(" ")} style={{ fill: p.fill || "none", stroke: p.stroke, strokeWidth: p.sw, strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: p.dash ? p.dash.join(" ") : undefined }} />;
          case "text": return <text key={i} x={p.x} y={p.y} textAnchor={p.anchor || "start"} dominantBaseline="central" style={{ fill: p.color, fontSize: p.size, fontWeight: p.bold ? 800 : 500, fontFamily: font, opacity: p.opacity ?? 1 }}>{p.t}</text>;
          default: return null;
        }
      })}
    </svg>
  );
}

function TableBody({ el, theme }) {
  const rows = parseTable(el);
  const cols = rows[0].length;
  const shares = columnShares(el, cols);
  const head = el.thead !== false;
  const line = `${1.5 / U}cqw solid ${resolveColor(el.bc || "soft", theme)}`;
  const bodyBg = resolveColor(el.bg && el.bg !== "none" ? el.bg : "paper", theme);
  const zebra = withAlpha(resolveColor("soft", theme), 0.45);
  return (
    <div className="el__table" style={{
      gridTemplateColumns: shares.map((x) => `${x * 100}fr`).join(" "), gridTemplateRows: `repeat(${rows.length}, 1fr)`,
      fontFamily: `"${el.font || "Figtree"}", system-ui, sans-serif`, fontSize: `${(el.size || 18) / U}cqw`, borderRadius: `${8 / U}cqw`, border: line,
    }}>
      {rows.map((r, ri) => r.map((c, ci) => {
        const isHead = head && ri === 0;
        const alt = !isHead && el.tz && (head ? ri : ri + 1) % 2 === 0;
        return (
          <div key={`${ri}-${ci}`} className={`el__cell${isHead ? " el__cell--head" : ""}`} style={{
            padding: `${TABLE_PAD.y / U}cqw ${TABLE_PAD.x / U}cqw`,
            color: resolveColor(isHead ? el.hc || "paper" : el.color || "ink", theme),
            backgroundColor: isHead ? resolveColor(el.fill && el.fill !== "none" ? el.fill : "panel", theme) : bodyBg,
            backgroundImage: alt ? `linear-gradient(${zebra}, ${zebra})` : undefined,
            borderRight: ci < cols - 1 ? line : undefined, borderBottom: ri < rows.length - 1 ? line : undefined,
          }}>{c}</div>
        );
      }))}
    </div>
  );
}

export function labelStyle(el, theme) {
  return {
    fontFamily: `"${el.font || "Figtree"}", system-ui, sans-serif`, fontSize: `${(el.size || 24) / U}cqw`,
    fontWeight: el.bold ? 800 : 600, fontStyle: el.italic ? "italic" : "normal", color: resolveColor(el.color || "paper", theme), lineHeight: 1.2,
  };
}

// The inside of one element. Never contains any editor controls.
export default function ElementBody({ el, theme, editing = false }) {
  if (el.type === "shape") {
    return el.text
      ? <><Shape el={el} theme={theme} /><div className="el__label" style={labelStyle(el, theme)}>{el.text}</div></>
      : <Shape el={el} theme={theme} />;
  }
  if (el.type === "chart") return <PrimSvg prims={chartPrimitives(el, theme)} w={el.w} h={el.h} />;
  if (el.type === "connector") return <PrimSvg prims={connectorPrimitives(el, theme)} w={el.w} h={el.h} overflow="visible" />;
  if (el.type === "table") return <TableBody el={el} theme={theme} />;
  if (el.type === "image") {
    return el.src ? (
      <img className="el__img" src={el.src} alt={el.alt || ""} style={{ objectFit: el.fit || "contain" }} draggable={false} crossOrigin="anonymous" />
    ) : (
      <div className={`el__ph ${editing ? "" : "el__ph--quiet"}`}>{editing ? "Click to add an image" : ""}</div>
    );
  }
  const lines = (el.text || "").split("\n");
  const st = textStyle(el, theme);
  if (el.list === "bullet" || el.list === "number") {
    const Tag = el.list === "number" ? "ol" : "ul";
    return <Tag className="el__text el__list" style={st}>{lines.filter((l) => l.trim()).map((l, i) => <li key={i}>{l}</li>)}</Tag>;
  }
  return <div className="el__text" style={st}>{lines.map((l, i) => <p key={i}>{l || " "}</p>)}</div>;
}
