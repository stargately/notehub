import { useCallback, useEffect, useRef } from "react";
import { listWorkspaceFiles } from "../lib/tauri-api";
import { subscribeAll } from "../lib/tree-refresh";
import type { FileEntry } from "../lib/types";

/**
 * Lazily-fetched, ref-cached recursive file index for the Cmd+P quick-open finder.
 *
 * The index is fetched the first time `ensureIndex()` is called (i.e. when the palette opens), not
 * on mount and not per keystroke. It is invalidated when any file changes on disk (via the shared
 * `file-changed` watcher) or when the workspace root changes, so the next open refetches.
 */
export function useFileIndex(workspaceRoot: string | null) {
  const cache = useRef<FileEntry[] | null>(null);
  const inflight = useRef<Promise<FileEntry[]> | null>(null);

  const invalidate = useCallback(() => {
    cache.current = null;
    inflight.current = null;
  }, []);

  // Drop the cache on any external change and whenever the root changes.
  useEffect(() => {
    invalidate();
    return subscribeAll(invalidate);
  }, [workspaceRoot, invalidate]);

  const ensureIndex = useCallback(async (): Promise<FileEntry[]> => {
    if (cache.current) return cache.current;
    if (!workspaceRoot) return [];
    if (!inflight.current) {
      inflight.current = listWorkspaceFiles(workspaceRoot)
        .then((files) => {
          cache.current = files;
          return files;
        })
        .catch(() => {
          inflight.current = null;
          return [];
        });
    }
    return inflight.current;
  }, [workspaceRoot]);

  return { ensureIndex, invalidate };
}
