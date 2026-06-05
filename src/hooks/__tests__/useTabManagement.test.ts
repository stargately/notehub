import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Controllable persisted session. Read lazily inside the mocked getters (so the factory may
// reference it before the `let` is assigned — the value is only read when the fn is called).
let session = { paths: [] as string[], activeIndex: 0 };
vi.mock("../../lib/tauri-api", () => ({
  isTauri: false,
  getWindowLabel: vi.fn(async () => "main"),
  getInitialSession: vi.fn(async () => session),
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
