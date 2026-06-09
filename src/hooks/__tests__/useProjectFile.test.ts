import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// The default new-document template — a `layout: todo` task board. This is what gets
// loaded whenever filePath is null, and the content that must NEVER leak onto a real file.
const TEMPLATE = `---
project: "Untitled Project"
layout: todo
---

## Tasks

| Id | Title |
| --- | --- |

## Notes
`;

// Controllable mock disk. A path in `hangPaths` returns a promise we resolve by hand, so a
// test can hold a file's load "in flight" and exercise the stale-data window deterministically.
let disk: Record<string, string> = {};
let hung: Map<string, (v: string) => void> = new Map();
const hangPaths = new Set<string>();

const writeFileMock = vi.fn(async (path: string, content: string) => {
  disk[path] = content;
});
const readFileMock = vi.fn((path: string): Promise<string> => {
  if (hangPaths.has(path)) return new Promise<string>((res) => hung.set(path, res));
  return Promise.resolve(disk[path] ?? "");
});

vi.mock("../../lib/tauri-api", () => ({
  getInitialSession: vi.fn(),
  readFile: (p: string) => readFileMock(p),
  writeFile: (p: string, c: string) => writeFileMock(p, c),
  getDefaultProjectContent: () => TEMPLATE,
}));

import { useProjectFile } from "../useProjectFile";
import type { FileSync } from "../useFileSync";

// A stub FileSync whose markDirty verdict is scripted, so we can assert saveProject's content-aware
// wiring (passes the serialized content, skips the write when not dirty) without depending on
// whether serializeProjectMd round-trips the template byte-for-byte.
function stubSync(markDirtyReturns: boolean) {
  const markDirty = vi.fn((_path: string, _content?: string) => markDirtyReturns);
  const guardedWrite = vi.fn(async (_path: string, _content: string) => true);
  const sync = {
    conflict: null,
    markLoaded: vi.fn(),
    markDirty,
    guardedWrite,
    reconcile: vi.fn(),
    resolveKeepDisk: vi.fn(),
    resolveKeepMine: vi.fn(async () => {}),
  } as unknown as FileSync;
  return { sync, markDirty, guardedWrite };
}

// Flush the load chain (await readFile → setState → effects).
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
// Outlast the 300ms autosave debounce.
const flushDebounce = () => act(async () => { await new Promise((r) => setTimeout(r, 350)); });

const todo = (name: string) => TEMPLATE.replace("Untitled Project", name);

beforeEach(() => {
  disk = {};
  hung = new Map();
  hangPaths.clear();
  writeFileMock.mockClear();
  readFileMock.mockClear();
});

describe("useProjectFile stale-data guard", () => {
  it("writes edits back to the file they were loaded from", async () => {
    disk["/a.md"] = todo("A");
    const { result } = renderHook(() => useProjectFile("/a.md"));
    await settle();
    expect(result.current.loadedPath).toBe("/a.md");

    act(() => result.current.saveProject({ ...result.current.projectData!, notes: "EDIT-A" }));
    await flushDebounce();

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock.mock.calls[0][0]).toBe("/a.md");
    expect(writeFileMock.mock.calls[0][1]).toContain("EDIT-A");
  });

  it("never writes the default template onto a real file (null → real switch)", async () => {
    const { result, rerender } = renderHook(({ p }) => useProjectFile(p), {
      initialProps: { p: null as string | null },
    });
    await settle();
    // Untitled tab: the template is in memory but loadedPath is null.
    expect(result.current.loadedPath).toBeNull();
    expect(result.current.projectData?.meta.project).toBe("Untitled Project");

    // Switch to a real file whose read is still in flight.
    hangPaths.add("/real.md");
    rerender({ p: "/real.md" });
    await settle();

    // A spurious save in this window (e.g. a grid event firing before the load lands) must
    // not persist the template — that's the "Untitled Project" overwrite bug.
    act(() => result.current.saveProject({ ...result.current.projectData! }));
    await flushDebounce();

    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("does not write one file's data onto another mid-switch (cross-tab drift)", async () => {
    disk["/a.md"] = todo("A");
    disk["/b.md"] = todo("B");
    const { result, rerender } = renderHook(({ p }) => useProjectFile(p), {
      initialProps: { p: "/a.md" as string | null },
    });
    await settle();
    expect(result.current.loadedPath).toBe("/a.md");

    // Switch to B while B's read hangs: projectData is still A's, loadedPath still /a.md.
    hangPaths.add("/b.md");
    rerender({ p: "/b.md" });
    await settle();
    act(() => result.current.saveProject({ ...result.current.projectData!, notes: "FROM-A" }));
    await flushDebounce();
    expect(writeFileMock).not.toHaveBeenCalled(); // A's content must not land on /b.md

    // Once B finishes loading, saves go to /b.md as normal.
    hangPaths.delete("/b.md");
    act(() => hung.get("/b.md")!(disk["/b.md"]));
    await settle();
    expect(result.current.loadedPath).toBe("/b.md");

    act(() => result.current.saveProject({ ...result.current.projectData!, notes: "FROM-B" }));
    await flushDebounce();
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock.mock.calls[0][0]).toBe("/b.md");
    expect(writeFileMock.mock.calls[0][1]).toContain("FROM-B");
  });

  it("content-aware dirty: passes the serialized content to markDirty and skips the write when not dirty", async () => {
    // The task-table false-dirty fix: a re-serialize that matches the on-disk baseline (markDirty
    // → false) is not a real edit, so no guarded write is scheduled — the next external write can
    // live-reload instead of raising a spurious conflict.
    disk["/a.md"] = todo("A");
    const { sync, markDirty, guardedWrite } = stubSync(false);
    const { result } = renderHook(() => useProjectFile("/a.md", undefined, undefined, sync));
    await settle();

    act(() => result.current.saveProject({ ...result.current.projectData! }));
    await flushDebounce();

    expect(markDirty).toHaveBeenCalled();
    const lastCall = markDirty.mock.calls[markDirty.mock.calls.length - 1];
    expect(lastCall[0]).toBe("/a.md");
    expect(typeof lastCall[1]).toBe("string"); // content passed, not undefined
    expect(guardedWrite).not.toHaveBeenCalled(); // not dirty → no write
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("content-aware dirty: a genuine edit (markDirty true) still schedules a guarded write", async () => {
    disk["/a.md"] = todo("A");
    const { sync, guardedWrite } = stubSync(true);
    const { result } = renderHook(() => useProjectFile("/a.md", undefined, undefined, sync));
    await settle();

    act(() => result.current.saveProject({ ...result.current.projectData!, notes: "EDIT" }));
    await flushDebounce();

    expect(guardedWrite).toHaveBeenCalledTimes(1);
    expect(guardedWrite.mock.calls[0][0]).toBe("/a.md");
    expect(guardedWrite.mock.calls[0][1]).toContain("EDIT");
  });

  it("cancels a pending autosave on unmount (closing a tab can't recreate a deleted file)", async () => {
    disk["/a.md"] = todo("A");
    const { result, unmount } = renderHook(() => useProjectFile("/a.md"));
    await settle();

    act(() => result.current.saveProject({ ...result.current.projectData!, notes: "EDIT" }));
    unmount(); // tab closed before the 300ms debounce fires
    await flushDebounce();

    expect(writeFileMock).not.toHaveBeenCalled();
  });
});
