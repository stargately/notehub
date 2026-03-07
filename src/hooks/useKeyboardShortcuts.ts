import { useEffect } from "react";
import type { TabInfo, ViewMode } from "../lib/types";
import type { UndoHistory } from "./useUndoHistory";

interface UseKeyboardShortcutsOptions {
  loadFile: () => void;
  handleSave: () => void;
  handleToggleViewMode: () => void;
  tabs: TabInfo[];
  setActiveTabId: (id: string) => void;
  activeFilePath: string | null;
  setShowTerminal: React.Dispatch<React.SetStateAction<boolean>>;
  setTerminalMounted: (mounted: boolean) => void;
  undoHistory?: UndoHistory;
  activeTabId?: string;
  viewMode?: ViewMode;
  replaceFromRaw?: (raw: string) => boolean;
  flushPendingSnapshot?: () => void;
}

export function useKeyboardShortcuts({
  loadFile, handleSave, handleToggleViewMode,
  tabs, setActiveTabId, activeFilePath,
  setShowTerminal, setTerminalMounted,
  undoHistory, activeTabId, viewMode, replaceFromRaw,
  flushPendingSnapshot,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+Z / Cmd+Shift+Z — undo/redo in grid mode
      if (mod && e.key === "z" && viewMode === "grid" && undoHistory && activeTabId && replaceFromRaw) {
        e.preventDefault();
        // Flush any pending debounced snapshot so it's available for undo
        flushPendingSnapshot?.();
        if (e.shiftKey) {
          const snapshot = undoHistory.redo(activeTabId);
          if (snapshot) {
            undoHistory.suppressNextPush();
            replaceFromRaw(snapshot);
          }
        } else {
          const snapshot = undoHistory.undo(activeTabId);
          if (snapshot) {
            undoHistory.suppressNextPush();
            replaceFromRaw(snapshot);
          }
        }
        return;
      }

      // Cmd+/ (or Ctrl+/) to toggle raw markdown editor
      if (mod && e.key === "/") {
        e.preventDefault();
        handleToggleViewMode();
        return;
      }
      // Ctrl+` (or Cmd+`) to toggle terminal
      if ((e.ctrlKey || e.metaKey) && e.key === "`") {
        e.preventDefault();
        setShowTerminal((prev) => !prev);
        setTerminalMounted(true);
        return;
      }
      if (!mod) return;
      if (e.key === "r") {
        e.preventDefault();
        loadFile();
      } else if (e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "c" && e.shiftKey) {
        e.preventDefault();
        if (activeFilePath) {
          navigator.clipboard.writeText(activeFilePath);
        }
      } else if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        if (idx < tabs.length) {
          setActiveTabId(tabs[idx].id);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [loadFile, handleSave, handleToggleViewMode, tabs, setActiveTabId, activeFilePath, setShowTerminal, setTerminalMounted, undoHistory, activeTabId, viewMode, replaceFromRaw, flushPendingSnapshot]);
}
