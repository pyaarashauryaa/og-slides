import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Copy, Trash2, BringToFront, SendToBack, ArrowUp, ArrowDown, ImagePlus, ImageOff, Minus, Plus, ChevronDown, X, FlipHorizontal2, FlipVertical2, AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, TriangleAlert } from "lucide-react";
import Field from "./Field.jsx";
import { FONTS, SHAPES } from "../workspace/model.js";
import { THEMES } from "./themes.js";
import { parseChartData, serializeChartRows, chartIssues, parseTable, columnShares, tableOverflow, CHART_MAX_ROWS } from "./vector.js";
import { tableSetCell, tableAddRow, tableRemoveRow, tableAddCol, tableRemoveCol, tableSetColWidth, alignPatch } from "./newElements.js";
import { TABLE_MAX_ROWS, TABLE_MAX_COLS, ARROW_ENDS } from "../workspace/model.js";

const TYPE_NAME = { text: "Text box", image: "Image", shape: "Shape", chart: "Chart", table: "Table", connector: "Line / arrow" };
const END_NAME = { none: "None", arrow: "Open arrow", triangle: "Filled arrow", dot: "Dot" };

function ChartSection({ el, set, theme }) {
  const rows = parseChartData(el.cdata).rows;
  const issues = chartIssues(el);
  const key = `cdata:${el.id}`;
  const write = (next) => set({ cdata: serializeChartRows(next) }, key);
  const edit = (i, patch) => write(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)));
  return (
    <Section title="Chart" defaultOpen>
      <div className="field"><span>Chart type</span>
        <div className="chips">{[["bar", "Bars"], ["line", "Line"], ["pie", "Pie"], ["doughnut", "Doughnut"]].map(([id, l]) => <button key={id} className="chip" aria-pressed={(el.ctype || "bar") === id} onClick={() => set({ ctype: id })}>{l}</button>)}</div>
      </div>
      <Field label="Chart title" remote={el.ctitle || ""} who={el.updatedBy} byOther={false} max={120} onCommit={(v) => set({ ctitle: v }, `ctitle:${el.id}`)} />
      <div className="field"><span>Data (a label and a number on each row)</span>
        <div className="datagrid" role="group" aria-label="Chart data">
          {rows.map((r, i) => (
            <div className={`datagrid__row${r.ok ? "" : " is-bad"}`} key={`${i}|${r.label}|${r.raw}`}>
              <input aria-label={`Row ${i + 1} label`} defaultValue={r.label} maxLength={40} onBlur={(e) => e.target.value !== r.label && edit(i, { label: e.target.value })} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
              <input aria-label={`Row ${i + 1} value`} inputMode="decimal" defaultValue={r.raw} onBlur={(e) => e.target.value !== r.raw && edit(i, { raw: e.target.value.trim() })} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
              <button className="icon-btn icon-btn--sm" aria-label={`Remove row ${i + 1}`} title="Remove this row" onClick={() => write(rows.filter((_, n) => n !== i))}><X size={14} /></button>
            </div>
          ))}
        </div>
        <button className="btn btn--soft btn--small" disabled={rows.length >= CHART_MAX_ROWS} onClick={() => write([...rows, { label: `Item ${rows.length + 1}`, raw: "10" }])}><Plus size={15} aria-hidden="true" /> Add a row</button>
        {issues.length > 0 && <ul className="issues" role="status">{issues.map((m) => <li key={m}><TriangleAlert size={14} aria-hidden="true" /> {m}</li>)}</ul>}
      </div>
      <div className="field"><span>Colours</span>
        <div className="chips">{[["brand", "Colourful"], ["theme", "Match theme"]].map(([id, l]) => <button key={id} className="chip" aria-pressed={(el.cpal || "brand") === id} onClick={() => set({ cpal: id })}>{l}</button>)}</div>
      </div>
      <div className="row"><button className="chip" aria-pressed={el.cval !== false} onClick={() => set({ cval: el.cval === false })}>Show values</button></div>
    </Section>
  );
}

function TableSection({ el, set, theme }) {
  const rows = parseTable(el);
  const cols = rows[0].length;
  const shares = columnShares(el, cols);
  const cut = tableOverflow(el);
  return (
    <>
      <Section title="Table cells" defaultOpen>
        <div className="tablegrid" role="group" aria-label="Table cells" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr)) 24px` }}>
          {rows.map((r, ri) => (
            <div className="tablegrid__row" key={`r${ri}`} style={{ display: "contents" }}>
              {r.map((c, ci) => (
                <input key={`${ri}|${ci}|${c}`} aria-label={`Row ${ri + 1}, column ${ci + 1}`} defaultValue={c} maxLength={120}
                  className={el.thead !== false && ri === 0 ? "is-head" : ""}
                  onBlur={(e) => e.target.value !== c && set(tableSetCell(el, ri, ci, e.target.value), `cell:${el.id}`)} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} />
              ))}
              <button className="icon-btn icon-btn--sm" disabled={rows.length <= 1} aria-label={`Remove row ${ri + 1}`} title="Remove this row" onClick={() => set(tableRemoveRow(el, ri))}><X size={13} /></button>
            </div>
          ))}
          {shares.map((x, ci) => (
            <button key={`c${ci}`} className="icon-btn icon-btn--sm tablegrid__rmcol" disabled={cols <= 1} aria-label={`Remove column ${ci + 1}`} title="Remove this column" onClick={() => set(tableRemoveCol(el, ci))}><X size={13} /></button>
          ))}
        </div>
        <div className="row">
          <button className="btn btn--soft btn--small" disabled={rows.length >= TABLE_MAX_ROWS} onClick={() => set(tableAddRow(el))}><Plus size={15} aria-hidden="true" /> Row</button>
          <button className="btn btn--soft btn--small" disabled={cols >= TABLE_MAX_COLS} onClick={() => set(tableAddCol(el))}><Plus size={15} aria-hidden="true" /> Column</button>
        </div>
        <div className="field"><span>Column widths</span>
          <div className="row row--nums" style={{ flexWrap: "wrap" }}>
            {shares.map((x, ci) => <Num key={ci} label={`Col ${ci + 1}`} value={Math.round(x * cols * 100) / 100} min={0.4} max={4} step={0.1} onChange={(v) => set(tableSetColWidth(el, ci, v), `cw:${el.id}`)} />)}
          </div>
        </div>
        {cut > 0 && <p className="issues" role="status"><TriangleAlert size={14} aria-hidden="true" /> {cut} cell{cut === 1 ? "" : "s"} may be cut off. Make the table taller or the text smaller.</p>}
      </Section>
      <Section title="Table style">
        <div className="row">
          <button className="chip" aria-pressed={el.thead !== false} onClick={() => set({ thead: el.thead === false })}>Header row</button>
          <button className="chip" aria-pressed={!!el.tz} onClick={() => set({ tz: !el.tz })}>Striped rows</button>
        </div>
        <Num label="Text size" value={el.size || 18} min={8} max={60} onChange={(v) => set({ size: v }, `size:${el.id}`)} />
        <ColorField label="Header colour" value={el.fill || "panel"} theme={theme} onChange={(c) => set({ fill: c })} />
        <ColorField label="Header text" value={el.hc || "paper"} theme={theme} onChange={(c) => set({ hc: c })} />
        <ColorField label="Cell background" value={el.bg || "paper"} theme={theme} onChange={(c) => set({ bg: c })} />
        <ColorField label="Cell text" value={el.color || "ink"} theme={theme} onChange={(c) => set({ color: c })} />
        <ColorField label="Lines" value={el.bc || "soft"} theme={theme} onChange={(c) => set({ bc: c })} />
      </Section>
    </>
  );
}

function ConnectorSection({ el, set, theme }) {
  const endSelect = (label, field, dflt) => (
    <div className="field"><span>{label}</span>
      <select value={el[field] ?? dflt} onChange={(e) => set({ [field]: e.target.value })}>{ARROW_ENDS.map((a) => <option key={a} value={a}>{END_NAME[a]}</option>)}</select>
    </div>
  );
  return (
    <Section title="Line and arrow" defaultOpen>
      <ColorField label="Line colour" value={el.stroke && el.stroke !== "none" ? el.stroke : "ink"} theme={theme} onChange={(c) => set({ stroke: c })} />
      <Num label="Line thickness" value={el.sw || 4} min={1} max={40} onChange={(v) => set({ sw: v }, `sw:${el.id}`)} />
      {endSelect("Start", "at", "none")}
      {endSelect("End", "ah", "arrow")}
      <div className="row">
        <button className="chip" aria-pressed={!!el.dash} onClick={() => set({ dash: !el.dash })}>Dashed</button>
        <button className="chip" aria-pressed={el.curve === "elbow"} onClick={() => set({ curve: el.curve === "elbow" ? "straight" : "elbow" })}>Elbow bend</button>
        <Toggle on={el.flipx} label="Flip left-right" onClick={() => set({ flipx: !el.flipx })}><FlipHorizontal2 size={16} /></Toggle>
        <Toggle on={el.flipy} label="Flip up-down" onClick={() => set({ flipy: !el.flipy })}><FlipVertical2 size={16} /></Toggle>
      </div>
      <small className="field__note">Drag the round handles to stretch it. A line is not glued to other shapes, so if you move a shape, move its arrow too.</small>
    </Section>
  );
}


const TOKENS = [["ink", "Text"], ["accent", "Accent"], ["panel", "Strong"], ["soft", "Soft"], ["paper", "White"]];

function ColorField({ label, value, onChange, allowNone, theme }) {
  const t = THEMES[theme] || THEMES.rani;
  const css = { ink: t.ink, accent: t.accent, panel: t.panel, soft: t.soft, paper: "#fff" };
  const isHex = typeof value === "string" && value.startsWith("#");
  return (
    <div className="field"><span>{label}</span>
      <div className="colors" role="group" aria-label={label}>
        {allowNone && <button className="color color--none" aria-pressed={value === "none" || !value} title="None" aria-label={`${label}: none`} onClick={() => onChange("none")} />}
        {TOKENS.map(([id, name]) => (
          <button key={id} className="color" style={{ background: css[id] }} aria-pressed={value === id} title={`${name} (follows the theme)`} aria-label={`${label}: ${name}`} onClick={() => onChange(id)} />
        ))}
        <label className={`color color--custom ${isHex ? "is-on" : ""}`} title="Pick any colour">
          <input type="color" value={isHex ? value : "#e85d9e"} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: custom colour`} />
        </label>
      </div>
    </div>
  );
}

// Collapsible group. Native <details>, so it is keyboard and screen-reader friendly with no extra code.
function Section({ title, defaultOpen = false, children }) {
  return (
    <details className="insp-sec" open={defaultOpen}>
      <summary><span>{title}</span><ChevronDown size={16} aria-hidden="true" /></summary>
      <div className="insp-sec__body">{children}</div>
    </details>
  );
}

function Num({ label, value, onChange, min, max, step = 1 }) {
  return (
    <label className="num"><span>{label}</span>
      <input type="number" value={Math.round(value * 10) / 10} min={min} max={max} step={step} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v))); }} />
    </label>
  );
}

function Toggle({ on, onClick, label, children }) {
  return <button className="tg" aria-pressed={!!on} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

export function ElementInspector({ el, theme, change, remove, duplicate, reorder, pickImage, me }) {
  const set = (f, key) => change(el.id, f, key);
  const byOther = !!el.updatedBy && el.updatedBy !== me;
  return (
    <div className="inspector__pane">
      <div className="insp-head">
        <strong>{TYPE_NAME[el.type] || "Element"}</strong>
        <span className="insp-actions">
          <button className="icon-btn" onClick={() => reorder(el, "front")} aria-label="Bring to front" title="Bring to front"><BringToFront size={16} /></button>
          <button className="icon-btn" onClick={() => reorder(el, "forward")} aria-label="Bring forward" title="Bring forward"><ArrowUp size={16} /></button>
          <button className="icon-btn" onClick={() => reorder(el, "backward")} aria-label="Send backward" title="Send backward"><ArrowDown size={16} /></button>
          <button className="icon-btn" onClick={() => reorder(el, "back")} aria-label="Send to back" title="Send to back"><SendToBack size={16} /></button>
          <button className="icon-btn" onClick={() => duplicate(el)} aria-label="Duplicate element" title="Duplicate (Ctrl+D)"><Copy size={16} /></button>
          <button className="icon-btn" onClick={() => remove(el)} aria-label="Delete element" title="Delete"><Trash2 size={16} /></button>
        </span>
      </div>

      {el.type === "text" && (
        <>
          <Section title="Text" defaultOpen>
          <Field label="Text" multiline rows={5} remote={el.text} who={el.updatedBy} byOther={byOther} max={4000} onCommit={(v) => set({ text: v }, `text:${el.id}`)} hint="Double-click the text on the slide to type there instead." />
          <div className="field"><span>Font</span>
            <select value={el.font || "Figtree"} onChange={(e) => set({ font: e.target.value })}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
          </div>
          <div className="row">
            <div className="stepper"><button className="icon-btn" aria-label="Smaller text" onClick={() => set({ size: Math.max(8, (el.size || 28) - 2) }, `size:${el.id}`)}><Minus size={14} /></button>
              <input aria-label="Font size" type="number" min="8" max="200" value={el.size || 28} onChange={(e) => { const v = Number(e.target.value); if (v >= 8 && v <= 200) set({ size: v }, `size:${el.id}`); }} />
              <button className="icon-btn" aria-label="Bigger text" onClick={() => set({ size: Math.min(200, (el.size || 28) + 2) }, `size:${el.id}`)}><Plus size={14} /></button></div>
            <Toggle on={el.bold} label="Bold" onClick={() => set({ bold: !el.bold })}><Bold size={16} /></Toggle>
            <Toggle on={el.italic} label="Italic" onClick={() => set({ italic: !el.italic })}><Italic size={16} /></Toggle>
            <Toggle on={el.underline} label="Underline" onClick={() => set({ underline: !el.underline })}><Underline size={16} /></Toggle>
          </div>
          <div className="row">
            {[["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight], ["justify", AlignJustify]].map(([a, I]) => (
              <Toggle key={a} on={(el.align || "left") === a} label={`Align ${a}`} onClick={() => set({ align: a })}><I size={16} /></Toggle>
            ))}
            <Toggle on={el.list === "bullet"} label="Bulleted list (one line per bullet)" onClick={() => set({ list: el.list === "bullet" ? "none" : "bullet" })}><List size={16} /></Toggle>
            <Toggle on={el.list === "number"} label="Numbered list (one line per number)" onClick={() => set({ list: el.list === "number" ? "none" : "number" })}><ListOrdered size={16} /></Toggle>
          </div>
          <ColorField label="Text colour" value={el.color || "ink"} theme={theme} onChange={(c) => set({ color: c })} />
          </Section>
          <Section title="Spacing and box">
          <div className="row row--nums">
            <Num label="Line spacing" value={el.lh || 1.3} min={0.8} max={3} step={0.1} onChange={(v) => set({ lh: v }, `lh:${el.id}`)} />
            <Num label="Letter spacing" value={el.ls || 0} min={-5} max={30} step={0.5} onChange={(v) => set({ ls: v }, `ls:${el.id}`)} />
          </div>
          <ColorField label="Box background" value={el.bg || "none"} allowNone theme={theme} onChange={(c) => set({ bg: c })} />
          <ColorField label="Box border" value={el.bc || "accent"} theme={theme} onChange={(c) => set({ bc: c, bw: el.bw || 3 })} />
          <Num label="Border thickness" value={el.bw || 0} min={0} max={20} onChange={(v) => set({ bw: v }, `bw:${el.id}`)} />
          </Section>
        </>
      )}

      {el.type === "shape" && (
        <>
          <Section title="Shape" defaultOpen>
          <div className="field"><span>Shape</span>
            <select value={el.shape || "rect"} onChange={(e) => set({ shape: e.target.value })}>
              {SHAPES.map((s) => <option key={s} value={s}>{({ rect: "Rectangle", round: "Rounded rectangle", ellipse: "Circle / ellipse", line: "Line", arrow: "Arrow", divider: "Divider", blob: "Soft accent blob", diamond: "Diamond (decision)", chevron: "Chevron (step)" })[s]}</option>)}
            </select>
          </div>
          <ColorField label="Fill" value={el.fill || "accent"} allowNone theme={theme} onChange={(c) => set({ fill: c })} />
          <ColorField label="Outline" value={el.stroke || "none"} allowNone theme={theme} onChange={(c) => set({ stroke: c, sw: el.sw || 3 })} />
          <div className="row row--nums">
            <Field label="Label inside the shape" multiline rows={2} remote={el.text || ""} who={el.updatedBy} byOther={byOther} max={200} onCommit={(v) => set({ text: v }, `text:${el.id}`)} hint="Handy for flowcharts. Leave empty for a plain shape." />
          <div className="row row--nums">
            <Num label="Label size" value={el.size || 24} min={8} max={80} onChange={(v) => set({ size: v }, `size:${el.id}`)} />
          </div>
          <ColorField label="Label colour" value={el.color || "paper"} theme={theme} onChange={(c) => set({ color: c })} />
          <Num label="Outline thickness" value={el.sw || 0} min={0} max={40} onChange={(v) => set({ sw: v }, `sw:${el.id}`)} />
            <Num label="Opacity (0–1)" value={el.op ?? 1} min={0} max={1} step={0.05} onChange={(v) => set({ op: v }, `op:${el.id}`)} />
          </div>
          </Section>
        </>
      )}

      {el.type === "chart" && <ChartSection el={el} set={set} theme={theme} />}
      {el.type === "table" && <TableSection el={el} set={set} theme={theme} />}
      {el.type === "connector" && <ConnectorSection el={el} set={set} theme={theme} />}

      {el.type === "image" && (
        <>
          <Section title="Picture" defaultOpen>
          {el.src && <div className="img-preview"><img src={el.src} alt={el.alt || "Selected picture preview"} crossOrigin="anonymous" /></div>}
          <div className="row">
            <button className="btn btn--soft btn--small" onClick={() => pickImage(el)}><ImagePlus size={15} aria-hidden="true" /> {el.src ? "Replace image" : "Choose image"}</button>
            {el.src && <button className="btn btn--ghost btn--small" onClick={() => set({ src: "" })}><ImageOff size={15} aria-hidden="true" /> Remove image</button>}
          </div>
          <Field label="Alt text (for screen readers)" remote={el.alt} who={el.updatedBy} byOther={byOther} max={300} onCommit={(v) => set({ alt: v }, `alt:${el.id}`)} />
          <div className="field"><span>Fit</span>
            <div className="chips">{[["contain", "Contain (whole picture)"], ["cover", "Cover (fill the box)"]].map(([id, l]) => <button key={id} className="chip" aria-pressed={(el.fit || "contain") === id} onClick={() => set({ fit: id })}>{l}</button>)}</div>
          </div>
          </Section>
        </>
      )}

      <Section title="Position and size">
        <div className="field"><span>Align on the slide</span>
          <div className="row" role="group" aria-label="Align on the slide">
            {[["left", AlignHorizontalJustifyStart, "Align to the left edge"], ["center", AlignHorizontalJustifyCenter, "Center horizontally"], ["right", AlignHorizontalJustifyEnd, "Align to the right edge"],
              ["top", AlignVerticalJustifyStart, "Align to the top"], ["middle", AlignVerticalJustifyCenter, "Center vertically"], ["bottom", AlignVerticalJustifyEnd, "Align to the bottom"]].map(([how, I, label]) => (
              <button key={how} className="tg" title={label} aria-label={label} onClick={() => set(alignPatch(el, how))}><I size={16} /></button>
            ))}
          </div>
        </div>
        <div className="row row--nums row--4">
          <Num label="X" value={el.x} min={-200} max={950} onChange={(v) => set({ x: v }, `pos:${el.id}`)} />
          <Num label="Y" value={el.y} min={-200} max={530} onChange={(v) => set({ y: v }, `pos:${el.id}`)} />
          <Num label="W" value={el.w} min={8} max={1200} onChange={(v) => set({ w: v }, `pos:${el.id}`)} />
          <Num label="H" value={el.h} min={2} max={700} onChange={(v) => set({ h: v }, `pos:${el.id}`)} />
        </div>
      </Section>
    </div>
  );
}
