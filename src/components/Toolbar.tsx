import { useState, useEffect } from "react";
import type { ProjectMeta, WeekFilter } from "../lib/types";

interface ToolbarProps {
  meta: ProjectMeta;
  filterText: string;
  groupBy?: string | null;
  hideDone: boolean;
  showNotes: boolean;
  darkMode: boolean;
  weekFilter: WeekFilter;
  onFilterChange: (text: string) => void;
  onGroupByChange?: (field: string | null) => void;
  onToggleHideDone: () => void;
  onAddTask: () => void;
  onToggleNotes: () => void;
  onToggleDarkMode: () => void;
  onWeekFilterChange: (filter: WeekFilter) => void;
  onToggleEditor?: () => void;
}

export function Toolbar({
  meta,
  filterText,
  hideDone,
  showNotes,
  darkMode,
  weekFilter,
  onFilterChange,
  onToggleHideDone,
  onAddTask,
  onToggleNotes,
  onToggleDarkMode,
  onWeekFilterChange,
  onToggleEditor,
}: ToolbarProps) {
  const [filterFocused, setFilterFocused] = useState(false);

  // Keyboard shortcut: Cmd/Ctrl+F to focus filter
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        const input = document.getElementById("filter-input");
        input?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        onAddTask();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onAddTask]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Project Name */}
      <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
        {meta.project}
      </h1>

      <div className="w-px h-5 bg-gray-200 dark:bg-gray-700" />

      {/* Filter */}
      <div
        className={`flex items-center px-2 py-1 rounded border text-sm ${
          filterFocused
            ? "border-blue-400 dark:border-blue-500"
            : "border-gray-300 dark:border-gray-600"
        }`}
      >
        <span className="text-gray-400 mr-1 text-xs">&#128269;</span>
        <input
          id="filter-input"
          type="text"
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
          onFocus={() => setFilterFocused(true)}
          onBlur={() => setFilterFocused(false)}
          placeholder="Filter..."
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="bg-transparent outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400 w-40"
        />
      </div>

      {/* Hide Done Pill */}
      <button
        onClick={onToggleHideDone}
        className={`px-3 py-1 text-sm rounded-full border ${
          hideDone
            ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-900 dark:border-green-600 dark:text-green-300"
            : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
      >
        {hideDone ? "Done hidden" : "Hide done"}
      </button>

      {/* Week Filter Pills */}
      <button
        onClick={() => onWeekFilterChange(weekFilter === "this_week" ? null : "this_week")}
        className={`px-3 py-1 text-sm rounded-full border ${
          weekFilter === "this_week"
            ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-300"
            : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
      >
        This Week
      </button>
      <button
        onClick={() => onWeekFilterChange(weekFilter === "last_week" ? null : "last_week")}
        className={`px-3 py-1 text-sm rounded-full border ${
          weekFilter === "last_week"
            ? "bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-900 dark:border-purple-600 dark:text-purple-300"
            : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
      >
        Last Week
      </button>

      <div className="flex-1" />

      {/* Toggle Notes */}
      <button
        onClick={onToggleNotes}
        className={`px-3 py-1 text-sm rounded border ${
          showNotes
            ? "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900 dark:border-blue-600 dark:text-blue-300"
            : "border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        }`}
      >
        Notes
      </button>

      {/* Source / Markdown Editor Toggle */}
      {onToggleEditor && (
        <button
          onClick={onToggleEditor}
          className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          title="Toggle raw markdown editor (Cmd+/)"
        >
          Source
        </button>
      )}

      {/* Dark Mode Toggle */}
      <button
        onClick={onToggleDarkMode}
        className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
        title="Toggle dark mode"
      >
        {darkMode ? "\u2600\uFE0F" : "\u{1F319}"}
      </button>

      {/* Add Task */}
      <button
        onClick={onAddTask}
        className="px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 font-medium"
      >
        + New Task
      </button>
    </div>
  );
}
