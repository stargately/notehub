import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState, useCallback, useRef, type MutableRefObject } from "react";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { KeymapProvider } from "../../lib/keymap/provider";
import { useUndoHistory } from "../../hooks/useUndoHistory";
import { getDocStats, publishDocStats, subscribeDocStats, type DocStats } from "../../lib/doc-stats";
import type { TabInfo } from "../../lib/types";
import type { DocCommands } from "../DocumentView";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../hooks/useFileWatcher", () => ({ useFileWatcher: () => {} }));

// Stub the heavy editors (same shape as DocumentView.test.tsx); the stats pipeline under test
// lives in DocumentView itself + the real doc-stats module.
vi.mock("../QaLayout", () => ({
  QaLayout: ({ content, onChange, fileName }: { content: string; onChange: (v: string) => void; fileName?: string }) => (
    <textarea data-testid={`qa-${fileName}`} value={content} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("../RawFileEditor", () => ({
  RawFileEditor: ({ filePath }: { filePath: string }) => <div data-testid={`raw-${filePath}`} />,
}));
vi.mock("../MarkdownEditor", () => ({ MarkdownEditor: () => null }));
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
const flushDebounce = () => act(async () => { await new Promise((r) => setTimeout(r, 350)); });

const TABS: TabInfo[] = [
  { id: "A", filePath: "/a.md", label: "a.md", kind: "markdown" },
  { id: "B", filePath: "/b.md", label: "b.md", kind: "markdown" },
  { id: "C", filePath: "/c.txt", label: "c.txt", kind: "raw" },
];

const noopSetTabs: React.Dispatch<React.SetStateAction<TabInfo[]>> = () => {};

function Harness() {
  const undoHistory = useUndoHistory();
  const [activeId, setActiveId] = useState("A");
  const activeCmds = useRef<MutableRefObject<DocCommands> | null>(null);
  const publishCommands = useCallback((ref: MutableRefObject<DocCommands>) => {
    activeCmds.current = ref;
    return () => {
      if (activeCmds.current === ref) activeCmds.current = null;
    };
  }, []);
  return (
    <KeymapProvider>
      {TABS.map((t) => (
        <button key={t.id} data-testid={`to-${t.id}`} onClick={() => setActiveId(t.id)}>
          {t.id}
        </button>
      ))}
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

beforeEach(() => {
  // "# Title" + "one two three" → 4 words, 18 chars (Title + one two three), ~1 min.
  disk = { "/a.md": "# Title\n\none two three", "/b.md": "hello world" };
  publishDocStats(null);
});

describe("DocumentView — doc stats publish (status bar feed)", () => {
  it("publishes the active doc's stats once loaded (immediate, no debounce lag)", async () => {
    render(<Harness />);
    await settle();
    expect(getDocStats()).toEqual({ words: 4, chars: 18, readingMinutes: 1 });
  });

  it("updates after the debounce as the user types", async () => {
    render(<Harness />);
    await settle();

    fireEvent.change(screen.getByTestId("qa-a"), { target: { value: "one two three four five" } });
    // Not yet — the stats recompute is debounced, not per-keystroke.
    expect(getDocStats()).toEqual({ words: 4, chars: 18, readingMinutes: 1 });

    await flushDebounce();
    expect(getDocStats()).toEqual({ words: 5, chars: 23, readingMinutes: 1 });
  });

  it("switches with the active tab, and clears for a non-markdown (raw) tab", async () => {
    render(<Harness />);
    await settle();
    expect(getDocStats()?.words).toBe(4); // /a.md

    act(() => {
      screen.getByTestId("to-B").click();
    });
    await settle();
    expect(getDocStats()).toEqual({ words: 2, chars: 11, readingMinutes: 1 }); // /b.md

    act(() => {
      screen.getByTestId("to-C").click(); // raw .txt → RawFileEditor, no stats
    });
    await settle();
    expect(getDocStats()).toBeNull();
  });

  it("clears on unmount (last tab closed → blank welcome state)", async () => {
    const { unmount } = render(<Harness />);
    await settle();
    expect(getDocStats()).not.toBeNull();
    unmount();
    expect(getDocStats()).toBeNull();
  });

  it("never flashes transient 0-word stats while a doc loads (seed-guard regression)", async () => {
    // The bug: for one commit after load, projectData was set but editorContent wasn't seeded
    // yet, so the first publish carried "" and the bar showed "0 words" until the debounce.
    const published: Array<DocStats | null> = [];
    const unsub = subscribeDocStats(() => published.push(getDocStats()));
    render(<Harness />);
    await settle();
    unsub();
    expect(published).toEqual([{ words: 4, chars: 18, readingMinutes: 1 }]); // one publish, real stats
  });

  it("a doc the user empties still updates to 0 words (the seed guard is load-scoped only)", async () => {
    render(<Harness />);
    await settle();
    expect(getDocStats()?.words).toBe(4);

    fireEvent.change(screen.getByTestId("qa-a"), { target: { value: "" } });
    await flushDebounce();
    expect(getDocStats()).toEqual({ words: 0, chars: 0, readingMinutes: 0 });
  });

  it("switching back to an edited tab republishes its latest stats immediately", async () => {
    render(<Harness />);
    await settle();

    fireEvent.change(screen.getByTestId("qa-a"), { target: { value: "five words are in here" } });
    await flushDebounce();
    expect(getDocStats()?.words).toBe(5);

    act(() => {
      screen.getByTestId("to-B").click();
    });
    await settle();
    expect(getDocStats()?.words).toBe(2); // /b.md

    // Back to A: the edited stats return without waiting for a debounce window.
    act(() => {
      screen.getByTestId("to-A").click();
    });
    await settle();
    expect(getDocStats()?.words).toBe(5);
  });
});
