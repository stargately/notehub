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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const text = await readTextFile(filePath);
      sync.markLoaded(filePath, text);
      setContent(text);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [filePath, sync]);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = useCallback(
    (next: string) => {
      setContent(next);
      sync.markDirty(filePath);
      if (saveTimer.current) clearTimeout(saveTimer.current);
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

  // Reconcile external changes to this file (clean → reload, dirty → conflict).
  const handleExternal = useCallback(() => {
    sync.reconcile(filePath, contentRef.current, load);
  }, [filePath, sync, load]);
  useFileWatcher(filePath, handleExternal);

  return { content, onChange, loading, error, reload: load };
}
