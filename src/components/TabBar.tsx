import { useState, useEffect, useCallback } from "react";
import type { TabInfo } from "../lib/types";

interface ContextMenu {
  x: number;
  y: number;
  tabId: string;
}

interface TabBarProps {
  tabs: TabInfo[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddTab: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onAddTab,
}: TabBarProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  // Close on outside click, Escape, or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("click", closeMenu);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", closeMenu, true);
    return () => {
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu, closeMenu]);

  const handleCopyPath = useCallback(() => {
    const tab = tabs.find((t) => t.id === contextMenu?.tabId);
    if (tab?.filePath) {
      navigator.clipboard.writeText(tab.filePath);
    }
    closeMenu();
  }, [contextMenu, tabs, closeMenu]);

  return (
    <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm cursor-pointer border-r border-gray-200 dark:border-gray-700 shrink-0 ${
              isActive
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
            onClick={() => onSelectTab(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
            }}
          >
            <span className="truncate max-w-[150px]">{tab.label}</span>
            {tabs.length > 1 && (
              <button
                className="ml-1 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                ×
              </button>
            )}
          </div>
        );
      })}
      <button
        className="px-2.5 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0"
        onClick={onAddTab}
        title="Open file"
      >
        +
      </button>

      {contextMenu && (() => {
        const tab = tabs.find((t) => t.id === contextMenu.tabId);
        const disabled = !tab?.filePath;
        return (
          <div
            className="fixed z-50 py-1 min-w-[220px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between ${
                disabled
                  ? "text-gray-400 dark:text-gray-500 cursor-default"
                  : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              onClick={disabled ? undefined : handleCopyPath}
              disabled={disabled}
            >
              <span>Copy Path/Reference...</span>
              <span className="ml-4 text-xs text-gray-400 dark:text-gray-500">⌘⇧C</span>
            </button>
          </div>
        );
      })()}
    </div>
  );
}
