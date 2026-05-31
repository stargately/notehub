import { useState, useCallback, useRef, useEffect } from "react";
import type { ProjectData, TabInfo, ViewMode } from "../lib/types";
import { serializeProjectMd } from "../lib/markdown-parser";
import { saveFileDialog, writeFile } from "../lib/tauri-api";
import { toast } from "sonner";
import type { UndoHistory } from "./useUndoHistory";

interface UseViewModeOptions {
  activeTabId: string;
  activeFilePath: string | null;
  projectData: ProjectData | null;
  replaceFromRaw: (raw: string) => boolean;
  flushSave: () => void;
  setTabs: React.Dispatch<React.SetStateAction<TabInfo[]>>;
  setSelectedTaskId: (id: string | null) => void;
  setShowNotes: (show: boolean) => void;
  undoHistory?: UndoHistory;
}

export function useViewMode({
  activeTabId, activeFilePath, projectData,
  replaceFromRaw, flushSave, setTabs,
  setSelectedTaskId, setShowNotes, undoHistory,
}: UseViewModeOptions) {
  const [viewModeMap, setViewModeMap] = useState<Record<string, ViewMode>>({});
  const [editorContentMap, setEditorContentMap] = useState<Record<string, string>>({});

  const viewMode = viewModeMap[activeTabId] ?? "grid";
  const editorContent = editorContentMap[activeTabId] ?? "";

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeMap((prev) => ({ ...prev, [activeTabId]: mode }));
  }, [activeTabId]);

  const setEditorContent = useCallback((content: string) => {
    setEditorContentMap((prev) => ({ ...prev, [activeTabId]: content }));
  }, [activeTabId]);

  const isQa = projectData?.meta.layout === "qa";

  // For `layout: qa` files the QA view and the Monaco editor share one raw string
  // (editorContent). Seed it from the parsed file whenever the file content changes
  // (load, reload, tab switch). QA edits never touch projectData.rawContent, so this
  // effect does not fire on them and won't clobber in-progress edits.
  useEffect(() => {
    if (!isQa) return;
    setEditorContentMap((prev) =>
      prev[activeTabId] === projectData!.rawContent
        ? prev
        : { ...prev, [activeTabId]: projectData!.rawContent }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQa, activeTabId, projectData?.rawContent]);

  const handleToggleViewMode = useCallback(() => {
    if (isQa) {
      // QA <-> Monaco share editorContent; just flip the mode. No task serialization.
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
  }, [isQa, viewMode, projectData, editorContent, activeTabId, undoHistory, replaceFromRaw, setEditorContent, setViewMode, setSelectedTaskId, setShowNotes]);

  const editorSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleEditorChange = useCallback(
    (content: string) => {
      setEditorContent(content);
      if (!activeFilePath) return;
      if (editorSaveTimeoutRef.current) clearTimeout(editorSaveTimeoutRef.current);
      editorSaveTimeoutRef.current = setTimeout(async () => {
        try {
          await writeFile(activeFilePath, content);
        } catch {
          toast.error("Failed to save editor changes", { id: "editor-save-error" });
        }
      }, 300);
    },
    [activeFilePath, setEditorContent]
  );

  const handleSave = useCallback(async () => {
    if (viewMode === "editor") {
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
        // Flush any pending editor debounce, write immediately
        if (editorSaveTimeoutRef.current) {
          clearTimeout(editorSaveTimeoutRef.current);
          editorSaveTimeoutRef.current = null;
        }
        await writeFile(activeFilePath, editorContent);
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
  }, [viewMode, activeFilePath, activeTabId, projectData, editorContent, flushSave, setTabs]);

  const cleanupTab = useCallback((tabId: string) => {
    setViewModeMap((prev) => { const next = { ...prev }; delete next[tabId]; return next; });
    setEditorContentMap((prev) => { const next = { ...prev }; delete next[tabId]; return next; });
  }, []);

  return {
    viewMode, editorContent,
    handleToggleViewMode, handleEditorChange, handleSave, cleanupTab,
  };
}
