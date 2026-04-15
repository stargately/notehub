import { useState, useEffect } from "react";
import type { ProjectMeta, WeekFilter } from "../lib/types";
import type { ThemeMode } from "../hooks/useDarkMode";
import { ThemeIcon } from "./ThemeIcon";

interface ToolbarProps {
  meta: ProjectMeta;
  filterText: string;
  groupBy?: string | null;
  hideDone: boolean;
  showNotes: boolean;
  themeMode: ThemeMode;
  weekFilter: WeekFilter;
  onFilterChange: (text: string) => void;
  onGroupByChange?: (field: string | null) => void;
  onToggleHideDone: () => void;
  onAddTask: () => void;
  onToggleNotes: () => void;
  onCycleTheme: () => void;
  onWeekFilterChange: (filter: WeekFilter) => void;
  onToggleEditor?: () => void;
}

export function Toolbar({
  meta,
  filterText,
  hideDone,
  showNotes,
  themeMode,
  weekFilter,
  onFilterChange,
  onToggleHideDone,
  onAddTask,
  onToggleNotes,
  onCycleTheme,
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
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-2 border-b"
      style={{
        borderColor: "var(--nh-border)",
        background: "var(--nh-bg-elevated)",
      }}
    >
      {/* Project Name */}
      <h1
        className="text-sm font-semibold whitespace-nowrap mr-1"
        style={{ color: "var(--nh-text)" }}
      >
        {meta.project}
      </h1>

      <div
        className="w-px h-4 shrink-0 hidden sm:block"
        style={{ background: "var(--nh-border)" }}
      />

      {/* Filter */}
      <div
        className="flex items-center px-2.5 py-1 rounded-md text-sm transition-all"
        style={{
          border: `1px solid ${filterFocused ? "var(--nh-accent)" : "var(--nh-border)"}`,
          background: filterFocused ? "var(--nh-accent-subtle)" : "transparent",
          boxShadow: filterFocused ? "0 0 0 2px rgba(222, 76, 79, 0.1)" : "none",
        }}
      >
        <svg
          className="w-3.5 h-3.5 mr-1.5 shrink-0"
          style={{ color: "var(--nh-text-tertiary)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
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
          className="bg-transparent outline-none placeholder-gray-400 text-sm min-w-0"
          style={{
            color: "var(--nh-text)",
            width: "clamp(100px, 15vw, 200px)",
          }}
        />
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={onToggleHideDone}
          className={`nh-pill ${hideDone ? "active" : ""}`}
        >
          {hideDone ? (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
          {hideDone ? "Done hidden" : "Hide done"}
        </button>

        <button
          onClick={() => onWeekFilterChange(weekFilter === "this_week" ? null : "this_week")}
          className={`nh-pill ${weekFilter === "this_week" ? "active" : ""}`}
        >
          This Week
        </button>

        <button
          onClick={() => onWeekFilterChange(weekFilter === "last_week" ? null : "last_week")}
          className={`nh-pill ${weekFilter === "last_week" ? "active" : ""}`}
        >
          Last Week
        </button>
      </div>

      <div className="flex-1 min-w-[8px]" />

      {/* Right-side actions */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={onToggleNotes}
          className={`nh-btn ${showNotes ? "active" : ""}`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Notes
        </button>

        {onToggleEditor && (
          <button
            onClick={onToggleEditor}
            className="nh-btn"
            title="Toggle raw markdown editor (Cmd+/)"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Source
          </button>
        )}

        <button
          onClick={onCycleTheme}
          className="nh-btn"
          style={{ padding: "6px 8px" }}
          title={`Theme: ${themeMode} (click to cycle)`}
        >
          <ThemeIcon themeMode={themeMode} />
        </button>

        <button
          onMouseDown={(e) => {
            e.preventDefault();
            (e.target as HTMLElement).blur();
            onAddTask();
          }}
          className="nh-btn-primary"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
      </div>
    </div>
  );
}
