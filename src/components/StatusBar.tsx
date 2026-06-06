import { isTauri } from "../lib/tauri-api";
import { ThemeIcon } from "./ThemeIcon";
import type { ThemeMode } from "../hooks/useDarkMode";

interface StatusBarProps {
  /** Sidebar (file-tree) open state + toggle — a layout panel. */
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** Terminal panel visibility + toggle — a layout panel. */
  terminalVisible: boolean;
  onToggleTerminal: () => void;
  /** Global appearance: current theme + cycle (light → dark → system). */
  themeMode: ThemeMode;
  onCycleTheme: () => void;
  /** Workspace root, shown (basename) as muted context on the left. */
  workspaceRoot: string | null;
}

const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
const mod = isMac ? "Cmd" : "Ctrl";

/** A panel toggle with a left vertical divider, à la VS Code / Zed's dock toggle. */
function PanelIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </svg>
  );
}

/** A `>_` terminal glyph. */
function TerminalIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7l4 4-4 4M12 16h7" />
    </svg>
  );
}

/**
 * Zed-style thin footer hosting the window's layout-level toggles. The sidebar and terminal
 * are the two layout panels (left cluster); the theme cycle is the one global appearance
 * control (right cluster). Spans the full window width below the sidebar + document area.
 */
export function StatusBar({
  sidebarOpen,
  onToggleSidebar,
  terminalVisible,
  onToggleTerminal,
  themeMode,
  onCycleTheme,
  workspaceRoot,
}: StatusBarProps) {
  const rootName = workspaceRoot
    ? workspaceRoot.split("/").filter(Boolean).pop() ?? workspaceRoot
    : null;

  return (
    <footer className="nh-statusbar">
      {/* Left: layout panel toggles (sidebar + terminal are Tauri-only panels). */}
      {isTauri && (
        <>
          <button
            type="button"
            className={`nh-status-btn ${sidebarOpen ? "active" : ""}`}
            onClick={onToggleSidebar}
            aria-pressed={sidebarOpen}
            title={`${sidebarOpen ? "Hide" : "Show"} sidebar (${mod}+B)`}
          >
            <PanelIcon />
          </button>
          <button
            type="button"
            className={`nh-status-btn ${terminalVisible ? "active" : ""}`}
            onClick={onToggleTerminal}
            aria-pressed={terminalVisible}
            title={`${terminalVisible ? "Hide" : "Show"} terminal (Ctrl+\`)`}
          >
            <TerminalIcon />
          </button>
        </>
      )}

      {rootName && (
        <span
          className="truncate"
          style={{ color: "var(--nh-text-tertiary)", marginLeft: 2, maxWidth: 220 }}
          title={workspaceRoot ?? ""}
        >
          {rootName}
        </span>
      )}

      <div className="flex-1" />

      {/* Right: global appearance. */}
      <button
        type="button"
        className="nh-status-btn"
        onClick={onCycleTheme}
        title={`Theme: ${themeMode} (click to cycle)`}
      >
        <ThemeIcon themeMode={themeMode} />
        <span className="capitalize">{themeMode}</span>
      </button>
    </footer>
  );
}
