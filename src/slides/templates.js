// Slide templates. Each one builds a list of ELEMENTS on a 960 x 540 canvas.
// Colours are theme tokens ("ink", "accent", ...) so changing the theme recolours everything.
// To add a template, add one entry to TEMPLATES. Nothing else needs to change.
import { SLIDE_W as W, SLIDE_H as H } from "../workspace/model.js";
import { CHART_SPECS, TABLE_SPEC } from "./newElements.js";

const DISPLAY = "Bricolage Grotesque";
const text = (t, x, y, w, h, o = {}) => ({ type: "text", text: t, x, y, w, h, font: "Figtree", size: 28, color: "ink", align: "left", list: "none", lh: 1.3, ...o });
const title = (t, x, y, w, h, o = {}) => text(t, x, y, w, h, { font: DISPLAY, size: 52, bold: true, lh: 1.08, ...o });
const shape = (s, x, y, w, h, o = {}) => ({ type: "shape", shape: s, x, y, w, h, fill: "accent", stroke: "none", sw: 0, op: 1, ...o });
const blobs = () => [
  shape("blob", 640, -150, 420, 420, { fill: "soft", op: 0.8 }),
  shape("blob", -90, 400, 260, 260, { fill: "accent", op: 0.2 }),
];

export const TEMPLATE_CATEGORIES = [
  { id: "basics", label: "Basics" },
  { id: "pitch", label: "Startup pitch" },
  { id: "data", label: "Charts and tables" },
  { id: "plans", label: "Plans and diagrams" },
  { id: "people", label: "People and closing" },
];

const chart = (kind, o) => ({ ...CHART_SPECS[kind].spec, ...o });
const table = (rows, o) => ({ ...TABLE_SPEC, tdata: JSON.stringify(rows), ...o });
const arrow = (x, y, w, h, o = {}) => ({ type: "connector", x, y, w, h, stroke: "ink", sw: 4, ah: "arrow", at: "none", curve: "straight", ...o });
const kicker = (t, x, y, w = 600) => text(t, x, y, w, 34, { size: 20, bold: true, color: "accent", ls: 2 });

export const TEMPLATES = [
  { id: "cover", cat: "basics", label: "Title / Cover", hint: "Big title and a subtitle", build: () => [
    ...blobs(),
    title("Your big idea goes here", 80, 150, 800, 160, { size: 70, align: "center" }),
    text("A short line that sets the scene", 160, 320, 640, 60, { size: 30, align: "center", lh: 1.3 }),
  ] },
  { id: "bullets", cat: "basics", label: "Title and bullets", hint: "A heading with a list", build: () => [
    ...blobs(),
    title("What we will cover", 70, 50, 760, 80, { size: 46 }),
    text("First important point\nSecond important point\nThird important point", 70, 160, 780, 300, { size: 30, list: "bullet", lh: 1.5 }),
  ] },
  { id: "statement", cat: "basics", label: "Big idea", hint: "One bold sentence", build: () => [
    ...blobs(),
    shape("divider", 80, 150, 110, 12, { fill: "accent" }),
    title("One sentence that people will remember.", 80, 190, 780, 220, { size: 60 }),
  ] },
  { id: "split", cat: "basics", label: "Split", hint: "Title panel beside your text", build: () => [
    shape("rect", 0, 0, 400, H, { fill: "panel" }),
    title("A clear headline", 50, 150, 310, 240, { size: 46, color: "paper" }),
    text("Explain the point in a few short lines.\nKeep each line simple.\nLet the headline do the shouting.", 450, 150, 440, 260, { size: 26, lh: 1.5 }),
  ] },
  { id: "agenda", cat: "basics", label: "Agenda", hint: "A numbered list of topics", build: () => [
    shape("blob", 700, -120, 380, 380, { fill: "soft", op: 0.8 }),
    title("Agenda", 70, 50, 500, 80, { size: 46 }),
    text("Introduction\nThe problem\nOur solution\nDemo\nNext steps", 70, 160, 700, 320, { size: 30, list: "number", lh: 1.55 }),
  ] },
  { id: "problem", cat: "pitch", label: "Problem and solution", hint: "Two cards side by side", build: () => [
    title("Why this matters", 70, 40, 800, 70, { size: 42 }),
    shape("round", 60, 140, 400, 340, { fill: "paper", stroke: "soft", sw: 3 }),
    shape("round", 500, 140, 400, 340, { fill: "panel" }),
    text("The problem", 90, 165, 340, 50, { font: DISPLAY, bold: true, size: 30, color: "accent" }),
    text("Describe what hurts today and who feels it.", 90, 230, 340, 220, { size: 24, lh: 1.4 }),
    text("Our solution", 530, 165, 340, 50, { font: DISPLAY, bold: true, size: 30, color: "paper" }),
    text("Describe how your idea fixes it.", 530, 230, 340, 220, { size: 24, lh: 1.4, color: "paper" }),
  ] },
  { id: "compare", cat: "basics", label: "Two columns", hint: "Compare two things", build: () => [
    title("Option A or option B?", 70, 40, 800, 70, { size: 42 }),
    text("Option A", 70, 140, 380, 50, { font: DISPLAY, bold: true, size: 32, color: "accent" }),
    text("Pro one\nPro two\nPro three", 70, 200, 380, 260, { size: 26, list: "bullet", lh: 1.5 }),
    shape("divider", 478, 145, 4, 320, { fill: "soft" }),
    text("Option B", 510, 140, 380, 50, { font: DISPLAY, bold: true, size: 32, color: "accent" }),
    text("Pro one\nPro two\nPro three", 510, 200, 380, 260, { size: 26, list: "bullet", lh: 1.5 }),
  ] },
  { id: "image", cat: "basics", label: "Image with caption", hint: "A photo and a short caption", build: () => [
    { type: "image", src: "", alt: "", fit: "cover", x: 110, y: 40, w: 740, h: 380 },
    text("Describe what the picture shows", 110, 440, 740, 60, { size: 24, align: "center", italic: true }),
  ] },
  { id: "timeline", cat: "plans", label: "Timeline / roadmap", hint: "Four steps in time", build: () => {
    const xs = [90, 300, 510, 720];
    return [
      title("Roadmap", 70, 40, 700, 70, { size: 42 }),
      shape("divider", 90, 268, 790, 8, { fill: "soft" }),
      ...xs.flatMap((x, i) => [
        shape("ellipse", x, 245, 54, 54, { fill: "accent", stroke: "paper", sw: 5 }),
        text(["Q1", "Q2", "Q3", "Q4"][i], x - 40, 180, 134, 44, { font: DISPLAY, bold: true, size: 30, align: "center" }),
        text("What happens here", x - 50, 320, 154, 110, { size: 20, align: "center" }),
      ]),
    ];
  } },
  { id: "process", cat: "plans", label: "Process / workflow", hint: "Four steps with arrows", build: () => {
    const xs = [50, 280, 510, 740];
    return [
      title("How it works", 70, 40, 700, 70, { size: 42 }),
      ...xs.flatMap((x, i) => [
        shape("round", x, 190, 170, 170, { fill: i % 2 ? "panel" : "accent" }),
        text(String(i + 1), x, 205, 170, 60, { font: DISPLAY, bold: true, size: 44, align: "center", color: "paper" }),
        text("Step name", x + 10, 275, 150, 70, { size: 22, align: "center", color: "paper", bold: true }),
        ...(i < 3 ? [shape("arrow", x + 178, 265, 44, 30, { fill: "none", stroke: "ink", sw: 4 })] : []),
      ]),
      text("One sentence about the whole flow.", 70, 410, 820, 60, { size: 24, align: "center" }),
    ];
  } },
  { id: "stat", cat: "basics", label: "Big number", hint: "One number that matters", build: () => [
    ...blobs(),
    title("87%", 80, 120, 800, 220, { size: 190, align: "center", color: "accent" }),
    text("of teams say this is the thing they struggle with most", 160, 350, 640, 100, { size: 30, align: "center" }),
  ] },
  { id: "quote", cat: "basics", label: "Quote", hint: "A quote and who said it", build: () => [
    shape("blob", 60, 60, 150, 150, { fill: "soft", op: 0.9 }),
    title("“", 90, 40, 140, 160, { size: 160, color: "accent" }),
    text("The best way to predict the future is to build it together.", 150, 170, 680, 190, { font: DISPLAY, size: 44, italic: true, lh: 1.2 }),
    text("— Someone wise", 150, 390, 680, 50, { size: 26, color: "accent", bold: true }),
  ] },
  { id: "team", cat: "people", label: "Team introduction", hint: "Three people", build: () => {
    const xs = [100, 400, 700];
    return [
      title("Meet the team", 70, 40, 700, 70, { size: 42 }),
      ...xs.flatMap((x, i) => [
        shape("ellipse", x, 150, 160, 160, { fill: ["accent", "panel", "soft"][i] }),
        text(["Name one", "Name two", "Name three"][i], x - 30, 330, 220, 44, { font: DISPLAY, bold: true, size: 28, align: "center" }),
        text("Role or superpower", x - 30, 380, 220, 80, { size: 20, align: "center" }),
      ]),
    ];
  } },
  { id: "milestones", cat: "plans", label: "Milestones", hint: "Dated achievements", build: () => [
    title("Milestones", 70, 40, 700, 70, { size: 42 }),
    ...[0, 1, 2].flatMap((i) => [
      shape("ellipse", 80, 150 + i * 120, 70, 70, { fill: ["accent", "panel", "soft"][i] }),
      text(["Jan", "Mar", "Jun"][i], 80, 168 + i * 120, 70, 36, { font: DISPLAY, bold: true, size: 22, align: "center", color: i === 2 ? "ink" : "paper" }),
      text("Milestone name", 180, 150 + i * 120, 600, 40, { font: DISPLAY, bold: true, size: 30 }),
      text("One line about what was achieved.", 180, 192 + i * 120, 680, 36, { size: 22 }),
    ]),
  ] },

  // ---------- Phase 3 ----------
  { id: "pitch", cat: "pitch", label: "Pitch opening", hint: "Name, promise and three proof points", build: () => [
    shape("blob", 600, -160, 460, 460, { fill: "soft", op: 0.8 }),
    kicker("YOUR STARTUP  ·  SEED PITCH", 70, 70),
    shape("divider", 70, 115, 90, 10, { fill: "accent" }),
    title("We make [the thing] simple for [your people].", 70, 145, 540, 230, { size: 54 }),
    text("One sentence: the biggest result you deliver.", 70, 395, 520, 80, { size: 24 }),
    ...[["$2M", "ARR in year one", "panel", "paper"], ["10k", "teams on the waitlist", "accent", "paper"], ["3x", "faster than today", "soft", "ink"]].flatMap(([n, c, f, ink], i) => [
      shape("round", 650, 80 + i * 138, 250, 118, { fill: f }),
      title(n, 665, 88 + i * 138, 220, 64, { size: 44, color: ink }),
      text(c, 665, 148 + i * 138, 220, 40, { size: 19, color: ink }),
    ]),
  ] },
  { id: "market", cat: "pitch", label: "Market opportunity", hint: "TAM, SAM and SOM circles", build: () => [
    title("A big market, and a clear first step", 70, 36, 820, 70, { size: 38 }),
    shape("ellipse", 60, 120, 380, 380, { fill: "soft", op: 0.9 }),
    shape("ellipse", 120, 200, 260, 260, { fill: "accent", op: 0.65 }),
    shape("ellipse", 175, 290, 150, 150, { fill: "panel" }),
    text("TAM", 190, 140, 120, 40, { font: DISPLAY, bold: true, size: 26, align: "center" }),
    text("SAM", 190, 218, 120, 40, { font: DISPLAY, bold: true, size: 24, align: "center", color: "paper" }),
    text("SOM", 190, 345, 120, 40, { font: DISPLAY, bold: true, size: 22, align: "center", color: "paper" }),
    ...[["$40B", "Total market (TAM)", "Everyone who could ever use this."], ["$6B", "Reachable market (SAM)", "The segment our product serves today."], ["$300M", "First target (SOM)", "What we can win in the next 3 years."]].flatMap(([n, h, d], i) => [
      title(n, 490, 130 + i * 118, 200, 56, { size: 40, color: ["ink", "accent", "panel"][i] }),
      text(h, 690, 135 + i * 118, 240, 34, { size: 20, bold: true }),
      text(d, 690, 170 + i * 118, 240, 60, { size: 17 }),
    ]),
  ] },
  { id: "model", cat: "pitch", label: "Business model", hint: "Who pays, what they get, how we earn", build: () => [
    title("How we make money", 70, 36, 800, 70, { size: 42 }),
    ...[["Who pays", "Name the customer and the person who signs the cheque.", "accent"], ["What they get", "The result they can't easily get anywhere else.", "panel"], ["How we earn", "Price, plan and why it grows as they do.", "ink"]].flatMap(([h, d, c], i) => [
      shape("round", 60 + i * 295, 140, 275, 330, { fill: "paper", stroke: "soft", sw: 3 }),
      shape("round", 60 + i * 295, 140, 275, 14, { fill: c }),
      text(String(i + 1), 80 + i * 295, 170, 60, 50, { font: DISPLAY, bold: true, size: 40, color: c === "ink" ? "accent" : c }),
      text(h, 80 + i * 295, 230, 235, 44, { font: DISPLAY, bold: true, size: 28 }),
      text(d, 80 + i * 295, 285, 235, 170, { size: 21, lh: 1.4 }),
    ]),
  ] },
  { id: "features", cat: "pitch", label: "Product features", hint: "Three features with icons", build: () => [
    title("What makes it special", 70, 36, 800, 70, { size: 42 }),
    ...["Feature one", "Feature two", "Feature three"].flatMap((h, i) => [
      shape("ellipse", 80 + i * 295, 140, 84, 84, { fill: ["accent", "panel", "soft"][i] }),
      title(String(i + 1), 80 + i * 295, 154, 84, 56, { size: 36, align: "center", color: i === 2 ? "ink" : "paper" }),
      text(h, 70 + i * 295, 245, 260, 44, { font: DISPLAY, bold: true, size: 28 }),
      text("Say what it does and the benefit in one or two short lines.", 70 + i * 295, 295, 250, 160, { size: 21, lh: 1.4 }),
    ]),
  ] },
  { id: "casestudy", cat: "pitch", label: "Case study", hint: "Challenge, approach and result", build: () => [
    { type: "image", src: "", alt: "", fit: "cover", x: 60, y: 60, w: 340, h: 420 },
    kicker("CASE STUDY  ·  CLIENT NAME", 440, 60, 460),
    ...[["Challenge", "What was going wrong before?"], ["Approach", "What did you do about it?"], ["Result", "What changed, in numbers?"]].flatMap(([h, d], i) => [
      shape("ellipse", 440, 120 + i * 120, 18, 18, { fill: ["soft", "accent", "panel"][i] }),
      text(h, 470, 110 + i * 120, 400, 38, { font: DISPLAY, bold: true, size: 28 }),
      text(d, 470, 150 + i * 120, 430, 70, { size: 21, lh: 1.35 }),
    ]),
  ] },
  { id: "competition", cat: "data", label: "Competitive comparison", hint: "Us against the others, in a table", build: () => [
    title("Why we win", 70, 36, 800, 70, { size: 42 }),
    table([["", "Us", "Rival A", "Rival B"], ["Easy to start", "Yes", "No", "Partial"], ["Real-time teamwork", "Yes", "Partial", "No"], ["Fair price", "Yes", "No", "Yes"], ["Open exports", "Yes", "No", "No"]], { x: 70, y: 130, w: 820, h: 330, size: 22, tcw: "1.7,1,1,1" }),
  ] },
  { id: "kpi", cat: "data", label: "KPI dashboard", hint: "Three numbers and a trend line", build: () => [
    title("This quarter at a glance", 70, 30, 820, 66, { size: 38 }),
    ...[["12.4k", "Active users", "accent"], ["94%", "Retention", "panel"], ["$38k", "Monthly revenue", "soft"]].flatMap(([n, c, f], i) => [
      shape("round", 60 + i * 290, 110, 270, 110, { fill: f }),
      title(n, 75 + i * 290, 116, 240, 62, { size: 46, color: f === "soft" ? "ink" : "paper" }),
      text(c, 75 + i * 290, 176, 240, 36, { size: 19, color: f === "soft" ? "ink" : "paper" }),
    ]),
    chart("line", { ctitle: "Weekly active users", cdata: "W1, 8.2\nW2, 9.1\nW3, 10.4\nW4, 11.2\nW5, 12.4", x: 60, y: 240, w: 840, h: 270 }),
  ] },
  { id: "financials", cat: "data", label: "Financial projections", hint: "A chart beside a small table", build: () => [
    title("Where the numbers are heading", 70, 30, 820, 66, { size: 38 }),
    chart("bar", { ctitle: "Revenue ($k)", cdata: "2026, 120\n2027, 340\n2028, 810\n2029, 1500", x: 50, y: 110, w: 470, h: 370 }),
    table([["Year", "Revenue", "Profit"], ["2026", "$120k", "-$80k"], ["2027", "$340k", "-$20k"], ["2028", "$810k", "$140k"], ["2029", "$1.5M", "$520k"]], { x: 550, y: 130, w: 360, h: 250, size: 19, tcw: "1,1.3,1.3" }),
    text("Replace these example numbers with your own.", 550, 400, 360, 70, { size: 17, italic: true }),
  ] },
  { id: "beforeafter", cat: "basics", label: "Before and after", hint: "Two states with an arrow", build: () => [
    title("From this to that", 70, 36, 800, 70, { size: 42 }),
    shape("round", 60, 130, 380, 340, { fill: "paper", stroke: "soft", sw: 3 }),
    shape("round", 520, 130, 380, 340, { fill: "panel" }),
    text("BEFORE", 90, 155, 320, 36, { size: 20, bold: true, color: "accent", ls: 2 }),
    text("Slow, manual and scattered across five tools.", 90, 205, 320, 240, { size: 25, lh: 1.4 }),
    text("AFTER", 550, 155, 320, 36, { size: 20, bold: true, color: "paper", ls: 2 }),
    text("Fast, automatic and all in one place.", 550, 205, 320, 240, { size: 25, lh: 1.4, color: "paper" }),
    arrow(448, 298, 64, 2, { stroke: "accent", sw: 6 }),
  ] },
  { id: "swot", cat: "plans", label: "SWOT analysis", hint: "Strengths, weaknesses, opportunities, threats", build: () => [
    title("SWOT", 70, 24, 500, 60, { size: 36 }),
    ...[["Strengths", "accent", 60, 100], ["Weaknesses", "panel", 490, 100], ["Opportunities", "soft", 60, 300], ["Threats", "ink", 490, 300]].flatMap(([h, c, x, y]) => [
      shape("round", x, y, 410, 180, { fill: "paper", stroke: c, sw: 4 }),
      text(h, x + 20, y + 12, 370, 40, { font: DISPLAY, bold: true, size: 26, color: c === "soft" ? "ink" : c }),
      text("First point\nSecond point\nThird point", x + 20, y + 58, 370, 112, { size: 20, list: "bullet", lh: 1.35 }),
    ]),
  ] },
  { id: "roadmap", cat: "plans", label: "Roadmap: now, next, later", hint: "Three columns of work", build: () => [
    title("Roadmap", 70, 30, 700, 66, { size: 40 }),
    ...[["Now", "accent", "paper"], ["Next", "panel", "paper"], ["Later", "soft", "ink"]].flatMap(([h, c, ink], i) => [
      shape("chevron", 60 + i * 295, 115, 285, 70, { fill: c }),
      text(h, 100 + i * 295, 128, 180, 44, { font: DISPLAY, bold: true, size: 28, color: ink }),
      shape("round", 60 + i * 295, 205, 270, 280, { fill: "paper", stroke: "soft", sw: 3 }),
      text("Big goal one\nBig goal two\nBig goal three", 75 + i * 295, 220, 245, 250, { size: 21, list: "bullet", lh: 1.5 }),
    ]),
  ] },
  { id: "flowchart", cat: "plans", label: "Flowchart", hint: "Start, step, decision and end", build: () => [
    title("What happens next", 70, 30, 800, 66, { size: 38 }),
    shape("round", 50, 210, 150, 80, { fill: "accent", text: "Start", size: 24, bold: true }),
    arrow(204, 249, 56, 2),
    shape("rect", 266, 210, 170, 80, { fill: "panel", text: "Do the work", size: 22, bold: true }),
    arrow(440, 249, 56, 2),
    shape("diamond", 500, 180, 170, 140, { fill: "soft", text: "Good enough?", size: 20, bold: true, color: "ink" }),
    arrow(674, 249, 56, 2, { stroke: "accent" }),
    text("Yes", 676, 212, 50, 30, { size: 18, bold: true, align: "center", color: "accent" }),
    shape("round", 736, 210, 170, 80, { fill: "accent", text: "Ship it", size: 24, bold: true }),
    arrow(581, 324, 8, 56, { stroke: "ink" }),
    text("No", 596, 334, 60, 30, { size: 18, bold: true, color: "ink" }),
    shape("rect", 496, 384, 170, 80, { fill: "paper", stroke: "ink", sw: 3, text: "Improve it", size: 22, bold: true, color: "ink" }),
  ] },
  { id: "closing", cat: "people", label: "Closing / thank you", hint: "Say thanks, share contacts", build: () => [
    ...blobs(),
    title("Thank you!", 80, 160, 800, 140, { size: 96, align: "center" }),
    text("name@example.com  ·  @yourhandle", 160, 330, 640, 50, { size: 28, align: "center", color: "accent", bold: true }),
  ] },
];

export const templateOf = (id) => TEMPLATES.find((t) => t.id === id);

// Turns a classic (pre-upgrade) slide into the same look made of editable elements.
export function legacyToElements(slide) {
  const ttl = slide.title || "";
  const body = slide.body || "";
  switch (slide.layout) {
    case "cover":
      return [...blobs(), title(ttl, 80, 170, 800, 130, { size: 70, align: "center" }), text(body.replace(/\n/g, " "), 160, 330, 640, 90, { size: 30, align: "center" })];
    case "statement":
      return [...blobs(), shape("divider", 80, 150, 110, 12, { fill: "accent" }), title(ttl, 80, 190, 780, 220, { size: 60 }), ...(body ? [text(body, 80, 420, 780, 80, { size: 26 })] : [])];
    case "split":
      return [shape("rect", 0, 0, 400, H, { fill: "panel" }), title(ttl, 50, 150, 310, 240, { size: 46, color: "paper" }), text(body, 450, 150, 440, 300, { size: 26, lh: 1.5 })];
    default:
      return [...blobs(), title(ttl, 70, 50, 760, 90, { size: 46 }), text(body, 70, 160, 780, 320, { size: 30, list: "bullet", lh: 1.5 })];
  }
}

export { W as SLIDE_W, H as SLIDE_H };
