import { Home, MessageCircleHeart, KanbanSquare, Link2, ScrollText, Presentation, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import Logo from "./Logo.jsx";

export const PAGES = [
  { id: "home", label: "Home", icon: Home, tone: "butter", hint: "Alt 1" },
  { id: "slides", label: "Slides", icon: Presentation, tone: "rani", hint: "Alt 2" },
  { id: "chat", label: "Team chat", short: "Chat", icon: MessageCircleHeart, tone: "teal", hint: "Alt 3" },
  { id: "tasks", label: "Tasks", icon: KanbanSquare, tone: "coral", hint: "Alt 4" },
  { id: "resources", label: "Resources", short: "Links", icon: Link2, tone: "sky", hint: "Alt 5" },
  { id: "decisions", label: "Decisions", icon: ScrollText, tone: "violet", hint: "Alt 6" },
];

const MOD = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "") ? "⌘" : "Ctrl";

// Main navigation. On wide screens it can fold down to an icon rail; the icons then show a
// tooltip with the page name (on hover AND keyboard focus). On phones it becomes a bottom bar.
export default function Sidebar({ current, onNavigate, projectName, collapsed = false, onToggle, onPalette }) {
  return (
    <aside className={`sidebar${collapsed ? " sidebar--collapsed" : ""}`} aria-label="OGSlides sections">
      <Logo />

      <div className="project-chip">
        <div className="project-chip__label">Your team</div>
        <div className="project-chip__name">{projectName}</div>
      </div>

      <nav className="nav" aria-label="Main">
        {PAGES.map(({ id, label, short, icon: Icon, tone, hint }) => (
          <button
            key={id}
            className="nav__item"
            data-tone={tone}
            data-tip={collapsed ? label : undefined}
            aria-label={short || collapsed ? label : undefined}
            aria-current={current === id ? "page" : undefined}
            aria-keyshortcuts={hint ? hint.replace(" ", "+") : undefined}
            onClick={() => onNavigate(id)}
          >
            <span className="nav__icon" aria-hidden="true"><Icon size={18} strokeWidth={2} /></span>
            <span className="nav__label" aria-hidden={short || collapsed ? "true" : undefined}>{label}</span>
            {short && <span className="nav__short" aria-hidden="true">{short}</span>}
            <kbd className="nav__kbd" aria-hidden="true">{hint}</kbd>
          </button>
        ))}
      </nav>

      <div className="sidebar__tools">
        <button className="sidebar__jump" onClick={onPalette} data-tip={collapsed ? "Quick jump" : undefined} aria-label="Quick jump to a page, presentation or action" aria-keyshortcuts="Control+K Meta+K">
          <Search size={16} aria-hidden="true" />
          <span className="sidebar__jump-text">Quick jump</span>
          <kbd aria-hidden="true">{MOD} K</kbd>
        </button>
        <button className="sidebar__collapse" onClick={onToggle} aria-pressed={collapsed} data-tip={collapsed ? "Expand sidebar" : undefined} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
          <span className="sidebar__collapse-text">Collapse</span>
        </button>
      </div>

      <p className="sidebar__foot">Build the deck together, chat about it, and keep every decision in one room.</p>
    </aside>
  );
}
