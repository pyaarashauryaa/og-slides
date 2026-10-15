import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowUp, ArrowDown, Copy, Trash2, Plus, Play, Pencil, TriangleAlert, Check, CloudOff, LoaderCircle, MessageCircleHeart,
  SlidersHorizontal, Link2, Users, Undo2, Redo2, Type, Square, Circle, Minus, MoveRight, ImagePlus, Shapes, Download, LayoutTemplate, StickyNote, Palette, Wand2,
  Clapperboard, Layers, BringToFront, SendToBack, ChevronUp, ChevronDown, ChartColumn, Table2, Spline, Grid3x3, Keyboard,
} from "lucide-react";
import { useWorkspace } from "../workspace/WorkspaceProvider.jsx";
import { selectDeck, selectSlides, selectElements } from "../workspace/selectors.js";
import { LAYOUTS, THEME_IDS } from "../workspace/model.js";
import SlideView from "./SlideView.jsx";
import PresentMode from "./PresentMode.jsx";
import Canvas from "./Canvas.jsx";
import Field from "./Field.jsx";
import { ElementInspector } from "./Inspector.jsx";
import TemplatePicker from "./TemplatePicker.jsx";
import LinkedPanel from "./LinkedPanel.jsx";
import { THEMES } from "./themes.js";
import { RenameDialog } from "./DeckGrid.jsx";
import Modal, { ConfirmDialog } from "../ui/Modal.jsx";
import { CHART_SPECS, TABLE_SPEC, CONNECTOR_SPECS } from "./newElements.js";
import EmptyState from "../ui/EmptyState.jsx";
import Dropdown, { MenuItem } from "../ui/Dropdown.jsx";
import CollabBar from "../components/CollabBar.jsx";
import SlideCursors from "./SlideCursors.jsx";
import { assignColors } from "../workspace/cursors.js";
import { useToast } from "../ui/Toast.jsx";
import TeamChatPanel from "../components/TeamChatPanel.jsx";
import { createHistory } from "./history.js";
import * as eops from "./editorOps.js";
import { checkImageFile, prepareImage } from "./imageTools.js";
import { exportPdf, exportPng, exportZip } from "../export/index.js";
import { explainError } from "../cometchat/explainError.js";

// Save state, announced politely to screen readers. It shows only what the sync engine really reports.
export function SaveStatus({ snap, onRetry }) {
  const s = snap.saveState;
  let inner;
  if (s === "failed") inner = <button className="save save--bad" onClick={onRetry}><TriangleAlert size={15} aria-hidden="true" /> <span className="save__text">Not saved. Retry</span></button>;
  else if (s === "offline") inner = <span className="save save--warn"><CloudOff size={15} aria-hidden="true" /> <span className="save__text">Offline, {snap.pending} change{snap.pending === 1 ? "" : "s"} waiting</span></span>;
  else if (s === "saving") inner = <span className="save"><LoaderCircle size={15} className="spin" aria-hidden="true" /> <span className="save__text">Saving…</span></span>;
  else inner = <span className="save save--ok" title="Saved for everyone"><Check size={15} aria-hidden="true" className="save__tick" /> <span className="save__text">Saved!</span></span>;
  return <span className="save-live" role="status" aria-live="polite">{inner}</span>;
}

const Blank = () => <span style={{ display: "inline-block", width: 16 }} />; // keeps menu labels aligned when there is no tick
const TRANSITIONS = [["none", "None"], ["fade", "Fade"], ["slide", "Slide"], ["zoom", "Zoom"]];
const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl";

const SHAPE_SPECS = {
  rect: { label: "Rectangle", icon: Square, spec: { shape: "rect", x: 330, y: 180, w: 300, h: 180, fill: "accent", op: 1 } },
  round: { label: "Rounded rectangle", icon: Square, spec: { shape: "round", x: 330, y: 180, w: 300, h: 180, fill: "soft", op: 1 } },
  ellipse: { label: "Circle", icon: Circle, spec: { shape: "ellipse", x: 380, y: 170, w: 200, h: 200, fill: "panel", op: 1 } },
  line: { label: "Line", icon: Minus, spec: { shape: "line", x: 300, y: 270, w: 360, h: 20, fill: "none", stroke: "ink", sw: 5 } },
  arrow: { label: "Arrow", icon: MoveRight, spec: { shape: "arrow", x: 300, y: 255, w: 360, h: 50, fill: "none", stroke: "ink", sw: 5 } },
  divider: { label: "Divider", icon: Minus, spec: { shape: "divider", x: 240, y: 270, w: 480, h: 8, fill: "accent", op: 1 } },
  blob: { label: "Accent blob", icon: Circle, spec: { shape: "blob", x: 360, y: 150, w: 240, h: 240, fill: "soft", op: 0.8 } },
};
const SHORTCUTS = [
  ["Undo / redo your changes", `${MOD}+Z  /  ${MOD}+Shift+Z`],
  ["Move the selected item", "Arrow keys (Shift = bigger steps)"],
  ["Duplicate the selected item", `${MOD}+D`],
  ["Delete the selected item", "Delete or Backspace"],
  ["Edit text on the slide", "Double-click, or Enter"],
  ["Bring forward / send backward", "]  and  ["],
  ["Deselect", "Esc"],
  ["Snap to grid", "Grid button in the toolbar"],
  ["While presenting: next / back", "Arrow keys or Space"],
  ["While presenting: speaker notes", "N"],
  ["Show this list", "?"],
];
const TEXT_SPEC = { type: "text", text: "New text", x: 300, y: 220, w: 360, h: 90, font: "Figtree", size: 32, color: "ink", align: "left", list: "none", lh: 1.3 };

export default function Editor({ deckId, onBack }) {
  const { snap, actions, cursorApi } = useWorkspace();
  const toast = useToast();
  const deck = useMemo(() => selectDeck(snap.state, deckId), [snap.state, deckId]);
  const slides = useMemo(() => selectSlides(snap.state, deckId), [snap.state, deckId]);
  const [selId, setSelId] = useState(null);
  const [selEl, setSelEl] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [tab, setTab] = useState("design");
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [picker, setPicker] = useState(false);
  const [grid, setGrid] = useState(false);
  const [keys, setKeys] = useState(false);
  const [sheet, setSheet] = useState(false); // inspector as a bottom sheet on tablets and phones
  const [, bump] = useState(0);
  const fileRef = useRef(null);
  const fileTarget = useRef(null);

  const stateRef = useRef(snap.state);
  stateRef.current = snap.state;
  const hist = useMemo(() => (actions ? createHistory({ getState: () => stateRef.current, commit: actions.commit }) : null), [actions]);
  useEffect(() => (hist ? hist.subscribe(() => bump((n) => n + 1)) : undefined), [hist]);

  const sel = slides.find((s) => s.id === selId) || slides[0] || null;
  const selIndex = sel ? slides.findIndex((s) => s.id === sel.id) : -1;
  const free = sel?.mode === "free";
  const els = useMemo(() => (sel ? selectElements(snap.state, sel.id) : []), [snap.state, sel]);
  const el = els.find((e) => e.id === selEl) || null;

  useEffect(() => { actions.setFocus({ deckId, slideId: sel?.id || null, elId: selEl || null }); }, [actions, deckId, sel?.id, selEl]);
  useEffect(() => () => actions.setFocus({ deckId: null, slideId: null }), [actions]);
  useEffect(() => { setSelEl(null); setEditingId(null); }, [sel?.id]);

  const run = (ops, key) => hist.run(ops, { key });
  const say = (r) => {
    if (!r.done) return;
    if (r.skipped) toast("Some of that change was skipped because a teammate edited the same thing since.", "info");
  };
  const undo = () => say(hist.undo());
  const redo = () => say(hist.redo());

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Y), except while typing in a field (the browser handles those).
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) return;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) { setKeys((v) => !v); return; }
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hist]);

  if (!deck) {
    return (
      <div className="panel">
        <h2>This presentation isn't here anymore</h2>
        <p className="panel__lead">It may have been deleted by a teammate.</p>
        <div className="panel__actions"><button className="btn btn--primary" onClick={onBack}>Back to presentations</button></div>
      </div>
    );
  }

  const me = snap.self?.name;
  const byOther = (e) => Boolean(e?.updatedBy) && e.updatedBy !== me;
  const peers = snap.presence.filter((p) => p.deckId === deckId);
  const colors = assignColors([snap.self?.uid, ...peers.map((p) => p.uid)]); // same colours the slide cursors use
  const setOp = (k, id, f) => ({ t: "set", k, id, f });

  // ----- slide actions -----
  const addSlide = (tplId) => {
    const made = eops.newSlideFromTemplate(snap.state, deckId, sel?.id, tplId);
    run(made.ops);
    setSelId(made.slideId);
    setPicker(false);
  };
  const duplicateSlide = () => {
    const d = eops.duplicateSlideOps(snap.state, deckId, sel.id);
    if (!d) return;
    run(d.ops);
    setSelId(d.slideId);
  };
  const removeSlide = () => {
    const next = slides[selIndex + 1] || slides[selIndex - 1];
    run(eops.deleteSlideOps(snap.state, sel.id));
    setSelId(next ? next.id : null);
  };
  const moveSlide = (dir) => { const o = eops.moveSlideOps(snap.state, deckId, sel.id, dir); if (o) run(o); };

  // ----- element actions -----
  const ensureFree = () => (free ? [] : eops.convertToFree(snap.state, sel));
  const insert = (spec) => {
    if (!sel) return;
    const prefix = ensureFree();
    // the new element's z must sit above any elements created by the conversion
    const base = eops.addElementOps(snap.state, sel.id, spec, prefix.length);
    run([...prefix, ...base.ops]);
    setSelEl(base.id);
    setTab("design");
  };
  const changeEl = (id, f, key) => run([setOp("el", id, f)], key || undefined);
  const removeEl = (e) => { run([{ t: "del", k: "el", id: e.id }]); setSelEl(null); };
  const dupEl = (e) => { const d = eops.duplicateElementOps(snap.state, e); run(d.ops); setSelEl(d.id); };
  const reorder = (e, how) => run(eops.reorderOps(snap.state, e, how));

  // ----- images -----
  const pickImage = (target) => { fileTarget.current = target || null; fileRef.current?.click(); };
  const onFile = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    const target = fileTarget.current;
    const bad = checkImageFile(file);
    if (bad) { toast(bad, "error"); return; }
    toast("Uploading picture…", "info", 2500);
    try {
      const { blob, width, height } = await prepareImage(file);
      const upload = new File([blob], blob.type === "image/png" ? "slide-picture.png" : "slide-picture.jpg", { type: blob.type });
      const url = await actions.uploadImage(upload);
      if (target) { run([setOp("el", target.id, { src: url })]); }
      else {
        const ratio = width / height;
        let w = 560, h = w / ratio;
        if (h > 360) { h = 360; w = h * ratio; }
        insert({ type: "image", src: url, alt: "", fit: "contain", x: Math.round((960 - w) / 2), y: Math.round((540 - h) / 2), w: Math.round(w), h: Math.round(h) });
      }
      toast("Picture added.", "ok", 2500);
    } catch (e) {
      console.error("OGSlides image upload failed:", e);
      toast(`The picture could not be uploaded, so it was not added. ${explainError(e).friendly}`, "error", 8000);
    }
  };

  // ----- export -----
  const slidesWithEls = () => slides.map((s) => ({ ...s, els: selectElements(snap.state, s.id) }));
  const doExport = async (kind) => {
    try {
      toast("Preparing your file…", "info", 2000);
      const all = slidesWithEls();
      const r = kind === "pdf" ? await exportPdf(deck, all) : kind === "zip" ? await exportZip(deck, all) : await exportPng(deck, all[Math.max(0, selIndex)], selIndex + 1);
      toast(r.skippedImages ? `Downloaded ${r.filename}. ${r.skippedImages} picture(s) could not be included (the image host blocks being drawn into a file).` : `Downloaded ${r.filename}.`, r.skippedImages ? "info" : "ok", 7000);
    } catch (e) {
      console.error("OGSlides export failed:", e);
      toast(`Export failed: ${e.message || e}`, "error", 8000);
    }
  };

  return (
    <div className="editor">
      <header className="editor__head">
        <button className="icon-btn" onClick={onBack} aria-label="Back to presentations" title="Back to presentations"><ArrowLeft size={20} /></button>
        <button className="editor__title" onClick={() => setRenaming(true)} title="Rename presentation">
          {deck.title || "Untitled presentation"} <Pencil size={14} aria-hidden="true" />
        </button>
        <SaveStatus snap={snap} onRetry={actions.retry} />
        <span className="editor__spacer" />
        <CollabBar self={snap.self} peers={peers} colors={colors} focusSlideId={sel?.id} />
        <button className="btn btn--primary btn--small editor__present" aria-label="Present" onClick={() => setPresenting(true)} disabled={!slides.length} title="Present full screen. Arrow keys move, N shows notes, Esc exits.">
          <Play size={16} aria-hidden="true" /> <span>Present</span>
        </button>
      </header>

      <div className="toolbar" role="toolbar" aria-label="Editing tools">
        <div className="tb-group" role="group" aria-label="History" data-label="History">
          <button className="tb-btn" onClick={undo} disabled={!hist.canUndo()} title={`Undo (${MOD}+Z). Only undoes your own edits.`} aria-label="Undo"><Undo2 size={17} /></button>
          <button className="tb-btn" onClick={redo} disabled={!hist.canRedo()} title={`Redo (${MOD}+Shift+Z)`} aria-label="Redo"><Redo2 size={17} /></button>
        </div>
        <div className="tb-group" role="group" aria-label="Insert" data-label="Insert">
          <button className="tb-btn" onClick={() => insert(TEXT_SPEC)} disabled={!sel} title="Add a text box" aria-label="Text"><Type size={17} aria-hidden="true" /> <span>Text</span></button>
          <Dropdown label="Shapes" icon={Shapes} disabled={!sel} title="Insert a shape">
            {(close) => Object.entries(SHAPE_SPECS).map(([id, s]) => <MenuItem key={id} icon={s.icon} onClick={() => { insert({ type: "shape", ...s.spec }); close(); }}>{s.label}</MenuItem>)}
          </Dropdown>
          <Dropdown label="Chart" icon={ChartColumn} disabled={!sel} title="Insert a chart you can edit">
            {(close) => Object.entries(CHART_SPECS).map(([id, c]) => <MenuItem key={id} icon={ChartColumn} onClick={() => { insert(c.spec); close(); }}>{c.label}</MenuItem>)}
          </Dropdown>
          <button className="tb-btn" onClick={() => insert(TABLE_SPEC)} disabled={!sel} title="Insert a table you can edit" aria-label="Table"><Table2 size={17} aria-hidden="true" /> <span>Table</span></button>
          <Dropdown label="Arrows" icon={Spline} disabled={!sel} title="Insert an arrow or connector line">
            {(close) => Object.entries(CONNECTOR_SPECS).map(([id, c]) => <MenuItem key={id} icon={Spline} onClick={() => { insert(c.spec); close(); }}>{c.label}</MenuItem>)}
          </Dropdown>
          <button className="tb-btn" onClick={() => pickImage(null)} disabled={!sel} title="Add a picture from your device (PNG, JPEG or WebP)" aria-label="Image"><ImagePlus size={17} aria-hidden="true" /> <span>Image</span></button>
          <button className="tb-btn" onClick={() => setPicker(true)} title="Add a new slide from a layout" aria-label="Layouts"><LayoutTemplate size={17} aria-hidden="true" /> <span>Layouts</span></button>
        </div>
        <div className="tb-group" role="group" aria-label="Arrange" data-label="Arrange">
          <button className={`tb-btn ${grid ? "is-on" : ""}`} onClick={() => setGrid((g) => !g)} aria-pressed={grid} disabled={!free} title="Show a grid and snap items to it while you drag" aria-label="Snap to grid"><Grid3x3 size={17} aria-hidden="true" /> <span>Grid</span></button>
          <Dropdown label="Arrange" icon={Layers} disabled={!el || !free} title={el ? "Arrange the selected item" : "Select something on the slide to arrange it"}>
            {(close) => (
              <>
                <MenuItem icon={BringToFront} onClick={() => { close(); reorder(el, "front"); }}>Bring to front</MenuItem>
                <MenuItem icon={ArrowUp} onClick={() => { close(); reorder(el, "forward"); }}>Bring forward</MenuItem>
                <MenuItem icon={ArrowDown} onClick={() => { close(); reorder(el, "backward"); }}>Send backward</MenuItem>
                <MenuItem icon={SendToBack} onClick={() => { close(); reorder(el, "back"); }}>Send to back</MenuItem>
                <MenuItem icon={Copy} hint={`${MOD}+D`} onClick={() => { close(); dupEl(el); }}>Duplicate</MenuItem>
                <MenuItem icon={Trash2} hint="Del" onClick={() => { close(); removeEl(el); }}>Delete</MenuItem>
              </>
            )}
          </Dropdown>
        </div>
        <div className="tb-group" role="group" aria-label="Look and present" data-label="Look">
          <Dropdown label="Theme" icon={Palette} title="Change the colour theme of the whole presentation">
            {(close) => (
              <div className="dd__swatches">
                {THEME_IDS.map((t) => (
                  <button key={t} className="dd__theme" aria-pressed={deck.theme === t} onClick={() => { actions.setTheme(deckId, t); close(); }}>
                    <span className="swatch" style={{ background: THEMES[t].bg, boxShadow: `inset 0 0 0 4px ${THEMES[t].accent}` }} /> {THEMES[t].label}
                  </button>
                ))}
              </div>
            )}
          </Dropdown>
          <Dropdown label="Transition" icon={Clapperboard} title="How slides change while presenting (applies to the whole presentation)">
            {(close) => TRANSITIONS.map(([id, l]) => (
              <MenuItem key={id} icon={(deck.transition || "fade") === id ? Check : Blank} onClick={() => { close(); actions.commit([setOp("deck", deckId, { transition: id })]); }}>{l}</MenuItem>
            ))}
          </Dropdown>
          <button className={`tb-btn ${tab === "notes" ? "is-on" : ""}`} onClick={() => { setTab("notes"); setSheet(true); }} disabled={!sel} aria-pressed={tab === "notes"} title="Speaker notes for this slide" aria-label="Speaker notes">
            <StickyNote size={17} aria-hidden="true" /> <span>Notes</span>{sel?.notes ? <i className="tb-dot" aria-label="This slide has notes" /> : null}
          </button>
        </div>
        <span className="editor__spacer" />
        <button className="tb-btn" onClick={() => setKeys(true)} title="Keyboard shortcuts (press ?)" aria-label="Keyboard shortcuts"><Keyboard size={17} aria-hidden="true" /></button>
        <Dropdown label="Export" icon={Download} align="right" disabled={!slides.length} title="Download as PDF, PNG or ZIP">
          {(close) => (
            <>
              <MenuItem onClick={() => { close(); doExport("pdf"); }}>PDF, all slides</MenuItem>
              <MenuItem onClick={() => { close(); doExport("png"); }}>PNG, this slide</MenuItem>
              <MenuItem onClick={() => { close(); doExport("zip"); }}>ZIP of PNGs, all slides</MenuItem>
            </>
          )}
        </Dropdown>
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} aria-hidden="true" tabIndex={-1} />

      <div className="editor__body">
        <aside className="rail" aria-label="Slides">
          <div className="rail__list">
            {slides.map((s, i) => {
              const here = peers.filter((p) => p.slideId === s.id);
              return (
                <button key={s.id} className="rail__item" aria-current={sel?.id === s.id ? "true" : undefined} aria-label={`Slide ${i + 1}`} onClick={() => setSelId(s.id)}>
                  <span className="rail__num">{i + 1}</span>
                  <span className="rail__thumb" aria-hidden="true"><SlideView slide={s} theme={deck.theme} /></span>
                  {here.length > 0 && <span className="rail__here" title={here.map((p) => p.name).join(", ")}><Users size={11} /> {here.length}</span>}
                </button>
              );
            })}
          </div>
          <button className="btn btn--primary btn--small rail__add" onClick={() => setPicker(true)}>
            <Plus size={16} aria-hidden="true" /> Add slide
          </button>
        </aside>

        <section className="stage">
          {sel ? (
            <>
              <div className="stage__canvas" key={sel.id}>
                {free ? (
                  <Canvas slide={sel} els={els} theme={deck.theme} grid={grid} onReorder={reorder} selectedId={el?.id || null} onSelect={(id) => { setSelEl(id); if (id) setTab("design"); }}
                    onChange={changeEl} onDelete={removeEl} onDuplicate={dupEl} editingId={editingId} setEditingId={setEditingId} onPickImage={pickImage} />
                ) : (
                  <SlideView slide={sel} theme={deck.theme} />
                )}
                <SlideCursors api={cursorApi} deckId={deckId} slideId={sel.id} selfUid={snap.self?.uid} colors={colors} peers={peers} els={els} />
              </div>
              <div className="stage__tools">
                <button className="icon-btn" disabled={selIndex <= 0} onClick={() => moveSlide(-1)} aria-label="Move slide up" title="Move slide up"><ArrowUp size={17} /></button>
                <button className="icon-btn" disabled={selIndex >= slides.length - 1} onClick={() => moveSlide(1)} aria-label="Move slide down" title="Move slide down"><ArrowDown size={17} /></button>
                <button className="icon-btn" onClick={duplicateSlide} aria-label="Duplicate slide" title="Duplicate slide"><Copy size={17} /></button>
                <button className="icon-btn" onClick={removeSlide} aria-label="Delete slide" title="Delete slide"><Trash2 size={17} /></button>
                <span className="stage__count">Slide {selIndex + 1} of {slides.length}</span>
              </div>
            </>
          ) : (
            <EmptyState tone="rani" icon={LayoutTemplate} title="This presentation has no slides"
              action={<button className="btn btn--primary" onClick={() => setPicker(true)}><Plus size={18} aria-hidden="true" /> Add a slide</button>} />
          )}
        </section>

        <aside className={`inspector${sheet ? " inspector--open" : ""}`}>
          {/* On tablets and phones the inspector is a bottom sheet: this handle opens and closes it. */}
          <button className="inspector__handle" onClick={() => setSheet((o) => !o)} aria-expanded={sheet} aria-controls="inspector-body">
            {sheet ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}
            <span>{sheet ? "Hide panel" : el && free ? `${({ text: "Text box", image: "Image", shape: "Shape", chart: "Chart", table: "Table", connector: "Arrow" })[el.type] || "Item"} selected. Tap to edit` : "Edit, notes and chat"}</span>
          </button>
          <div className="tabs" role="tablist">
            {[["design", "Design", SlidersHorizontal], ["notes", "Notes", StickyNote], ["linked", "Linked", Link2], ["chat", "Chat", MessageCircleHeart]].map(([id, label, Icon]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setSheet(true); }} title={label}><Icon size={16} aria-hidden="true" /> <span>{label}</span></button>
            ))}
          </div>
          <div className="inspector__body" id="inspector-body">

          {tab === "design" && sel && el && free && (
            <ElementInspector key={el.id} el={el} theme={deck.theme} me={me} change={changeEl} remove={removeEl} duplicate={dupEl} reorder={reorder} pickImage={pickImage} />
          )}
          {tab === "design" && sel && !(el && free) && (
            <div className="inspector__pane" key={sel.id}>
              {free ? (
                <p className="hint-card"><Wand2 size={16} aria-hidden="true" /> Click anything on the slide to edit it. Drag to move, use the round handles to resize, double-click text to type. Arrow keys nudge (hold Shift for bigger steps).</p>
              ) : (
                <>
                  <p className="hint-card"><Wand2 size={16} aria-hidden="true" /> This is a classic slide. Convert it to free-form to drag, resize and style every piece.</p>
                  <button className="btn btn--soft btn--small" onClick={() => run(eops.convertToFree(snap.state, sel))}><Wand2 size={15} aria-hidden="true" /> Make it editable</button>
                  <Field label="Title" remote={sel.title} who={sel.updatedBy} byOther={byOther(sel)} max={300} onCommit={(v) => run([setOp("slide", sel.id, { title: v })], `st:${sel.id}`)} />
                  <Field label="Text" multiline remote={sel.body} who={sel.updatedBy} byOther={byOther(sel)} max={4000} hint={sel.layout === "bullets" ? "One line = one bullet." : undefined} onCommit={(v) => run([setOp("slide", sel.id, { body: v })], `sb:${sel.id}`)} />
                  <div className="field"><span>Classic layout</span>
                    <div className="chips">{LAYOUTS.map((l) => <button key={l.id} className="chip" aria-pressed={sel.layout === l.id} title={l.hint} onClick={() => run([setOp("slide", sel.id, { layout: l.id })])}>{l.label}</button>)}</div>
                  </div>
                </>
              )}
              <div className="field"><span>Theme (whole presentation)</span>
                <div className="swatches">
                  {THEME_IDS.map((t) => (
                    <button key={t} className="swatch" style={{ background: THEMES[t].bg, boxShadow: `inset 0 0 0 4px ${THEMES[t].accent}` }} aria-pressed={deck.theme === t} aria-label={THEMES[t].label} title={THEMES[t].label} onClick={() => actions.setTheme(deckId, t)} />
                  ))}
                </div>
              </div>
              <button className="btn btn--ghost btn--small inspector__del" onClick={() => setDeleting(true)}><Trash2 size={15} /> Delete presentation</button>
            </div>
          )}
          {tab === "design" && !sel && <p className="inspector__empty">Add a slide to start editing.</p>}

          {tab === "notes" && sel && (
            <div className="inspector__pane" key={sel.id}>
              <Field label="Speaker notes" multiline rows={12} remote={sel.notes || ""} who={sel.updatedBy} byOther={byOther(sel)} max={4000}
                hint="Only you and your team see these. They never appear on the slide, in exports, or on the audience screen. Press N while presenting to see them."
                onCommit={(v) => run([setOp("slide", sel.id, { notes: v })], `notes:${sel.id}`)} />
              {sel.notes && <button className="btn btn--ghost btn--small" onClick={() => run([setOp("slide", sel.id, { notes: "" })])}>Clear notes</button>}
            </div>
          )}
          {tab === "linked" && <LinkedPanel deckId={deckId} />}
          {tab === "chat" && <div className="inspector__chat"><TeamChatPanel /></div>}
          </div>
        </aside>
      </div>

      {keys && (
        <Modal title="Keyboard shortcuts" onClose={() => setKeys(false)}>
          <dl className="keylist">{SHORTCUTS.map(([a, b]) => <div key={a}><dt>{a}</dt><dd><kbd>{b}</kbd></dd></div>)}</dl>
        </Modal>
      )}
      {picker && <TemplatePicker theme={deck.theme} onPick={addSlide} onClose={() => setPicker(false)} />}
      {renaming && <RenameDialog initial={deck.title} onClose={() => setRenaming(false)} onSave={(t) => actions.renameDeck(deckId, t)} />}
      {deleting && <ConfirmDialog title="Delete this presentation?" text="It will be removed for everyone on the team." onClose={() => setDeleting(false)} onConfirm={() => { actions.deleteDeck(deckId); onBack(); }} />}
      {presenting && <PresentMode slides={slidesWithEls()} theme={deck.theme} transition={deck.transition || "fade"} onTransition={(t) => actions.commit([setOp("deck", deckId, { transition: t })])} startIndex={Math.max(0, selIndex)} onClose={() => setPresenting(false)} />}
    </div>
  );
}
