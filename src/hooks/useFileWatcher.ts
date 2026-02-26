import { useEffect } from "react";
import { isWriteLocked } from "../lib/tauri-api";
import type { FileChangedPayload } from "../lib/types";

const isTauri = !!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

export function useFileWatcher(
  filePath: string | null,
  onFileChanged: () => void
) {
  useEffect(() => {
    if (!filePath || !isTauri) return;

    let cleanup: (() => void) | undefined;

    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<FileChangedPayload>("file-changed", (event) => {
        const { path } = event.payload;
        if (path !== filePath) return;
        if (isWriteLocked(path)) return;
        onFileChanged();
      }).then((unlisten) => {
        cleanup = unlisten;
      });
    });

    return () => {
      cleanup?.();
    };
  }, [filePath, onFileChanged]);
}
