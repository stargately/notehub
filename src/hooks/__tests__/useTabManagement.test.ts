import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Controllable backend state. Read lazily inside the mocked getters (so the factory may
// reference them before the `let`s are assigned — values are only read when the fn is called).
let session = { paths: [] as string[], activeIndex: 0 };
let windowLabel = "main";
let windowFiles: string[] = [];
const detachTabMock = vi.fn(async (_p: string, _x: number, _y: number) => "workspace-9");
vi.mock("../../lib/tauri-api", () => ({
  isTauri: false,
  getWindowLabel: vi.fn(async () => windowLabel),
  getInitialSession: vi.fn(async () => session),
  getWindowFiles: vi.fn(async () => windowFiles),
  detachTab: (p: string, x: number, y: number) => detachTabMock(p, x, y),
  canonicalizePath: vi.fn(async (p: string) => p),
  saveSession: vi.fn(async () => {}),
  noteRecentDocument: vi.fn(async () => {}),
  startWatching: vi.fn(async () => {}),
  isDirectory: vi.fn(async () => false),
  openFileDialog: vi.fn(async () => null),
  readFile: vi.fn(async () => ""),
  writeFile: vi.fn(async () => {}),
  getDefaultProjectContent: () => "",
}));

import { useTabManagement } from "../useTabManagement";

beforeEach(() => {
  session = { paths: [], activeIndex: 0 };
  windowLabel = "main";
  windowFiles = [];
  detachTabMock.mockClear();
  detachTabMock.mockResolvedValue("workspace-9");
});

describe("useTabManagement — startup & close (no auto untitled doc)", () => {
  it("starts with no tabs when the session is empty (never auto-opens untitled-todo.md)", async () => {
    const { result } = renderHook(() => useTabManagement({}));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabId).toBe("");
    expect(result.current.activeFilePath).toBeNull();
  });

  it("restores the persisted session tabs and active index", async () => {
    session = { paths: ["/x.md", "/y.md"], activeIndex: 1 };
    const { result } = renderHook(() => useTabManagement({}));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(result.current.tabs.map((t) => t.filePath)).toEqual(["/x.md", "/y.md"]);
    expect(result.current.activeFilePath).toBe("/y.md");
  });

  it("allows closing the last tab — falls back to the empty/welcome state", async () => {
    session = { paths: ["/only.md"], activeIndex: 0 };
    const { result } = renderHook(() => useTabManagement({}));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(result.current.tabs).toHaveLength(1);

    const id = result.current.tabs[0].id;
    act(() => result.current.handleCloseTab(id));

    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabId).toBe("");
    expect(result.current.activeFilePath).toBeNull();
  });
});

describe("useTabManagement — tab tear-off", () => {
  it("a spawned (torn-off) window opens the file(s) handed to it", async () => {
    windowLabel = "workspace-2";
    windowFiles = ["/torn.md"];
    const { result } = renderHook(() => useTabManagement({}));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(result.current.tabs.map((t) => t.filePath)).toEqual(["/torn.md"]);
    expect(result.current.activeFilePath).toBe("/torn.md");
  });

  it("a spawned window with no handed files starts empty (folder-workspace regression)", async () => {
    windowLabel = "workspace-3";
    windowFiles = [];
    const { result } = renderHook(() => useTabManagement({}));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    expect(result.current.tabs).toEqual([]);
    expect(result.current.activeTabId).toBe("");
  });

  it("detachTab moves the tab: spawns the window, then closes it here", async () => {
    session = { paths: ["/a.md", "/b.md"], activeIndex: 0 };
    const { result } = renderHook(() => useTabManagement({}));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    const id = result.current.tabs[0].id;

    await act(async () => {
      await result.current.detachTab(id, 50, 60);
    });

    expect(detachTabMock).toHaveBeenCalledWith("/a.md", 50, 60);
    expect(result.current.tabs.map((t) => t.filePath)).toEqual(["/b.md"]);
  });

  it("detachTab keeps the tab if the new window fails to build", async () => {
    session = { paths: ["/a.md", "/b.md"], activeIndex: 0 };
    detachTabMock.mockRejectedValueOnce(new Error("build failed"));
    const { result } = renderHook(() => useTabManagement({}));
    await waitFor(() => expect(result.current.initialized).toBe(true));
    const id = result.current.tabs[0].id;

    await act(async () => {
      await result.current.detachTab(id, 50, 60);
    });

    expect(result.current.tabs.map((t) => t.filePath)).toEqual(["/a.md", "/b.md"]);
  });
});
