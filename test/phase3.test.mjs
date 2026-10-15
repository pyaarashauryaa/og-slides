// Phase 3 tests: charts, tables, connectors, templates, alignment and undo/redo of the new edits.
// SIMULATED data model only: a local reducer, no browser, no CometChat.
// (Real canvas drawing for PNG/PDF/ZIP is checked in a browser, see README.)
import test from "node:test";
import assert from "node:assert/strict";
import { initialState, applyOp } from "../src/workspace/reducer.js";
import { selectElements } from "../src/workspace/selectors.js";
import { sanitizeFields, cleanTable } from "../src/workspace/model.js";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "../src/slides/templates.js";
import * as eops from "../src/slides/editorOps.js";
import { createHistory } from "../src/slides/history.js";
import { parseChartData, chartIssues, chartPrimitives, connectorPoints, connectorPrimitives, parseTable, columnShares, tableOverflow, niceCeil } from "../src/slides/vector.js";
import { CHART_SPECS, TABLE_SPEC, CONNECTOR_SPECS, tableSetCell, tableAddRow, tableRemoveRow, tableAddCol, tableRemoveCol, tableSetColWidth, alignPatch } from "../src/slides/newElements.js";

function local() {
  let state = initialState(), seq = 0;
  const api = {
    get state() { return state; },
    commit(list) { state = applyOp(state, { seq: ++seq, sentAt: 1000 + seq, by: { uid: "me", name: "Me" }, payload: { v: 1, ops: list } }); },
  };
  api.history = createHistory({ getState: () => state, commit: (l) => api.commit(l), coalesceMs: 0 });
  return api;
}
const seed = (l, spec) => {
  l.commit([{ t: "set", k: "deck", id: "d1", f: { title: "D", theme: "rani" } }, { t: "set", k: "slide", id: "s1", f: { deckId: "d1", mode: "free", pos: 1, title: "t" } }]);
  const a = eops.addElementOps(l.state, "s1", spec);
  l.commit(a.ops);
  return a.id;
};
const get = (l, id) => selectElements(l.state, "s1").find((e) => e.id === id);

// ---------- charts ----------
test("chart data: parses, flags bad rows, keeps commas inside labels", () => {
  const { rows } = parseChartData("Q1, 10\nSales, east, 25.5\nBroken\nX, abc\n\nNeg, -4");
  assert.deepEqual(rows.map((r) => [r.label, r.value, r.ok]), [["Q1", 10, true], ["Sales, east", 25.5, true], ["Broken", 0, false], ["X", 0, false], ["Neg", -4, true]]);
  assert.match(rows[2].issue, /number/);
  assert.match(rows[3].issue, /not a number/);
});
test("chart data: caps rows, rejects huge numbers, reports plain-English issues", () => {
  const many = Array.from({ length: 20 }, (_, i) => `R${i}, ${i}`).join("\n");
  assert.equal(parseChartData(many).rows.length, 12);
  assert.equal(parseChartData("A, 1e12").rows[0].ok, false);
  assert.ok(chartIssues({ ctype: "bar", cdata: "" }).some((m) => /Add at least one row/.test(m)));
  assert.ok(chartIssues({ ctype: "pie", cdata: "A, -3\nB, 5" }).some((m) => /negative/.test(m)));
  assert.ok(chartIssues({ ctype: "pie", cdata: "A, 0" }).some((m) => /above zero/.test(m)));
  assert.deepEqual(chartIssues({ ctype: "bar", cdata: "A, 1\nB, 2" }), []);
});
test("chart drawing: bars follow the values, and a changed value changes the picture", () => {
  const base = { ...CHART_SPECS.bar.spec, cdata: "A, 10\nB, 20", ctitle: "" };
  const bars = (c) => chartPrimitives(c, "rani").filter((p) => p.k === "rect");
  const [a, b] = bars(base);
  assert.ok(b.h > a.h * 1.8 && b.h < a.h * 2.2, "bar B is about twice as tall as bar A");
  const [a2, b2] = bars({ ...base, cdata: "A, 10\nB, 40" });
  assert.ok(b2.h / a2.h > 3.5 && b2.h / a2.h < 4.5, "updating the value changes the bar (the axis rescales, so compare against bar A)");
  const neg = chartPrimitives({ ...base, cdata: "A, -10\nB, 20" }, "rani").filter((p) => p.k === "rect");
  assert.ok(neg[0].y >= neg[1].y, "a negative bar hangs below the zero line");
  assert.ok(chartPrimitives(base, "rani").every((p) => p.k !== "rect" || (p.x >= 0 && p.x + p.w <= base.w && p.y >= 0 && p.y + p.h <= base.h)));
});
test("chart drawing: line, pie, doughnut, empty and single-slice cases", () => {
  const line = chartPrimitives({ ...CHART_SPECS.line.spec }, "rani");
  assert.equal(line.filter((p) => p.k === "circle").length, 5);
  assert.ok(line.some((p) => p.k === "poly" && p.pts.length === 5));
  const pie = chartPrimitives({ ...CHART_SPECS.pie.spec, cdata: "A, 1\nB, 1\nC, -5\nD, bad" }, "rani");
  assert.equal(pie.filter((p) => p.k === "wedge").length, 2, "negative and invalid slices are skipped");
  const dn = chartPrimitives({ ...CHART_SPECS.doughnut.spec }, "rani").filter((p) => p.k === "wedge");
  assert.ok(dn.every((w) => w.r0 > 0));
  const one = chartPrimitives({ ...CHART_SPECS.pie.spec, cdata: "Only, 7" }, "rani").filter((p) => p.k === "wedge");
  assert.equal(one.length, 2, "a full circle is drawn as two halves");
  for (const t of ["bar", "line", "pie"]) assert.ok(chartPrimitives({ ...CHART_SPECS[t].spec, cdata: "" }, "rani").some((p) => p.k === "text" && /Add data/.test(p.t)));
  assert.equal(niceCeil(37), 50); assert.equal(niceCeil(0.3), 0.5); assert.equal(niceCeil(1000), 1000);
});
test("chart fields are validated by the shared model", () => {
  const c = sanitizeFields("el", { type: "chart", ctype: "radar", cpal: "neon", cdata: "A, 1", ctitle: "T", cval: "yes", x: 0, y: 0, w: 300, h: 200 });
  assert.equal(c.ctype, undefined); assert.equal(c.cpal, undefined); assert.equal(c.cval, undefined);
  assert.equal(c.cdata, "A, 1"); assert.equal(c.type, "chart");
  assert.equal(sanitizeFields("el", { type: "hologram" }).type, undefined);
  assert.equal(sanitizeFields("el", { cdata: "x".repeat(5000) }).cdata.length, 2000, "over-long chart text is cut, not trusted");
});

// ---------- tables ----------
test("table data: rebuilt into a tidy rectangle, limited in size, junk rejected", () => {
  assert.deepEqual(JSON.parse(cleanTable('[["a","b"],["c"]]')), [["a", "b"], ["c", ""]]);
  const big = JSON.stringify(Array.from({ length: 30 }, () => Array.from({ length: 20 }, () => "x".repeat(300))));
  assert.equal(cleanTable(big), undefined, "oversized payload is rejected");
  const trimmed = JSON.parse(cleanTable(JSON.stringify(Array.from({ length: 30 }, () => Array.from({ length: 20 }, () => "z")))));
  assert.equal(trimmed.length, 12); assert.equal(trimmed[0].length, 8);
  assert.equal(JSON.parse(cleanTable(JSON.stringify([["x".repeat(500)]])))[0][0].length, 120);
  assert.equal(cleanTable("not json"), undefined); assert.equal(cleanTable("[]"), undefined);
  assert.equal(sanitizeFields("el", { tcw: "1,abc" }).tcw, undefined);
  assert.equal(sanitizeFields("el", { tcw: "1,2.5" }).tcw, "1,2.5");
});
test("table editing helpers: cells, rows, columns, widths and limits", () => {
  let el = { ...TABLE_SPEC };
  const cell = (e, r, c) => parseTable(e)[r][c];
  el = { ...el, ...tableSetCell(el, 1, 1, "Hello") };
  assert.equal(cell(el, 1, 1), "Hello");
  const rows0 = parseTable(el).length;
  el = { ...el, ...tableAddRow(el) };
  assert.equal(parseTable(el).length, rows0 + 1);
  assert.ok(el.h > TABLE_SPEC.h, "adding a row makes the table taller");
  el = { ...el, ...tableRemoveRow(el, 1) };
  assert.equal(parseTable(el).length, rows0);
  el = { ...el, ...tableAddCol(el) };
  assert.equal(parseTable(el)[0].length, 4); assert.equal(columnShares(el, 4).length, 4);
  el = { ...el, ...tableRemoveCol(el, 0) };
  assert.equal(parseTable(el)[0].length, 3);
  const shares = columnShares({ ...el, ...tableSetColWidth(el, 0, 3) }, 3);
  assert.ok(shares[0] > shares[1] * 2.5);
  assert.deepEqual(tableRemoveRow({ ...el, tdata: JSON.stringify([["only"]]) }, 0), {}, "the last row can't be removed");
  assert.deepEqual(tableRemoveCol({ ...el, tdata: JSON.stringify([["only"]]) }, 0), {});
  let full = { ...el, tdata: JSON.stringify(Array.from({ length: 12 }, () => ["a", "b"])) };
  assert.deepEqual(tableAddRow(full), {});
  full = { ...el, tdata: JSON.stringify([Array(8).fill("a")]) };
  assert.deepEqual(tableAddCol(full), {});
});
test("table overflow warning notices long text", () => {
  assert.equal(tableOverflow(TABLE_SPEC), 0);
  const long = { ...TABLE_SPEC, tdata: JSON.stringify([["H", "H"], ["A very long sentence that cannot possibly fit in a tiny cell on this slide, no matter what", "ok"]]), h: 80 };
  assert.ok(tableOverflow(long) >= 1);
});

// ---------- connectors ----------
test("connector geometry: flat, tall, diagonal, flipped and elbow", () => {
  assert.deepEqual(connectorPoints({ w: 300, h: 2 }), [[0, 1], [300, 1]]);
  assert.deepEqual(connectorPoints({ w: 8, h: 100 }), [[4, 0], [4, 100]]);
  assert.deepEqual(connectorPoints({ w: 100, h: 50 }), [[0, 0], [100, 50]]);
  assert.deepEqual(connectorPoints({ w: 100, h: 50, flipy: true }), [[0, 50], [100, 0]]);
  assert.deepEqual(connectorPoints({ w: 100, h: 50, curve: "elbow" }), [[0, 0], [50, 0], [50, 50], [100, 50]]);
});
test("connector drawing: arrowheads, dashes and colour", () => {
  const base = { ...CONNECTOR_SPECS.arrow.spec };
  const p = connectorPrimitives(base, "rani");
  assert.equal(p[0].k, "poly"); assert.ok(p.length === 2, "line plus one open arrowhead");
  assert.equal(connectorPrimitives({ ...base, ah: "none" }, "rani").length, 1);
  assert.equal(connectorPrimitives({ ...base, at: "arrow" }, "rani").length, 3);
  assert.equal(connectorPrimitives({ ...base, ah: "triangle" }, "rani")[1].close, true);
  assert.equal(connectorPrimitives({ ...base, ah: "dot" }, "rani")[1].k, "circle");
  assert.ok(connectorPrimitives({ ...base, dash: true }, "rani")[0].dash);
  assert.equal(connectorPrimitives({ ...base, stroke: "#112233" }, "rani")[0].stroke, "#112233");
});

// ---------- templates ----------
test("every template has a category and builds elements that all survive validation", () => {
  const cats = new Set(TEMPLATE_CATEGORIES.map((c) => c.id));
  const ids = new Set();
  for (const t of TEMPLATES) {
    assert.ok(cats.has(t.cat), `${t.id} needs a valid category`);
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`); ids.add(t.id);
    for (const spec of t.build()) {
      const clean = sanitizeFields("el", { ...spec, slideId: "s1", z: 1 });
      for (const k of Object.keys(spec)) assert.ok(k in clean, `${t.id}: "${k}" was rejected`);
      assert.ok(spec.x + spec.w > 0 && spec.x < 960 && spec.y + spec.h > 0 && spec.y < 540, `${t.id}: element off the slide`);
    }
  }
  for (const id of ["pitch", "market", "model", "features", "casestudy", "competition", "kpi", "financials", "beforeafter", "swot", "roadmap", "flowchart", "problem", "timeline", "process", "milestones", "team", "closing"]) assert.ok(ids.has(id), `missing template ${id}`);
});
test("a slide made from each new template reopens with its charts, tables and arrows intact", () => {
  for (const t of TEMPLATES) {
    const l = local();
    l.commit([{ t: "set", k: "deck", id: "d1", f: { title: "D", theme: "rani" } }]);
    const made = eops.newSlideFromTemplate(l.state, "d1", null, t.id);
    // pretend it travels over the network and is replayed from JSON
    l.commit(JSON.parse(JSON.stringify(made.ops)));
    const els = selectElements(l.state, made.slideId);
    assert.equal(els.length, t.build().length, t.id);
    for (const e of els.filter((x) => x.type === "chart")) assert.ok(parseChartData(e.cdata).rows.length > 0);
    for (const e of els.filter((x) => x.type === "table")) assert.ok(parseTable(e).length >= 2);
  }
});

// ---------- editing: undo / redo / duplicate / align ----------
test("undo and redo for chart data, table cells and connector style", () => {
  const l = local();
  const chart = seed(l, { ...CHART_SPECS.bar.spec });
  const before = get(l, chart).cdata;
  l.history.run([{ t: "set", k: "el", id: chart, f: { cdata: "A, 5\nB, 9" } }]);
  assert.equal(get(l, chart).cdata, "A, 5\nB, 9");
  l.history.undo(); assert.equal(get(l, chart).cdata, before);
  l.history.redo(); assert.equal(get(l, chart).cdata, "A, 5\nB, 9");
  l.history.run([{ t: "set", k: "el", id: chart, f: { ctype: "pie" } }]); l.history.undo();
  assert.equal(get(l, chart).ctype, "bar");

  const tb = (() => { const a = eops.addElementOps(l.state, "s1", { ...TABLE_SPEC }); l.commit(a.ops); return a.id; })();
  const patch = tableSetCell(get(l, tb), 1, 0, "Edited");
  l.history.run([{ t: "set", k: "el", id: tb, f: patch }]);
  assert.equal(parseTable(get(l, tb))[1][0], "Edited");
  l.history.undo(); assert.equal(parseTable(get(l, tb))[1][0], "Seats");
  l.history.run([{ t: "set", k: "el", id: tb, f: tableAddRow(get(l, tb)) }]); l.history.undo();
  assert.equal(parseTable(get(l, tb)).length, 4);

  const cn = (() => { const a = eops.addElementOps(l.state, "s1", { ...CONNECTOR_SPECS.arrow.spec }); l.commit(a.ops); return a.id; })();
  l.history.run([{ t: "set", k: "el", id: cn, f: { ah: "dot", sw: 9, dash: true } }]); l.history.undo();
  assert.equal(get(l, cn).ah, "arrow"); assert.equal(get(l, cn).sw, 4);
});
test("deleting and undoing a chart brings it back; duplicate copies the new fields", () => {
  const l = local();
  const chart = seed(l, { ...CHART_SPECS.line.spec });
  const dup = eops.duplicateElementOps(l.state, get(l, chart));
  l.commit(dup.ops);
  const copy = get(l, dup.id);
  assert.equal(copy.cdata, get(l, chart).cdata); assert.equal(copy.ctype, "line"); assert.equal(copy.ctitle, get(l, chart).ctitle);
  l.history.run([{ t: "del", k: "el", id: chart }]);
  assert.equal(get(l, chart), undefined);
  l.history.undo();
  const back = selectElements(l.state, "s1").filter((e) => e.type === "chart");
  assert.equal(back.length, 2);
  assert.ok(back.every((e) => e.cdata));
});
test("align helper puts items on the edges and centre of the slide", () => {
  const el = { x: 100, y: 100, w: 200, h: 100 };
  assert.deepEqual(alignPatch(el, "left"), { x: 0 });
  assert.deepEqual(alignPatch(el, "center"), { x: 380 });
  assert.deepEqual(alignPatch(el, "right"), { x: 760 });
  assert.deepEqual(alignPatch(el, "top"), { y: 0 });
  assert.deepEqual(alignPatch(el, "middle"), { y: 220 });
  assert.deepEqual(alignPatch(el, "bottom"), { y: 440 });
  assert.deepEqual(alignPatch(el, "nonsense"), {});
});
test("old shape and text elements still validate exactly as before", () => {
  const old = { type: "shape", shape: "arrow", x: 10, y: 20, w: 300, h: 40, fill: "none", stroke: "ink", sw: 5, op: 1 };
  const clean = sanitizeFields("el", old);
  for (const k of Object.keys(old)) assert.deepEqual(clean[k], old[k]);
  assert.equal(sanitizeFields("el", { type: "text", text: "hi", size: 30 }).size, 30);
});
