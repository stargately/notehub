import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Controllable mock of the disk.
let diskContent = "";
const writeFileMock = vi.fn(async (_path: string, content: string) => {
  diskContent = content;
});
vi.mock("../../lib/tauri-api", () => ({
  readFile: vi.fn(async () => diskContent),
  writeFile: (path: string, content: string) => writeFileMock(path, content),
}));

import { useFileSync } from "../useFileSync";

const PATH = "/tmp/doc.md";

beforeEach(() => {
  diskContent = "";
  writeFileMock.mockClear();
});

describe("useFileSync reconciliation", () => {
  it("suppresses the echo of our own write (no reload, no conflict)", async () => {
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));

    // We write B; baseline becomes B and disk becomes B.
    await act(async () => {
      await result.current.guardedWrite(PATH, "B");
    });
    expect(diskContent).toBe("B");

    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, "B", applyReload);
    });
    expect(applyReload).not.toHaveBeenCalled();
    expect(result.current.conflict).toBeNull();
  });

  it("live-reloads a clean buffer when disk changes externally", async () => {
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));

    diskContent = "EXTERNAL"; // Claude wrote the file
    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, "A", applyReload);
    });
    expect(applyReload).toHaveBeenCalledTimes(1);
    expect(result.current.conflict).toBeNull();
  });

  it("raises a conflict when a dirty buffer collides with an external change", async () => {
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));
    act(() => result.current.markDirty(PATH)); // user is mid-edit

    diskContent = "EXTERNAL";
    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, "MINE", applyReload);
    });
    expect(applyReload).not.toHaveBeenCalled();
    expect(result.current.conflict).toEqual({ path: PATH, disk: "EXTERNAL", mine: "MINE" });
  });

  it("guardedWrite refuses to clobber an external change and raises a conflict", async () => {
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));

    diskContent = "EXTERNAL"; // disk moved under us since last sync
    await act(async () => {
      const wrote = await result.current.guardedWrite(PATH, "MINE");
      expect(wrote).toBe(false);
    });
    expect(writeFileMock).not.toHaveBeenCalled();
    expect(diskContent).toBe("EXTERNAL"); // not clobbered
    expect(result.current.conflict).toEqual({ path: PATH, disk: "EXTERNAL", mine: "MINE" });
  });

  it("guardedWrite proceeds when disk already equals what we'd write (convergence)", async () => {
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));

    diskContent = "SAME";
    await act(async () => {
      const wrote = await result.current.guardedWrite(PATH, "SAME");
      expect(wrote).toBe(true);
    });
    expect(result.current.conflict).toBeNull();
  });

  it("resolveKeepDisk discards local edits and reloads", async () => {
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));
    act(() => result.current.markDirty(PATH));

    diskContent = "EXTERNAL";
    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, "MINE", applyReload);
    });
    expect(result.current.conflict).not.toBeNull();

    act(() => result.current.resolveKeepDisk(applyReload));
    expect(applyReload).toHaveBeenCalledTimes(1);
    expect(result.current.conflict).toBeNull();
  });

  it("resolveKeepMine overwrites disk with our version", async () => {
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));
    act(() => result.current.markDirty(PATH));

    diskContent = "EXTERNAL";
    await act(async () => {
      await result.current.reconcile(PATH, "MINE", vi.fn());
    });

    await act(async () => {
      await result.current.resolveKeepMine();
    });
    expect(diskContent).toBe("MINE");
    expect(result.current.conflict).toBeNull();

    // A subsequent watcher event for our own write is now an echo → ignored.
    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, "MINE", applyReload);
    });
    expect(applyReload).not.toHaveBeenCalled();
  });
});
