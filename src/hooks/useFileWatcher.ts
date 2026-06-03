import { useEffect } from "react";
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
        // Echo suppression (is this our own write?) is now content-based, handled by
        // the reconcile callback comparing disk against the per-path baseline.
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
