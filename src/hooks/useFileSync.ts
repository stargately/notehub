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
  const [conflict, setConflict] = useState<FileConflict | null>(null);
  const conflictRef = useRef<FileConflict | null>(null);
  conflictRef.current = conflict;

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
   * we keep it clean (return `false`) and the caller cancels its pending write. With no `content`
   * (task-table edits, whose serialization needn't round-trip the on-disk bytes) we conservatively
   * flag dirty.
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
      await writeFile(path, content);
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
    await writeFile(path, content);
    dirtyRef.current.set(path, false);
    return true;
  }, []);

  /**
   * Handle an external `file-changed` event. `mine` is the bytes we would write right
   * now (for the dirty-conflict case); `applyReload` re-reads and re-parses the file
   * into the active view (for the clean live-reload case).
   */
  const reconcile = useCallback(
    async (path: string, mine: string, applyReload: () => void) => {
      if (conflictRef.current) return; // already resolving a conflict
      let disk: string;
      try {
        disk = await readFile(path);
      } catch {
        return;
      }
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
      await writeFile(c.path, c.mine);
    } catch {
      /* surfaced by callers' own save-error toasts */
    }
  }, []);

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
