import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState, useCallback, useRef, type MutableRefObject } from "react";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import { KeymapProvider } from "../../lib/keymap/provider";
import { useUndoHistory } from "../../hooks/useUndoHistory";
import type { TabInfo } from "../../lib/types";
import type { DocCommands } from "../DocumentView";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../../hooks/useFileWatcher", () => ({ useFileWatcher: () => {} }));

// Stub the heavy editors. QaLayout (the plain/qa view) becomes a controllable textarea keyed by
// the document's file name; RawFileEditor a marker keyed by its path — both individually addressable.
vi.mock("../QaLayout", () => ({
  QaLayout: ({ content, onChange, fileName }: { content: string; onChange: (v: string) => void; fileName?: string }) => (
    <textarea data-testid={`qa-${fileName}`} value={content} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("../RawFileEditor", () => ({
  RawFileEditor: ({ filePath }: { filePath: string }) => <div data-testid={`raw-${filePath}`} />,
}));
vi.mock("../TaskTable", () => ({ TaskTable: () => null }));
vi.mock("../MarkdownEditor", () => ({ MarkdownEditor: () => null }));
vi.mock("../ProjectNotes", () => ({ ProjectNotes: () => null }));
vi.mock("../TaskDetailDrawer", () => ({ TaskDetailDrawer: () => null }));
vi.mock("../ConflictModal", () => ({ ConflictModal: () => null }));
vi.mock("../Toolbar", () => ({ Toolbar: () => null }));

let disk: Record<string, string> = {};
const writeFileMock = vi.fn(async (path: string, content: string) => { disk[path] = content; });
const readFileMock = vi.fn(async (p: string) => disk[p] ?? "");
vi.mock("../../lib/tauri-api", () => ({
  getInitialSession: vi.fn(),
  saveFileDialog: vi.fn(async () => null),
  readFile: (p: string) => readFileMock(p),
  writeFile: (p: string, c: string) => writeFileMock(p, c),
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

function Harness() {
  const undoHistory = useUndoHistory();
  const [activeId, setActiveId] = useState("A");
  // Mirror App: the active tab publishes its command bundle (race-safe register/unregister).
  const activeCmds = useRef<MutableRefObject<DocCommands> | null>(null);
  const publishCommands = useCallback((ref: MutableRefObject<DocCommands>) => {
    activeCmds.current = ref;
    return () => { if (activeCmds.current === ref) activeCmds.current = null; };
  }, []);
  return (
    <KeymapProvider>
      <button data-testid="to-A" onClick={() => setActiveId("A")}>A</button>
      <button data-testid="to-B" onClick={() => setActiveId("B")}>B</button>
      <button data-testid="global-reload" onClick={() => activeCmds.current?.current.reload()}>reload</button>
      {TABS.map((t) => (
        <div key={t.id} style={{ display: t.id === activeId ? "block" : "none" }}>
          <DocumentView
            tabId={t.id}
            filePath={t.filePath}
            kind={t.kind}
            active={t.id === activeId}
            darkMode={false}
            setTabs={() => {}}
            undoHistory={undoHistory}
            publishCommands={publishCommands}
          />
        </div>
      ))}
    </KeymapProvider>
  );
}

beforeEach(() => {
  disk = { "/a.md": "AAA plain body", "/b.md": "BBB plain body" };
  writeFileMock.mockClear();
  readFileMock.mockClear();
});

describe("DocumentView per-tab isolation (Zed-style buffer/view)", () => {
  it("routes each tab's edits to its own file, never cross-writing", async () => {
    render(<Harness />);

    await settle();
    const edA = await screen.findByTestId("qa-a");
    const edB = await screen.findByTestId("qa-b");
    await waitFor(() => expect((edA as HTMLTextAreaElement).value).toBe("AAA plain body"));
    await waitFor(() => expect((edB as HTMLTextAreaElement).value).toBe("BBB plain body"));

    // Edit tab A → persists to /a.md only.
    fireEvent.change(edA, { target: { value: "A EDITED" } });
    await flushDebounce();
    expect(disk["/a.md"]).toBe("A EDITED");
    expect(disk["/b.md"]).toBe("BBB plain body"); // untouched

    // Switch active to B, edit it → persists to /b.md only.
    act(() => { screen.getByTestId("to-B").click(); });
    await settle();
    fireEvent.change(edB, { target: { value: "B EDITED" } });
    await flushDebounce();
    expect(disk["/b.md"]).toBe("B EDITED");

    // A must never have received B's content (the original drift bug).
    expect(disk["/a.md"]).toBe("A EDITED");
    expect(writeFileMock.mock.calls.every(([p, c]) => !(p === "/a.md" && c.includes("B EDITED")))).toBe(true);
    expect(writeFileMock.mock.calls.every(([p, c]) => !(p === "/b.md" && c.includes("A EDITED")))).toBe(true);
  });

  it("publishes the active tab's command bundle — global reload acts on the focused file", async () => {
    render(<Harness />);
    await settle();

    // A is active → the published reload reloads /a.md (and not /b.md).
    readFileMock.mockClear();
    act(() => { screen.getByTestId("global-reload").click(); });
    await settle();
    expect(readFileMock).toHaveBeenCalledWith("/a.md");
    expect(readFileMock).not.toHaveBeenCalledWith("/b.md");

    // Switching tabs republishes — now reload acts on /b.md.
    act(() => { screen.getByTestId("to-B").click(); });
    await settle();
    readFileMock.mockClear();
    act(() => { screen.getByTestId("global-reload").click(); });
    await settle();
    expect(readFileMock).toHaveBeenCalledWith("/b.md");
    expect(readFileMock).not.toHaveBeenCalledWith("/a.md");
  });

  it("renders a raw-file tab as a self-contained RawFileEditor bound to its own path", async () => {
    render(<Harness />);
    await settle();
    expect(screen.getByTestId("raw-/c.txt")).toBeTruthy();
  });
});
