import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// `isTauri` gates the left (sidebar/terminal) cluster. Mock it as a flippable getter so we can
// exercise both the desktop (panels shown) and browser (panels hidden) branches.
let tauriEnabled = true;
vi.mock("../../lib/tauri-api", () => ({
  get isTauri() {
    return tauriEnabled;
  },
}));

import { StatusBar } from "../StatusBar";
import { publishDocStats } from "../../lib/doc-stats";
import { act } from "@testing-library/react";

type Props = Parameters<typeof StatusBar>[0];

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    sidebarOpen: false,
    onToggleSidebar: vi.fn(),
    terminalVisible: false,
    onToggleTerminal: vi.fn(),
    themeMode: "system",
    onCycleTheme: vi.fn(),
    workspaceRoot: null,
    ...overrides,
  };
  render(<StatusBar {...props} />);
  return props;
}

beforeEach(() => {
  tauriEnabled = true;
  publishDocStats(null);
});

describe("StatusBar", () => {
  it("renders the layout-panel toggles, workspace name, and the theme cycle (desktop)", () => {
    setup({ themeMode: "dark", workspaceRoot: "/Users/me/projects/notehub" });
    expect(screen.getByTitle(/sidebar/i)).toBeTruthy();
    expect(screen.getByTitle(/terminal/i)).toBeTruthy();
    expect(screen.getByTitle(/^Theme:/)).toBeTruthy();
    // Workspace basename shown as muted context; theme label reflects the current mode.
    expect(screen.getByText("notehub")).toBeTruthy();
    expect(screen.getByText("dark")).toBeTruthy();
  });

  it("clicking a toggle calls its handler", () => {
    const onToggleSidebar = vi.fn();
    const onToggleTerminal = vi.fn();
    const onCycleTheme = vi.fn();
    setup({ onToggleSidebar, onToggleTerminal, onCycleTheme });

    fireEvent.click(screen.getByTitle(/sidebar/i));
    fireEvent.click(screen.getByTitle(/terminal/i));
    fireEvent.click(screen.getByTitle(/^Theme:/));

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    expect(onToggleTerminal).toHaveBeenCalledTimes(1);
    expect(onCycleTheme).toHaveBeenCalledTimes(1);
  });

  it("tints only the open/visible panels active and mirrors state via aria-pressed", () => {
    setup({ sidebarOpen: true, terminalVisible: false });
    const sidebar = screen.getByTitle(/sidebar/i);
    const terminal = screen.getByTitle(/terminal/i);

    expect(sidebar.className).toContain("active");
    expect(terminal.className).not.toContain("active");
    expect(sidebar.getAttribute("aria-pressed")).toBe("true");
    expect(terminal.getAttribute("aria-pressed")).toBe("false");
  });

  it("hides the sidebar/terminal panel toggles outside Tauri, keeping the theme cycle", () => {
    tauriEnabled = false;
    setup({ themeMode: "light", workspaceRoot: "/x/notehub" });

    expect(screen.queryByTitle(/sidebar/i)).toBeNull();
    expect(screen.queryByTitle(/terminal/i)).toBeNull();
    expect(screen.getByTitle(/^Theme:/)).toBeTruthy();
    expect(screen.getByText("light")).toBeTruthy();
  });

  it("shows the active doc's stats from the store and clears them on a null publish", () => {
    setup();
    // Blank until a document publishes (welcome/no-doc state).
    expect(screen.queryByText(/words/)).toBeNull();

    act(() => publishDocStats({ words: 1234, chars: 5678, readingMinutes: 6 }));
    expect(screen.getByText("1,234 words · 5,678 chars · ~6 min read")).toBeTruthy();

    act(() => publishDocStats({ words: 1235, chars: 5681, readingMinutes: 6 }));
    expect(screen.getByText(/^1,235 words/)).toBeTruthy(); // live update

    act(() => publishDocStats(null)); // last tab closed → blank again
    expect(screen.queryByText(/words/)).toBeNull();
  });
});
