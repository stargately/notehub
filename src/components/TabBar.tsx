import type { TabInfo } from "../lib/types";

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
    </div>
  );
}
