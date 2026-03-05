import { useState, useRef } from "react";
import { useProjectFile } from "./hooks/useProjectFile";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useDarkMode } from "./hooks/useDarkMode";
import { useClickOutside } from "./hooks/useClickOutside";
import { useTabManagement } from "./hooks/useTabManagement";
import { useViewMode } from "./hooks/useViewMode";
import { useTaskFilters } from "./hooks/useTaskFilters";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { isTauri } from "./lib/tauri-api";
import type { WeekFilter } from "./lib/types";
import { TaskTable } from "./components/TaskTable";
import { Toolbar } from "./components/Toolbar";
import { ProjectNotes } from "./components/ProjectNotes";
import { TaskDetailDrawer } from "./components/TaskDetailDrawer";
import { TabBar } from "./components/TabBar";
import { TerminalPanel } from "./components/TerminalPanel";
import { MarkdownEditor } from "./components/MarkdownEditor";

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

  const { darkMode, toggleDarkMode } = useDarkMode();

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

  const {
    filePath, projectData, loading, error,
    loadFile, updateTasks, updateTask, addTask, updateNotes,
    replaceFromRaw, flushSave,
  } = useProjectFile(activeFilePath);

  const {
    viewMode, editorContent,
    handleToggleViewMode, handleEditorChange, handleSave, cleanupTab,
  } = useViewMode({
    activeTabId, activeFilePath, projectData,
    replaceFromRaw, flushSave, setTabs,
    setSelectedTaskId, setShowNotes,
  });
  cleanupTabRef.current = cleanupTab;

  const {
    filteredTasks, selectedTask,
    handleTasksChanged, handleDescriptionChange, handleDeleteTask,
  } = useTaskFilters({
    projectData, hideDone, weekFilter, selectedTaskId,
    updateTasks, updateTask, setSelectedTaskId, setGroupBy,
  });

  // Click-outside-to-close drawer
  const drawerRef = useRef<HTMLDivElement>(null);
  useClickOutside(drawerRef, !!selectedTaskId, () => setSelectedTaskId(null));

  useKeyboardShortcuts({
    loadFile, handleSave, handleToggleViewMode,
    tabs, setActiveTabId, activeFilePath,
    setShowTerminal, setTerminalMounted,
  });

  // File watcher for external changes
  useFileWatcher(filePath, loadFile);

  if (!initialized || (loading && tabs.length === 0)) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <span className="text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    );
  }

  if (error && tabs.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error: {error}</p>
          <button
            onClick={loadFile}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!projectData && tabs.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Welcome to NoteHub
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            No project file loaded. Open a .md file to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
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
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <h1 className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
              {projectData?.meta.project || "Untitled"}
            </h1>
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 font-medium">
              Markdown
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"}+/ to switch
            </span>
            <div className="flex-1" />
            <button
              onClick={handleToggleViewMode}
              className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Grid View
            </button>
            <button
              onClick={toggleDarkMode}
              className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
              title="Toggle dark mode"
            >
              {darkMode ? "\u2600\uFE0F" : "\u{1F319}"}
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {error && (
              <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            <MarkdownEditor content={editorContent} onChange={handleEditorChange} />
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
            onAddTask={addTask}
            onToggleNotes={() => setShowNotes(!showNotes)}
            onToggleDarkMode={toggleDarkMode}
            onWeekFilterChange={setWeekFilter}
            onToggleEditor={handleToggleViewMode}
          />

          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-gray-500 dark:text-gray-400">Loading...</span>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-red-500">Error: {error}</p>
              </div>
            ) : projectData ? (
              <>
                <div className="flex-1 flex overflow-hidden">
                  <div className="flex-1 overflow-hidden">
                    <TaskTable
                      tasks={filteredTasks}
                      meta={projectData.meta}
                      filterText={filterText}
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
