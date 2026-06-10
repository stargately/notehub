import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState, useCallback, useRef, type MutableRefObject } from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { KeymapProvider } from "../../lib/keymap/provider";
import { useUndoHistory } from "../../hooks/useUndoHistory";
import type { TabInfo } from "../../lib/types";
import type { DocCommands } from "../DocumentView";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../hooks/useFileWatcher", () => ({ useFileWatcher: () => {} }));

// Spy on the Monaco jump handle: the mocked MarkdownEditor fills `revealLineRef` the way the real
// one does on mount, so the raw-view jump route is observable.
const spies = vi.hoisted(() => ({ revealLine: vi.fn() }));

// Stub QaLayout like DocumentView.test.tsx, but additionally (1) expose the new outline-toggle
// wiring as a button and (2) render the doc's ATX headings as real <h1>–<h6> under the
// `.nh-qa-doc .ProseMirror` selector chain — a minimal stand-in for the rendered Milkdown DOM,
// so the WYSIWYG jump route (DOM heading match + scrollIntoView) is exercised end to end.
vi.mock("../QaLayout", () => ({
  QaLayout: ({
    content,
    onChange,
    fileName,
    outlineOpen,
    onToggleOutline,
  }: {
    content: string;
    onChange: (v: string) => void;
    fileName?: string;
    outlineOpen?: boolean;
    onToggleOutline?: () => void;
  }) => (
    <div>
      <textarea data-testid={`qa-${fileName}`} value={content} onChange={(e) => onChange(e.target.value)} />
      {onToggleOutline && (
        <button data-testid={`outline-toggle-${fileName}`} aria-pressed={outlineOpen} onClick={onToggleOutline}>
          toggle outline
        </button>
      )}
      <div className="nh-qa-doc">
        <div className="ProseMirror">
          {content.split("\n").map((line, i) => {
            const m = line.match(/^(#{1,6}) (.+)$/);
            if (!m) return null;
            const Tag = `h${m[1].length}` as "h1";
            return <Tag key={i}>{m[2]}</Tag>;
          })}
        </div>
      </div>
    </div>
  ),
}));
vi.mock("../MarkdownEditor", () => ({
  MarkdownEditor: ({
    revealLineRef,
  }: {
    revealLineRef?: MutableRefObject<((line: number) => void) | null>;
  }) => {
    if (revealLineRef) revealLineRef.current = spies.revealLine;
    return <div data-testid="monaco-mock" />;
  },
}));
vi.mock("../RawFileEditor", () => ({
  RawFileEditor: ({ filePath }: { filePath: string }) => <div data-testid={`raw-${filePath}`} />,
}));
vi.mock("../TaskTable", () => ({ TaskTable: () => null }));
vi.mock("../ProjectNotes", () => ({ ProjectNotes: () => null }));
vi.mock("../TaskDetailDrawer", () => ({ TaskDetailDrawer: () => null }));
vi.mock("../ConflictModal", () => ({ ConflictModal: () => null }));
vi.mock("../Toolbar", () => ({ Toolbar: () => null }));

let disk: Record<string, string> = {};
vi.mock("../../lib/tauri-api", () => ({
  getInitialSession: vi.fn(),
  saveFileDialog: vi.fn(async () => null),
  readFile: async (p: string) => disk[p] ?? "",
  writeFile: async (p: string, c: string) => {
    disk[p] = c;
  },
  getDefaultProjectContent: () => "---\nlayout: todo\n---\n\n## Tasks\n\n| Id | Title |\n| --- | --- |\n",
}));

import { DocumentView } from "../DocumentView";

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

// `# Alpha` on line 0, `## Beta` on line 4 (so the raw-view jump is revealLineInCenter(5)).
const DOC_A = "# Alpha\n\nintro text\n\n## Beta\n\nmore text";

const TABS: TabInfo[] = [
  { id: "A", filePath: "/a.md", label: "a.md", kind: "markdown" },
  { id: "B", filePath: "/b.md", label: "b.md", kind: "markdown" },
  { id: "C", filePath: "/c.txt", label: "c.txt", kind: "raw" },
];

const noopSetTabs: React.Dispatch<React.SetStateAction<TabInfo[]>> = () => {};

function Harness({ initialActive = "A" }: { initialActive?: string }) {
  const undoHistory = useUndoHistory();
  const [activeId, setActiveId] = useState(initialActive);
  const activeCmds = useRef<MutableRefObject<DocCommands> | null>(null);
  const publishCommands = useCallback((ref: MutableRefObject<DocCommands>) => {
    activeCmds.current = ref;
    return () => {
      if (activeCmds.current === ref) activeCmds.current = null;
    };
  }, []);
  return (
    <KeymapProvider>
      <button data-testid="to-C" onClick={() => setActiveId("C")}>C</button>
      <button data-testid="toggle-view" onClick={() => activeCmds.current?.current.toggleView()}>
        toggle view
      </button>
      {TABS.map((t) => (
        <div key={t.id} style={{ display: t.id === activeId ? "block" : "none" }}>
          <DocumentView
            tabId={t.id}
            filePath={t.filePath}
            kind={t.kind}
            active={t.id === activeId}
            darkMode={false}
            setTabs={noopSetTabs}
            undoHistory={undoHistory}
            publishCommands={publishCommands}
          />
        </div>
      ))}
    </KeymapProvider>
  );
}

// jsdom has no scrollIntoView — install one that records its `this` (the scrolled element).
let scrolled: HTMLElement[] = [];
beforeEach(() => {
  disk = { "/a.md": DOC_A, "/b.md": "no headings here" };
  localStorage.clear();
  scrolled = [];
  spies.revealLine.mockClear();
  // GoToHeading/OutlinePanel also scroll their list rows into view; filter to headings in asserts.
  window.HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
    scrolled.push(this);
  });
});
const scrolledHeadings = () => scrolled.filter((el) => /^H[1-6]$/.test(el.tagName));

const pressGoToHeading = () =>
  fireEvent.keyDown(window, { key: "O", metaKey: true, shiftKey: true });

describe("DocumentView — outline panel", () => {
  it("toggles the panel from the header wiring, lists the doc's headings, and click scrolls the rendered heading into view", async () => {
    render(<Harness />);
    await settle();

    // Closed by default — no outline rows yet.
    expect(screen.queryByRole("button", { name: "Alpha" })).toBeNull();

    fireEvent.click(screen.getByTestId("outline-toggle-a"));
    fireEvent.click(screen.getByRole("button", { name: "Beta" }));

    expect(scrolledHeadings().map((el) => [el.tagName, el.textContent])).toEqual([["H2", "Beta"]]);
    // The toggle persisted the preference.
    expect(localStorage.getItem("nh-outline-open")).toBe("1");
  });

  it("restores the panel from the persisted preference on mount", async () => {
    localStorage.setItem("nh-outline-open", "1");
    render(<Harness />);
    await settle();
    expect(screen.getByRole("button", { name: "Alpha" })).toBeTruthy();
  });
});

describe("DocumentView — Cmd+Shift+O go-to-heading", () => {
  it("opens the overlay for the active markdown tab; Enter jumps to the fuzzy match (WYSIWYG route)", async () => {
    render(<Harness />);
    await settle();

    pressGoToHeading();
    const input = screen.getByPlaceholderText("Go to heading…");
    fireEvent.change(input, { target: { value: "bet" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(scrolledHeadings().map((el) => el.textContent)).toEqual(["Beta"]);
    expect(screen.queryByPlaceholderText("Go to heading…")).toBeNull(); // closed after the jump
    expect(spies.revealLine).not.toHaveBeenCalled(); // WYSIWYG route, not Monaco
  });

  it("routes the jump through Monaco's reveal handle in the raw editor view", async () => {
    render(<Harness />);
    await settle();

    act(() => {
      screen.getByTestId("toggle-view").click(); // WYSIWYG → raw Monaco view
    });
    await settle();
    expect(screen.getByTestId("monaco-mock")).toBeTruthy();

    pressGoToHeading();
    const input = screen.getByPlaceholderText("Go to heading…");
    fireEvent.change(input, { target: { value: "beta" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(spies.revealLine).toHaveBeenCalledWith(5); // `## Beta` is line 4 (0-based)
    expect(scrolledHeadings()).toEqual([]);
  });

  it("is inert when the active tab is not a markdown view (raw .txt file)", async () => {
    render(<Harness initialActive="C" />);
    await settle();

    pressGoToHeading();
    expect(screen.queryByPlaceholderText("Go to heading…")).toBeNull();
  });
});
