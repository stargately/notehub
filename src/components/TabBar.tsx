import { useState, useCallback } from "react";
import type { TabInfo } from "../lib/types";
import { ContextMenu } from "./ContextMenu";

interface TabContextMenu {
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
  const [contextMenu, setContextMenu] = useState<TabContextMenu | null>(null);

  const closeMenu = useCallback(() => setContextMenu(null), []);

  const handleCopyPath = useCallback(() => {
    const tab = tabs.find((t) => t.id === contextMenu?.tabId);
    if (tab?.filePath) {
      navigator.clipboard.writeText(tab.filePath);
    }
  }, [contextMenu, tabs]);

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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={closeMenu}
          items={[
            {
              label: "Copy Path/Reference...",
              shortcut: "⌘⇧C",
              disabled: !tabs.find((t) => t.id === contextMenu.tabId)?.filePath,
              onClick: handleCopyPath,
            },
          ]}
        />
      )}
    </div>
  );
}
