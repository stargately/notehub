import { useState, useCallback, useRef, useEffect } from "react";
import type { ProjectData, TabInfo, ViewMode } from "../lib/types";
import { serializeProjectMd } from "../lib/markdown-parser";
import { saveFileDialog, writeFile } from "../lib/tauri-api";
import { toast } from "sonner";
import type { UndoHistory } from "./useUndoHistory";
import type { FileSync } from "./useFileSync";

interface UseViewModeOptions {
  activeTabId: string;
  activeFilePath: string | null;
  projectData: ProjectData | null;
  /** Path `projectData` was actually loaded from; mid tab-switch it lags `activeFilePath`. */
  loadedPath: string | null;
  replaceFromRaw: (raw: string) => boolean;
  flushSave: () => void;
  setTabs: React.Dispatch<React.SetStateAction<TabInfo[]>>;
  setSelectedTaskId: (id: string | null) => void;
  setShowNotes: (show: boolean) => void;
  undoHistory?: UndoHistory;
  sync?: FileSync;
}

export function useViewMode({
  activeTabId, activeFilePath, projectData, loadedPath,
  replaceFromRaw, flushSave, setTabs,
  setSelectedTaskId, setShowNotes, undoHistory, sync,
}: UseViewModeOptions) {
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const [viewModeMap, setViewModeMap] = useState<Record<string, ViewMode>>({});
  const [editorContentMap, setEditorContentMap] = useState<Record<string, string>>({});

  const viewMode = viewModeMap[activeTabId] ?? "grid";
  const editorContent = editorContentMap[activeTabId] ?? "";

  // `projectData` belongs to `activeFilePath` only once the load for this tab has landed.
  // Until then (mid tab-switch, or the null-path template window) it still holds the previous
  // file's data, so we must not seed this tab's editor from it nor write it back to disk.
  const synced = loadedPath === activeFilePath;

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeMap((prev) => ({ ...prev, [activeTabId]: mode }));
  }, [activeTabId]);

  const setEditorContent = useCallback((content: string) => {
    setEditorContentMap((prev) => ({ ...prev, [activeTabId]: content }));
  }, [activeTabId]);

  // "raw unless todo": `layout: qa` and plain (no-layout) docs are edited as raw markdown.
  // Only `layout: todo` round-trips through the task serializer.
  const isRawDoc = !!projectData && projectData.meta.layout !== "todo";

  // For raw docs the formatted view (QaLayout) and the Monaco editor share one raw string
  // (editorContent). Seed it from the parsed file whenever the file content changes
  // (load, reload, tab switch). These edits never touch projectData.rawContent, so this
  // effect does not fire on them and won't clobber in-progress edits.
  useEffect(() => {
    if (!isRawDoc) return;
    if (!synced) return; // projectData is still the previous file's — don't seed this tab from it
    setEditorContentMap((prev) =>
      prev[activeTabId] === projectData!.rawContent
        ? prev
        : { ...prev, [activeTabId]: projectData!.rawContent }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRawDoc, synced, activeTabId, projectData?.rawContent]);

  const handleToggleViewMode = useCallback(() => {
    if (isRawDoc) {
      // Formatted (QaLayout) <-> Monaco share editorContent; just flip the mode.
      // No task serialization for qa/plain docs.
      setViewMode(viewMode === "grid" ? "editor" : "grid");
      return;
    }
    if (viewMode === "grid") {
      if (projectData) {
        const serialized = serializeProjectMd(projectData);
        undoHistory?.pushSnapshot(activeTabId, serialized);
        setEditorContent(serialized);
      }
      setSelectedTaskId(null);
      setShowNotes(false);
      setViewMode("editor");
    } else {
      undoHistory?.pushSnapshot(activeTabId, editorContent);
      undoHistory?.suppressNextPush();
      const ok = replaceFromRaw(editorContent);
      if (ok) {
        setViewMode("grid");
      }
    }
  }, [isRawDoc, viewMode, projectData, editorContent, activeTabId, undoHistory, replaceFromRaw, setEditorContent, setViewMode, setSelectedTaskId, setShowNotes]);

  const editorSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEditorChange = useCallback(
    (content: string) => {
      // Ignore changes for a real file whose data hasn't loaded for this tab yet. The
      // WYSIWYG editor re-emits its content on (re)mount, so right after a tab switch this
      // fires with the *previous* file's text (or an empty editor) before the seed lands —
      // persisting it would drift one file's content onto another. Untitled docs (no path)
      // still flow through so their in-memory buffer updates.
      if (activeFilePath && !synced) return;
      setEditorContent(content);
      if (!activeFilePath) return;
      // Pass `content` so a WYSIWYG re-emit of the on-disk bytes doesn't flag the buffer dirty
      // (which would make the next external write raise a spurious conflict). When it isn't a real
      // edit, also cancel any pending write and don't schedule a new one — a stale write surviving
      // a clean live-reload could otherwise clobber an external change.
      const s = syncRef.current;
      const dirty = s ? s.markDirty(activeFilePath, content) : true;
      if (editorSaveTimeoutRef.current) {
        clearTimeout(editorSaveTimeoutRef.current);
        editorSaveTimeoutRef.current = null;
      }
      if (!dirty) return;
      editorSaveTimeoutRef.current = setTimeout(async () => {
        try {
          if (s) await s.guardedWrite(activeFilePath, content);
          else await writeFile(activeFilePath, content);
        } catch {
          toast.error("Failed to save editor changes", { id: "editor-save-error" });
        }
      }, 300);
    },
    [activeFilePath, synced, setEditorContent]
  );

  const handleSave = useCallback(async () => {
    // Raw docs (`layout: qa` + plain markdown) edit `editorContent` as a verbatim raw string —
    // in BOTH the WYSIWYG (QaLayout, viewMode "grid") and the Monaco editor view. They must save
    // that string directly and must NEVER go through `flushSave`/`serializeProjectMd`, which would
    // emit the task-table template (`project: "Untitled Project"` + `## Tasks`) over the document.
    // Only `layout: todo` grid docs round-trip through the task serializer below.
    if (isRawDoc || viewMode === "editor") {
      if (!activeFilePath) {
        const newPath = await saveFileDialog();
        if (!newPath) return;
        await writeFile(newPath, editorContent);
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTabId
              ? { ...t, filePath: newPath, label: newPath.split("/").pop()! }
              : t
          )
        );
      } else {
        // Don't flush an editor buffer that isn't synced to this file yet (would clobber).
        if (!synced) return;
        // Flush any pending editor debounce, write immediately
        if (editorSaveTimeoutRef.current) {
          clearTimeout(editorSaveTimeoutRef.current);
          editorSaveTimeoutRef.current = null;
        }
        const s = syncRef.current;
        if (s) await s.guardedWrite(activeFilePath, editorContent);
        else await writeFile(activeFilePath, editorContent);
      }
      return;
    }
    if (!projectData) return;
    if (!activeFilePath) {
      // Untitled file — prompt Save As
      const newPath = await saveFileDialog();
      if (!newPath) return;
      const content = serializeProjectMd(projectData);
      await writeFile(newPath, content);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, filePath: newPath, label: newPath.split("/").pop()! }
            : t
        )
      );
    } else {
      flushSave();
    }
  }, [isRawDoc, viewMode, activeFilePath, synced, activeTabId, projectData, editorContent, flushSave, setTabs]);

  // Cancel any pending editor autosave on unmount. A tab's DocumentView unmounts when the tab
  // closes, so this stops a debounced write from re-creating a just-deleted/closed file.
  useEffect(() => {
    return () => {
      if (editorSaveTimeoutRef.current) clearTimeout(editorSaveTimeoutRef.current);
    };
  }, []);

  return {
    viewMode, editorContent,
    handleToggleViewMode, handleEditorChange, handleSave,
  };
}
