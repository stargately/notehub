import { useState, useRef, useCallback } from "react";
import { readFile, writeFile } from "../lib/tauri-api";

export interface FileConflict {
  /** Absolute path of the file whose disk and in-memory versions diverged. */
  path: string;
  /** Content currently on disk (e.g. written by Claude Code). */
  disk: string;
  /** Our unsaved in-memory content. */
  mine: string;
}

/**
 * Content-based reconciliation between NoteHub's in-memory editor and the file on
 * disk, so the app can be edited concurrently by a human and by an external tool
 * (Claude Code) writing the same `.md` file.
 *
 * Per path we track two things:
 *   - `baseline` — the exact string we believe is currently on disk (set on every
 *     load and every successful write). Used to detect our own write-echo and to tell
 *     whether the disk actually changed.
 *   - `dirty` — whether there are local edits not yet written to disk.
 *
 * Invariant (matching VS Code / IntelliJ): disk is the source of truth; a clean buffer
 * reloads live; a dirty buffer is never silently overwritten — the user is asked which
 * version to keep.
 */
export function useFileSync() {
  const baselineRef = useRef<Map<string, string>>(new Map());
  const dirtyRef = useRef<Map<string, boolean>>(new Map());
  // Paths with one of our own `writeFile`s currently in flight. While a write is mid-air, disk
  // still holds the OLD bytes but `baseline` already points at the NEW content (set before the
  // await so the write's own watcher event is recognized as an echo). A reconcile running in that
  // window would see `disk !== baseline` and misread our half-landed write as an external change —
  // live-reloading stale disk content into the editor, which remounts the WYSIWYG cell (scroll
  // jumps to the top) and reverts just-typed text. Reconcile skips while a write is in flight.
  const writesInFlightRef = useRef<Map<string, number>>(new Map());
  const [conflict, setConflict] = useState<FileConflict | null>(null);
  const conflictRef = useRef<FileConflict | null>(null);
  conflictRef.current = conflict;

  const beginWrite = useCallback((path: string) => {
    const m = writesInFlightRef.current;
    m.set(path, (m.get(path) ?? 0) + 1);
  }, []);
  const endWrite = useCallback((path: string) => {
    const m = writesInFlightRef.current;
    const n = (m.get(path) ?? 0) - 1;
    if (n > 0) m.set(path, n);
    else m.delete(path);
  }, []);

  /** Record that `path` now holds `content` both on disk and in memory (load or save). */
  const markLoaded = useCallback((path: string, content: string) => {
    baselineRef.current.set(path, content);
    dirtyRef.current.set(path, false);
  }, []);

  /**
   * Mark that `path` has local edits not yet flushed to disk. Call on every edit. Returns whether
   * the buffer is now genuinely dirty — callers use this to decide whether to schedule a write.
   *
   * Pass the new `content` when you have it (the editor paths do): a change that re-emits the
   * current baseline byte-for-byte is *not* a real edit — it's typically a WYSIWYG editor
   * re-serializing the content it was just handed (Milkdown fires `markdownUpdated` on its own
   * post-mount normalization, e.g. the trailing-paragraph plugin). Flagging the buffer dirty for
   * that would make the next external write raise a spurious "file changed on disk" conflict, so
   * we keep it clean (return `false`) and the caller cancels its pending write. Every edit path now
   * passes `content` — the editor paths (`useViewMode`/`useRawFile`) and the task-table path
   * (`useProjectFile.saveProject`, which serializes eagerly and compares). With no `content` we
   * conservatively flag dirty; `reconcile`'s `mine === baseline` guard is the backstop that keeps a
   * stale/over-eager dirty flag from turning an external write into a spurious conflict.
   *
   * Invariant this preserves: a pending debounced write exists only while `dirty` is true. That's
   * what lets a clean live-reload run without a stale write later clobbering the external change —
   * `guardedWrite`'s own guard can't catch a stale write once the reload has advanced the baseline.
   */
  const markDirty = useCallback((path: string, content?: string): boolean => {
    if (content !== undefined && content === baselineRef.current.get(path)) {
      dirtyRef.current.set(path, false);
      return false;
    }
    dirtyRef.current.set(path, true);
    return true;
  }, []);

  /**
   * The single chokepoint for writing watched files. Before writing it re-reads disk:
   * if disk moved out from under us since our last sync (and differs from what we're
   * about to write), it opens a conflict instead of clobbering the external change.
   * Returns true if written, false if a conflict was raised (caller should stop).
   */
  const guardedWrite = useCallback(async (path: string, content: string): Promise<boolean> => {
    if (conflictRef.current) return false; // a conflict is already pending — don't write
    let disk: string;
    try {
      disk = await readFile(path);
    } catch {
      // Can't read (e.g. file deleted) — fall back to a plain write.
      beginWrite(path);
      try {
        await writeFile(path, content);
      } finally {
        endWrite(path);
      }
      baselineRef.current.set(path, content);
      dirtyRef.current.set(path, false);
      return true;
    }
    const baseline = baselineRef.current.get(path);
    if (disk !== baseline && disk !== content) {
      setConflict({ path, disk, mine: content });
      return false;
    }
    // Set baseline before awaiting the write so the watcher event for our own write
    // (which may arrive before this promise resolves) is recognised as an echo.
    baselineRef.current.set(path, content);
    beginWrite(path);
    try {
      await writeFile(path, content);
    } finally {
      endWrite(path);
    }
    dirtyRef.current.set(path, false);
    return true;
  }, [beginWrite, endWrite]);

  /**
   * Handle an external `file-changed` event. `mine` is the bytes we would write right
   * now (for the dirty-conflict case) — pass a getter where possible: the disk read below is
   * async (and the watcher event may land between a keystroke and its React commit), so a plain
   * string can already be a keystroke stale by the time it's compared; a getter is evaluated
   * after the read, against the freshest buffer. `applyReload` re-reads and re-parses the file
   * into the active view (for the clean live-reload case).
   */
  const reconcile = useCallback(
    async (path: string, mineSource: string | (() => string), applyReload: () => void) => {
      if (conflictRef.current) return; // already resolving a conflict
      // One of our own writes is mid-air: disk is half-transitioned while baseline already points
      // at the new content, so comparing now would misread our own write as an external change and
      // live-reload stale disk content (remounting the editor → scroll jump + reverted typing).
      // Skip — the write's own watcher event re-runs reconcile once disk has settled (the
      // debouncer coalesces events but never drops them).
      if (writesInFlightRef.current.has(path)) return;
      let disk: string;
      try {
        disk = await readFile(path);
      } catch {
        return;
      }
      // The read was async — re-check in case a write started while it was in flight.
      if (writesInFlightRef.current.has(path)) return;
      const mine = typeof mineSource === "function" ? mineSource() : mineSource;
      const baseline = baselineRef.current.get(path);
      if (disk === baseline) return; // our own echo / no real change
      // Content-truthful convergence check: if the in-memory buffer already equals the new disk
      // content (e.g. Claude wrote exactly what we had), nothing diverged — adopt disk as the
      // baseline, drop the now-meaningless dirty flag, and don't bother reloading (the editor
      // already shows it). This kills a class of false-positive conflicts with no data loss.
      if (mine === disk) {
        baselineRef.current.set(path, disk);
        dirtyRef.current.set(path, false);
        return;
      }
      // Content-truthful "not editing" check: if the buffer still equals what we last loaded/wrote
      // (baseline), the user hasn't genuinely diverged it — a `dirty` flag set true without a real
      // user edit (e.g. the conservative task-table re-serialize, or a byte-changing WYSIWYG
      // normalization that later wrote itself back so baseline caught up) must not turn an external
      // write into a conflict. Adopt the new disk content and live-reload it, exactly like a clean
      // buffer (VS Code / IntelliJ: if local isn't editing, just load the latest disk). This guards
      // *only* `mine === baseline`; a genuine concurrent edit (`mine !== baseline && mine !== disk`)
      // still falls through to the conflict prompt below — no local edits are ever silently dropped.
      if (mine === baseline) {
        baselineRef.current.set(path, disk);
        dirtyRef.current.set(path, false);
        applyReload(); // NOT GENUINELY DIRTY → live reload
        return;
      }
      if (!dirtyRef.current.get(path)) {
        baselineRef.current.set(path, disk);
        applyReload(); // CLEAN → live reload
      } else {
        setConflict({ path, disk, mine }); // DIRTY + genuine divergence → ask the user
      }
    },
    []
  );

  /** Resolve a conflict by discarding local edits and loading the disk version. */
  const resolveKeepDisk = useCallback((applyReload: () => void) => {
    const c = conflictRef.current;
    if (!c) return;
    baselineRef.current.set(c.path, c.disk);
    dirtyRef.current.set(c.path, false);
    setConflict(null);
    applyReload();
  }, []);

  /** Resolve a conflict by overwriting disk with our in-memory version. */
  const resolveKeepMine = useCallback(async (): Promise<void> => {
    const c = conflictRef.current;
    if (!c) return;
    baselineRef.current.set(c.path, c.mine);
    dirtyRef.current.set(c.path, false);
    setConflict(null);
    try {
      beginWrite(c.path);
      try {
        await writeFile(c.path, c.mine);
      } finally {
        endWrite(c.path);
      }
    } catch {
      /* surfaced by callers' own save-error toasts */
    }
  }, [beginWrite, endWrite]);

  return {
    conflict,
    markLoaded,
    markDirty,
    guardedWrite,
    reconcile,
    resolveKeepDisk,
    resolveKeepMine,
  };
}

export type FileSync = ReturnType<typeof useFileSync>;
