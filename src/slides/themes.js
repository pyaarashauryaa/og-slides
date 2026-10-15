// Four coordinated looks. Each one defines every colour a slide needs.
export const THEMES = {
  rani: { label: "Rani", bg: "linear-gradient(135deg,#fff3f7 0%,#fce4ec 100%)", bg0: "#fff3f7", bg1: "#fce4ec", ink: "#3f1629", accent: "#e91e63", soft: "#f8c9d9", panel: "#d81b60", panelInk: "#fff", dot: "#e91e63" },
  lavender: { label: "Lavender", bg: "linear-gradient(135deg,#f7f3ff 0%,#e6dcff 100%)", bg0: "#f7f3ff", bg1: "#e6dcff", ink: "#2d2150", accent: "#7c5cd6", soft: "#d6c9fa", panel: "#6a49c4", panelInk: "#fff", dot: "#7c5cd6" },
  mint: { label: "Mint", bg: "linear-gradient(135deg,#f1fcf6 0%,#d3f3e2 100%)", bg0: "#f1fcf6", bg1: "#d3f3e2", ink: "#12392b", accent: "#1f9d6b", soft: "#b6e8d0", panel: "#177a54", panelInk: "#fff", dot: "#1f9d6b" },
  peach: { label: "Peach", bg: "linear-gradient(135deg,#fff7f0 0%,#ffe0cc 100%)", bg0: "#fff7f0", bg1: "#ffe0cc", ink: "#4a2410", accent: "#e8833a", soft: "#ffcfae", panel: "#c8621d", panelInk: "#fff", dot: "#e8833a" },
};
export const themeOf = (id) => THEMES[id] || THEMES.rani;

// Turns a colour token (or hex) into a real colour for a theme.
export function resolveColor(c, theme) {
  const t = themeOf(theme);
  switch (c) {
    case "ink": return t.ink;
    case "accent": return t.accent;
    case "panel": return t.panel;
    case "soft": return t.soft;
    case "paper": return "#ffffff";
    case "none": case undefined: case null: case "": return "transparent";
    default: return c;
  }
}
