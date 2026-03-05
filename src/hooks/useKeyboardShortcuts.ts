import { useEffect } from "react";
import type { TabInfo } from "../lib/types";

interface UseKeyboardShortcutsOptions {
  loadFile: () => void;
  handleSave: () => void;
  handleToggleViewMode: () => void;
  tabs: TabInfo[];
  setActiveTabId: (id: string) => void;
  activeFilePath: string | null;
  setShowTerminal: React.Dispatch<React.SetStateAction<boolean>>;
  setTerminalMounted: (mounted: boolean) => void;
}

export function useKeyboardShortcuts({
  loadFile, handleSave, handleToggleViewMode,
  tabs, setActiveTabId, activeFilePath,
  setShowTerminal, setTerminalMounted,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+/ (or Ctrl+/) to toggle raw markdown editor
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
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
      if (!(e.metaKey || e.ctrlKey)) return;
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
  }, [loadFile, handleSave, handleToggleViewMode, tabs, setActiveTabId, activeFilePath, setShowTerminal, setTerminalMounted]);
}
