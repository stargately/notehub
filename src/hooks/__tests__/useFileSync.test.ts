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

  it("does not conflict when the in-memory buffer already equals the new disk content", async () => {
    // Convergence: the user has a pending edit, and Claude independently wrote the same bytes.
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));
    act(() => result.current.markDirty(PATH)); // dirty, no content

    diskContent = "SAME";
    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, "SAME", applyReload);
    });
    expect(result.current.conflict).toBeNull();
    expect(applyReload).not.toHaveBeenCalled(); // editor already shows it — no remount needed

    // Baseline was adopted + dirty cleared, so a later watcher tick is a no-op echo.
    diskContent = "SAME";
    await act(async () => {
      await result.current.reconcile(PATH, "SAME", applyReload);
    });
    expect(applyReload).not.toHaveBeenCalled();
    expect(result.current.conflict).toBeNull();
  });

  it("reloads (does not prompt) when a dirty flag is stale but the buffer equals baseline", async () => {
    // The core false-positive fix: the dirty flag was set true without a genuine user edit (the
    // buffer still equals what we loaded — `mine === baseline`). An external write must live-reload
    // silently, NOT raise a conflict. Encodes "if local isn't editing, just load the latest disk".
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));
    act(() => result.current.markDirty(PATH)); // flagged dirty without content → conservatively true

    diskContent = "EXTERNAL"; // Claude rewrote the file
    const applyReload = vi.fn();
    await act(async () => {
      // `mine` is still the loaded content "A" (no real edit) even though dirty === true.
      await result.current.reconcile(PATH, "A", applyReload);
    });
    expect(result.current.conflict).toBeNull(); // no modal
    expect(applyReload).toHaveBeenCalledTimes(1); // live-reloaded latest disk

    // Baseline advanced + dirty cleared, so a later watcher tick for the same bytes is a no-op echo.
    diskContent = "EXTERNAL";
    applyReload.mockClear();
    await act(async () => {
      await result.current.reconcile(PATH, "EXTERNAL", applyReload);
    });
    expect(applyReload).not.toHaveBeenCalled();
    expect(result.current.conflict).toBeNull();
  });

  it("task-table no-edit reload: a re-serialize matching baseline never prompts on an external write", async () => {
    // Simulates the `layout: todo` path: a programmatic re-serialize re-emits the on-disk bytes, so
    // content-aware markDirty keeps it clean; an external write then live-reloads instead of conflicting.
    diskContent = "TABLE";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "TABLE"));
    let dirty: boolean | undefined;
    act(() => { dirty = result.current.markDirty(PATH, "TABLE"); }); // serialize === baseline
    expect(dirty).toBe(false); // not a real edit → caller skips its write

    diskContent = "EXTERNAL";
    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, "TABLE", applyReload);
    });
    expect(result.current.conflict).toBeNull();
    expect(applyReload).toHaveBeenCalledTimes(1);
  });

  it("still conflicts on a genuine concurrent edit (buffer diverged from both baseline and disk)", async () => {
    // Guardrail: the `mine === baseline` short-circuit must NOT swallow a real conflict. Here the user
    // genuinely edited (mine !== baseline) and Claude wrote something else (mine !== disk).
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));
    act(() => { result.current.markDirty(PATH, "MINE"); }); // real edit

    diskContent = "EXTERNAL";
    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, "MINE", applyReload);
    });
    expect(applyReload).not.toHaveBeenCalled();
    expect(result.current.conflict).toEqual({ path: PATH, disk: "EXTERNAL", mine: "MINE" });
  });

  it("content-aware markDirty: a baseline re-emit stays clean and reports not-dirty", async () => {
    // A WYSIWYG re-emit of the on-disk bytes (content === baseline) is not a real edit: markDirty
    // returns false (so the caller cancels its pending write) and a following external change
    // live-reloads cleanly instead of raising a conflict.
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));
    let dirty: boolean | undefined;
    act(() => { dirty = result.current.markDirty(PATH, "A"); }); // re-emit of the baseline
    expect(dirty).toBe(false);

    diskContent = "EXTERNAL";
    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, "A", applyReload);
    });
    expect(applyReload).toHaveBeenCalledTimes(1);
    expect(result.current.conflict).toBeNull();
  });

  it("content-aware markDirty: a genuine edit reports dirty and still conflicts", async () => {
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));
    let dirty: boolean | undefined;
    act(() => { dirty = result.current.markDirty(PATH, "MINE"); }); // real edit (differs from baseline)
    expect(dirty).toBe(true);

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

  it("ignores a watcher event that lands while our own write is in flight (no reload, no remount)", async () => {
    // The scroll-jump regression: `guardedWrite` sets the baseline BEFORE awaiting the write (so
    // the write's own event reads as an echo), which opens a window where disk holds the old bytes
    // but baseline holds the new ones. A watcher event from a PREVIOUS write landing in that window
    // used to read disk !== baseline, pass the `mine === baseline` check, and live-reload the STALE
    // disk content — remounting the WYSIWYG editor (scroll to top) and reverting just-typed text.
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));

    // Make the write hang so we can interleave a reconcile mid-flight.
    let finishWrite!: () => void;
    writeFileMock.mockImplementationOnce(
      (_path: string, content: string) =>
        new Promise<void>((resolve) => {
          finishWrite = () => {
            diskContent = content;
            resolve();
          };
        })
    );

    let writePromise!: Promise<boolean>;
    await act(async () => {
      writePromise = result.current.guardedWrite(PATH, "B");
      // Let guardedWrite's pre-read resolve and the (hanging) writeFile start.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(diskContent).toBe("A"); // write still in flight

    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, "B", applyReload); // watcher event mid-write
    });
    expect(applyReload).not.toHaveBeenCalled(); // no stale-disk reload
    expect(result.current.conflict).toBeNull();

    await act(async () => {
      finishWrite();
      await writePromise;
    });
    expect(diskContent).toBe("B");

    // The write's own follow-up event is a clean echo (baseline survived untouched)…
    await act(async () => {
      await result.current.reconcile(PATH, "B", applyReload);
    });
    expect(applyReload).not.toHaveBeenCalled();
    expect(result.current.conflict).toBeNull();

    // …and a later genuine external change still live-reloads (the guard cleared).
    diskContent = "EXTERNAL";
    await act(async () => {
      await result.current.reconcile(PATH, "B", applyReload);
    });
    expect(applyReload).toHaveBeenCalledTimes(1);
    expect(result.current.conflict).toBeNull();
  });

  it("accepts a getter for `mine`, evaluated after the disk read (freshest buffer wins)", async () => {
    // A watcher event can land between a keystroke and its React commit; passing a getter lets
    // reconcile see the post-keystroke buffer. Here the buffer diverges from baseline AND disk by
    // the time the getter runs → a genuine conflict (not a silent reload over the user's edit).
    diskContent = "A";
    const { result } = renderHook(() => useFileSync());
    act(() => result.current.markLoaded(PATH, "A"));
    act(() => result.current.markDirty(PATH, "A typed"));

    diskContent = "EXTERNAL";
    const applyReload = vi.fn();
    await act(async () => {
      await result.current.reconcile(PATH, () => "A typed", applyReload);
    });
    expect(applyReload).not.toHaveBeenCalled();
    expect(result.current.conflict).toEqual({ path: PATH, disk: "EXTERNAL", mine: "A typed" });
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
