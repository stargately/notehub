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
    <div
      className="flex items-center overflow-x-auto"
      style={{
        borderBottom: "1px solid var(--nh-border)",
        background: "var(--nh-bg-sunken)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className="flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer shrink-0 transition-colors relative"
            style={{
              background: isActive ? "var(--nh-bg-elevated)" : "transparent",
              color: isActive ? "var(--nh-text)" : "var(--nh-text-secondary)",
              borderRight: "1px solid var(--nh-border-subtle)",
            }}
            onClick={() => onSelectTab(tab.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
            }}
          >
            {isActive && (
              <div
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: "var(--nh-accent)" }}
              />
            )}
            <span className="truncate max-w-[150px] font-medium">{tab.label}</span>
            {tabs.length > 1 && (
              <button
                className="ml-1 p-0.5 rounded transition-colors"
                style={{ color: "var(--nh-text-tertiary)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--nh-border)";
                  e.currentTarget.style.color = "var(--nh-text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--nh-text-tertiary)";
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
      <button
        className="px-2.5 py-1.5 text-xs shrink-0 transition-colors"
        style={{ color: "var(--nh-text-tertiary)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--nh-border-subtle)";
          e.currentTarget.style.color = "var(--nh-text)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--nh-text-tertiary)";
        }}
        onClick={onAddTab}
        title="Open file"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {contextMenu && (() => {
        const tab = tabs.find((t) => t.id === contextMenu.tabId);
        const disabled = !tab?.filePath;
        return (
          <div
            className="fixed z-50 py-1 min-w-[220px] rounded-lg nh-fade-in"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              background: "var(--nh-bg-elevated)",
              border: "1px solid var(--nh-border)",
              boxShadow: "var(--nh-shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
                disabled ? "opacity-40 cursor-default" : ""
              }`}
              style={{ color: disabled ? "var(--nh-text-tertiary)" : "var(--nh-text)" }}
              onMouseEnter={(e) => {
                if (!disabled) e.currentTarget.style.background = "var(--nh-bg-sunken)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              onClick={disabled ? undefined : handleCopyPath}
              disabled={disabled}
            >
              <span>Copy Path/Reference...</span>
              <span style={{ color: "var(--nh-text-tertiary)" }} className="ml-4 text-[10px]">
                ⌘⇧C
              </span>
            </button>
          </div>
        );
      })()}
    </div>
  );
}
