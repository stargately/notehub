import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const writeFileMock = vi.fn(async (_path: string, _content: string) => {});
vi.mock("../../lib/tauri-api", () => ({
  saveFileDialog: vi.fn(async () => null),
  writeFile: (p: string, c: string) => writeFileMock(p, c),
}));

import { useViewMode } from "../useViewMode";
import { parseProjectMd } from "../../lib/markdown-parser";

// A plain markdown doc (no `layout`) → edited as raw via the QaLayout/Monaco path.
const docA = parseProjectMd("AAA — file A body");
const docB = parseProjectMd("BBB — file B body");

const base = {
  replaceFromRaw: () => true,
  flushSave: vi.fn(),
  setTabs: vi.fn(),
  setSelectedTaskId: vi.fn(),
  setShowNotes: vi.fn(),
  undoHistory: undefined,
  sync: undefined,
};

const flushDebounce = () => act(async () => { await new Promise((r) => setTimeout(r, 350)); });

beforeEach(() => writeFileMock.mockClear());

describe("useViewMode tab-content isolation", () => {
  it("does not seed the active tab's editor from another file's projectData", async () => {
    // Active tab is B, but projectData/loadedPath still belong to A (load in flight).
    const { result, rerender } = renderHook((props) => useViewMode(props), {
      initialProps: { ...base, activeTabId: "tabB", activeFilePath: "/b.md", projectData: docA, loadedPath: "/a.md" },
    });
    // Not synced → the editor for tab B must NOT pick up A's text.
    expect(result.current.editorContent).toBe("");

    // B finishes loading → now seed from B's content.
    rerender({ ...base, activeTabId: "tabB", activeFilePath: "/b.md", projectData: docB, loadedPath: "/b.md" });
    expect(result.current.editorContent).toBe("BBB — file B body");
  });

  it("ignores editor echoes until the active file is loaded, then writes to it", async () => {
    const { result, rerender } = renderHook((props) => useViewMode(props), {
      initialProps: { ...base, activeTabId: "tabB", activeFilePath: "/b.md", projectData: docA, loadedPath: "/a.md" },
    });

    // The WYSIWYG editor re-emits content on remount; while unsynced this carries the previous
    // file's text. It must not be written to /b.md.
    act(() => result.current.handleEditorChange("ECHO OF A"));
    await flushDebounce();
    expect(writeFileMock).not.toHaveBeenCalled();

    // Once B is loaded, a genuine edit persists to /b.md.
    rerender({ ...base, activeTabId: "tabB", activeFilePath: "/b.md", projectData: docB, loadedPath: "/b.md" });
    act(() => result.current.handleEditorChange("REAL EDIT IN B"));
    await flushDebounce();
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock.mock.calls[0][0]).toBe("/b.md");
    expect(writeFileMock.mock.calls[0][1]).toBe("REAL EDIT IN B");
  });

  it("cancels a pending editor autosave on unmount (tab close can't recreate a deleted file)", async () => {
    const { result, unmount } = renderHook((props) => useViewMode(props), {
      initialProps: { ...base, activeTabId: "tabB", activeFilePath: "/b.md", projectData: docB, loadedPath: "/b.md" },
    });

    act(() => result.current.handleEditorChange("EDIT THEN CLOSE"));
    unmount(); // closes the tab before the 300ms debounce fires
    await flushDebounce();

    expect(writeFileMock).not.toHaveBeenCalled();
  });
});
