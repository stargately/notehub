import { useState, useEffect, useRef, useCallback } from "react";
import { readTextFile } from "../lib/tauri-api";
import { useFileWatcher } from "./useFileWatcher";
import type { FileSync } from "./useFileSync";
import { toast } from "sonner";

/**
 * Load and autosave an arbitrary (non-markdown) text file for the raw editor. Reuses the
 * shared `FileSync` baseline/conflict machinery so co-editing with an external tool behaves
 * exactly like the markdown editors (clean buffer live-reloads; dirty buffer raises a
 * conflict). Edits are written through the debounced `guardedWrite` chokepoint.
 */
export function useRawFile(filePath: string, sync: FileSync) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef("");
  contentRef.current = content;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The path `content` was loaded from, and a generation token to drop out-of-order reads.
  // This component is reused across tabs, so `content` lags `filePath` right after a switch;
  // writes are gated on these so one file's text can never be saved onto another.
  const loadedPathRef = useRef<string | null>(null);
  const loadGenRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current;
    setLoading(true);
    try {
      const text = await readTextFile(filePath);
      if (loadGenRef.current !== gen) return; // superseded by a newer load
      sync.markLoaded(filePath, text);
      loadedPathRef.current = filePath;
      setContent(text);
      setError(null);
    } catch (e) {
      if (loadGenRef.current !== gen) return;
      setError(String(e));
    } finally {
      if (loadGenRef.current === gen) setLoading(false);
    }
  }, [filePath, sync]);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = useCallback(
    (next: string) => {
      // Ignore edits until this file's content has actually loaded for `filePath` (mid
      // tab-switch the editor still shows the previous file) — writing now would drift.
      if (loadedPathRef.current !== filePath) return;
      contentRef.current = next; // keep the reconcile-time view of the buffer fresh
      setContent(next);
      // Pass `next` so an editor re-emit of the on-disk bytes isn't treated as a real edit. When
      // it isn't a real edit, cancel any pending write and skip scheduling — a stale write that
      // survives a clean live-reload could otherwise clobber an external change.
      const dirty = sync.markDirty(filePath, next);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
      }
      if (!dirty) return;
      saveTimer.current = setTimeout(async () => {
        try {
          await sync.guardedWrite(filePath, next);
        } catch {
          toast.error("Failed to save file", { id: "raw-save-error" });
        }
      }, 300);
    },
    [filePath, sync],
  );

  // Reconcile external changes to this file (clean → reload, dirty → conflict). `mine` is a
  // getter so reconcile compares against the freshest buffer after its async disk read.
  const handleExternal = useCallback(() => {
    sync.reconcile(filePath, () => contentRef.current, load);
  }, [filePath, sync, load]);
  useFileWatcher(filePath, handleExternal);

  return { content, onChange, loading, error, reload: load };
}
