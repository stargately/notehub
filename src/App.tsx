import { useState, useRef, useCallback } from "react";
import { useProjectFile } from "./hooks/useProjectFile";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useDarkMode } from "./hooks/useDarkMode";
import { useClickOutside } from "./hooks/useClickOutside";
import { useTabManagement } from "./hooks/useTabManagement";
import { useViewMode } from "./hooks/useViewMode";
import { useTaskFilters } from "./hooks/useTaskFilters";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useUndoHistory } from "./hooks/useUndoHistory";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import { isTauri } from "./lib/tauri-api";
import { serializeProjectMd } from "./lib/markdown-parser";
import type { ProjectData } from "./lib/types";
import type { WeekFilter } from "./lib/types";
import { TaskTable } from "./components/TaskTable";
import { Toolbar } from "./components/Toolbar";
import { ProjectNotes } from "./components/ProjectNotes";
import { TaskDetailDrawer } from "./components/TaskDetailDrawer";
import { TabBar } from "./components/TabBar";
import { TerminalPanel } from "./components/TerminalPanel";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { Toaster } from "sonner";

function App() {
  // UI state
  const [filterText, setFilterText] = useState("");
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [weekFilter, setWeekFilter] = useState<WeekFilter>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);

  const { darkMode, toggleDarkMode } = useDarkMode();
  const undoHistory = useUndoHistory();
  useAutoUpdate();

  // Ref to break circular dependency between useTabManagement and useViewMode
  const cleanupTabRef = useRef<(tabId: string) => void>(() => {});

  const {
    tabs, setTabs, activeTabId, setActiveTabId, initialized,
    activeFilePath, terminalCwd,
    handleAddTab, handleCloseTab, handleSelectTab,
  } = useTabManagement({
    onTabClosed: (id) => cleanupTabRef.current(id),
    onTabSwitch: () => {
      setFilterText("");
      setShowNotes(false);
      setWeekFilter(null);
      setSelectedTaskId(null);
    },
  });

  // Debounced onBeforeSave: coalesces rapid edits (e.g. Tiptap keystrokes) into one undo step
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnapshotRef = useRef<string | null>(null);

  const flushPendingSnapshot = useCallback(() => {
    if (snapshotTimerRef.current) {
      clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    if (pendingSnapshotRef.current && activeTabId) {
      undoHistory.pushSnapshot(activeTabId, pendingSnapshotRef.current);
      pendingSnapshotRef.current = null;
    }
  }, [activeTabId, undoHistory]);

  const onBeforeSave = useCallback(
    (currentData: ProjectData) => {
      const snapshot = serializeProjectMd(currentData);
      pendingSnapshotRef.current = snapshot;
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = setTimeout(() => {
        if (pendingSnapshotRef.current && activeTabId) {
          undoHistory.pushSnapshot(activeTabId, pendingSnapshotRef.current);
          pendingSnapshotRef.current = null;
        }
      }, 500);
    },
    [activeTabId, undoHistory]
  );

  // Init undo history when file data is loaded (called from inside loadFile,
  // avoiding race conditions with stale projectData from a previous filePath).
  const onDataLoaded = useCallback((data: ProjectData) => {
    if (activeTabId) {
      undoHistory.initTab(activeTabId, serializeProjectMd(data));
    }
  }, [activeTabId, undoHistory]);

  const {
    filePath, projectData, loading, error,
    loadFile, updateTasks, updateTask, addTask, updateNotes,
    replaceFromRaw, flushSave,
  } = useProjectFile(activeFilePath, onBeforeSave, onDataLoaded);

  const {
    viewMode, editorContent,
    handleToggleViewMode, handleEditorChange, handleSave, cleanupTab,
  } = useViewMode({
    activeTabId, activeFilePath, projectData,
    replaceFromRaw, flushSave, setTabs,
    setSelectedTaskId, setShowNotes,
    undoHistory,
  });
  cleanupTabRef.current = (tabId: string) => {
    cleanupTab(tabId);
    undoHistory.cleanupTab(tabId);
  };

  const {
    filteredTasks, selectedTask,
    handleTasksChanged, handleDescriptionChange, handleDeleteTask,
  } = useTaskFilters({
    projectData, hideDone, weekFilter, selectedTaskId,
    updateTasks, updateTask, setSelectedTaskId, setGroupBy,
  });

  const handleAddTask = useCallback(() => {
    const newId = addTask();
    if (newId) setHighlightTaskId(newId);
  }, [addTask]);

  // Click-outside-to-close drawer
  const drawerRef = useRef<HTMLDivElement>(null);
  useClickOutside(drawerRef, !!selectedTaskId, () => setSelectedTaskId(null));

  // Undo/redo callbacks for Monaco editor exhaustion
  const handleUndoExhausted = useCallback(() => {
    if (!activeTabId) return null;
    flushPendingSnapshot();
    undoHistory.suppressNextPush();
    return undoHistory.undo(activeTabId);
  }, [activeTabId, undoHistory, flushPendingSnapshot]);

  const handleRedoExhausted = useCallback(() => {
    if (!activeTabId) return null;
    undoHistory.suppressNextPush();
    return undoHistory.redo(activeTabId);
  }, [activeTabId, undoHistory]);

  useKeyboardShortcuts({
    loadFile, handleSave, handleToggleViewMode,
    tabs, setActiveTabId, activeFilePath,
    setShowTerminal, setTerminalMounted,
    undoHistory, activeTabId, viewMode, replaceFromRaw,
    flushPendingSnapshot,
  });

  // File watcher for external changes
  useFileWatcher(filePath, loadFile);

  if (!initialized || (loading && tabs.length === 0)) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--nh-bg)" }}>
        <Toaster richColors position="bottom-right" theme={darkMode ? "dark" : "light"} />
        <div className="flex items-center gap-2" style={{ color: "var(--nh-text-tertiary)" }}>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (error && tabs.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--nh-bg)" }}>
        <Toaster richColors position="bottom-right" theme={darkMode ? "dark" : "light"} />
        <div className="text-center">
          <p className="text-sm mb-3" style={{ color: "var(--nh-accent)" }}>Error: {error}</p>
          <button onClick={loadFile} className="nh-btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!projectData && tabs.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: "var(--nh-bg)" }}>
        <Toaster richColors position="bottom-right" theme={darkMode ? "dark" : "light"} />
        <div className="text-center nh-fade-in">
          <div className="w-10 h-10 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--nh-accent-subtle)" }}>
            <svg className="w-5 h-5" style={{ color: "var(--nh-accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold mb-1" style={{ color: "var(--nh-text)" }}>
            Welcome to NoteHub
          </h2>
          <p className="text-sm" style={{ color: "var(--nh-text-secondary)" }}>
            Open a .md file to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--nh-bg)" }}>
      <Toaster richColors position="bottom-right" theme={darkMode ? "dark" : "light"} />
      {isTauri && tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onAddTab={handleAddTab}
        />
      )}

      {viewMode === "editor" ? (
        <>
          {/* Editor header bar */}
          <div
            className="flex flex-wrap items-center gap-2 px-4 py-2 border-b"
            style={{ borderColor: "var(--nh-border)", background: "var(--nh-bg-elevated)" }}
          >
            <h1 className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--nh-text)" }}>
              {projectData?.meta.project || "Untitled"}
            </h1>
            <span
              className="px-2 py-0.5 text-[10px] rounded-full font-medium uppercase tracking-wide"
              style={{ background: "var(--nh-accent-subtle)", color: "var(--nh-accent)" }}
            >
              Markdown
            </span>
            <span className="text-[10px]" style={{ color: "var(--nh-text-tertiary)" }}>
              {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+/ to switch
            </span>
            <div className="flex-1" />
            <button onClick={handleToggleViewMode} className="nh-btn">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Grid View
            </button>
            <button onClick={toggleDarkMode} className="nh-btn" style={{ padding: "6px 8px" }} title="Toggle dark mode">
              {darkMode ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <MarkdownEditor
              content={editorContent}
              onChange={handleEditorChange}
              darkMode={darkMode}
              onUndoExhausted={handleUndoExhausted}
              onRedoExhausted={handleRedoExhausted}
            />
          </div>
        </>
      ) : (
        <>
          <Toolbar
            meta={projectData?.meta ?? { project: "", created: "", views: {}, columns: [], status_options: [], priority_options: [], assignee_options: [] }}
            filterText={filterText}
            groupBy={groupBy}
            hideDone={hideDone}
            showNotes={showNotes}
            darkMode={darkMode}
            weekFilter={weekFilter}
            onFilterChange={setFilterText}
            onGroupByChange={setGroupBy}
            onToggleHideDone={() => setHideDone(!hideDone)}
            onAddTask={handleAddTask}
            onToggleNotes={() => setShowNotes(!showNotes)}
            onToggleDarkMode={toggleDarkMode}
            onWeekFilterChange={setWeekFilter}
            onToggleEditor={handleToggleViewMode}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-2" style={{ color: "var(--nh-text-tertiary)" }}>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm">Loading...</span>
                </div>
              </div>
            ) : projectData ? (
              <>
                <div className="flex-1 flex overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    <TaskTable
                      tasks={filteredTasks}
                      meta={projectData.meta}
                      filterText={filterText}
                      highlightTaskId={highlightTaskId}
                      onTasksChanged={handleTasksChanged}
                      onTaskSelected={(task) => setSelectedTaskId(task.id)}
                    />
                  </div>

                  {selectedTask && (
                    <div ref={drawerRef}>
                      <TaskDetailDrawer
                        task={selectedTask}
                        onDescriptionChange={handleDescriptionChange}
                        onDelete={handleDeleteTask}
                        onClose={() => setSelectedTaskId(null)}
                      />
                    </div>
                  )}
                </div>

                {showNotes && (
                  <ProjectNotes
                    notes={projectData.notes}
                    onUpdateNotes={updateNotes}
                    darkMode={darkMode}
                  />
                )}
              </>
            ) : null}
          </div>
        </>
      )}

      {terminalMounted && (
        <TerminalPanel
          visible={showTerminal}
          cwd={terminalCwd}
          onClose={() => setShowTerminal(false)}
        />
      )}
    </div>
  );
}

export default App;
