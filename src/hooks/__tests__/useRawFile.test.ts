import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("../useFileWatcher", () => ({ useFileWatcher: () => {} }));

let disk: Record<string, string> = {};
let hung: Map<string, (v: string) => void> = new Map();
const hangPaths = new Set<string>();
const readTextFileMock = vi.fn((path: string): Promise<string> => {
  if (hangPaths.has(path)) return new Promise<string>((res) => hung.set(path, res));
  return Promise.resolve(disk[path] ?? "");
});
vi.mock("../../lib/tauri-api", () => ({
  readTextFile: (p: string) => readTextFileMock(p),
}));

import { useRawFile } from "../useRawFile";
import type { FileSync } from "../useFileSync";

const guardedWriteMock = vi.fn(async (_p: string, _c: string) => true);
const sync = {
  markLoaded: vi.fn(),
  // Real markDirty returns whether the buffer is genuinely dirty; these edits always differ from
  // the loaded content, so it's true (and the caller schedules the write).
  markDirty: vi.fn(() => true),
  guardedWrite: (p: string, c: string) => guardedWriteMock(p, c),
  reconcile: vi.fn(),
  conflict: null,
  resolveKeepDisk: vi.fn(),
  resolveKeepMine: vi.fn(),
} as unknown as FileSync;

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const flushDebounce = () => act(async () => { await new Promise((r) => setTimeout(r, 350)); });

beforeEach(() => {
  disk = { "/a.ts": "A SOURCE", "/b.ts": "B SOURCE" };
  hung = new Map();
  hangPaths.clear();
  guardedWriteMock.mockClear();
  readTextFileMock.mockClear();
});

describe("useRawFile tab-content isolation", () => {
  it("writes edits back to the loaded file", async () => {
    const { result } = renderHook(() => useRawFile("/a.ts", sync));
    await settle();
    expect(result.current.content).toBe("A SOURCE");

    act(() => result.current.onChange("A EDITED"));
    await flushDebounce();
    expect(guardedWriteMock).toHaveBeenCalledTimes(1);
    expect(guardedWriteMock.mock.calls[0]).toEqual(["/a.ts", "A EDITED"]);
  });

  it("does not write one file's edits onto another mid-switch", async () => {
    const { result, rerender } = renderHook(({ p }) => useRawFile(p, sync), {
      initialProps: { p: "/a.ts" },
    });
    await settle();

    // Switch to B while B's read hangs: content is still A's, loadedPath still /a.ts.
    hangPaths.add("/b.ts");
    rerender({ p: "/b.ts" });
    await settle();
    act(() => result.current.onChange("EDIT WHILE LOADING"));
    await flushDebounce();
    expect(guardedWriteMock).not.toHaveBeenCalled();

    // Once B loads, edits persist to /b.ts.
    hangPaths.delete("/b.ts");
    act(() => hung.get("/b.ts")!(disk["/b.ts"]));
    await settle();
    act(() => result.current.onChange("B EDITED"));
    await flushDebounce();
    expect(guardedWriteMock).toHaveBeenCalledTimes(1);
    expect(guardedWriteMock.mock.calls[0]).toEqual(["/b.ts", "B EDITED"]);
  });
});
