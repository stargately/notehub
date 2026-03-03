import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useProjectFile, resolveInitialFilePaths } from "./hooks/useProjectFile";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { isTauri, openFileDialog, saveFileDialog, writeFile } from "./lib/tauri-api";
import { serializeProjectMd } from "./lib/markdown-parser";
import type { TabInfo, WeekFilter } from "./lib/types";
import { TaskTable } from "./components/TaskTable";
import { Toolbar } from "./components/Toolbar";
import { ProjectNotes } from "./components/ProjectNotes";
import { TaskDetailDrawer } from "./components/TaskDetailDrawer";
import { TabBar } from "./components/TabBar";

let tabCounter = 0;

function makeTab(filePath: string | null): TabInfo {
  tabCounter += 1;
  let label: string;
  if (!filePath) {
    label = "untitled-todo.md";
  } else if (filePath.includes("/")) {
    label = filePath.split("/").pop()!;
  } else {
    label = filePath.replace("browser://", "");
  }
  return { id: String(tabCounter), filePath, label };
}

function App() {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  // Resolve initial files on mount — start with untitled if none found
  useEffect(() => {
    resolveInitialFilePaths().then((paths) => {
      const newTabs = paths.length > 0 ? paths.map(makeTab) : [makeTab(null)];
      setTabs(newTabs);
      setActiveTabId(newTabs[0].id);
      setInitialized(true);
    });
  }, []);

  const activeFilePath = useMemo(
    () => tabs.find((t) => t.id === activeTabId)?.filePath ?? null,
    [tabs, activeTabId]
  );

  const {
    filePath,
    projectData,
    loading,
    error,
    loadFile,
    updateTasks,
    updateTask,
    addTask,
    updateNotes,
    flushSave,
  } = useProjectFile(activeFilePath);

  const [filterText, setFilterText] = useState("");
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [weekFilter, setWeekFilter] = useState<WeekFilter>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  // Reset filter/notes when switching tabs
  useEffect(() => {
    setFilterText("");
    setShowNotes(false);
    setWeekFilter(null);
    setSelectedTaskId(null);
  }, [activeTabId]);

  const handleAddTab = useCallback(async () => {
    const path = await openFileDialog();
    if (!path) return;
    // Don't open duplicate tabs
    const existing = tabs.find((t) => t.filePath === path);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }
    const tab = makeTab(path);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, [tabs]);

  const handleCloseTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) return prev; // keep at least one tab
        if (id === activeTabId) {
          const newIdx = Math.min(idx, next.length - 1);
          setActiveTabId(next[newIdx].id);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const handleSelectTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  const filteredTasks = useMemo(() => {
    if (!projectData) return [];
    let tasks = projectData.tasks;
    if (hideDone) {
      tasks = tasks.filter((t) => t.status !== "done");
    }
    if (weekFilter) {
      const now = new Date();
      const thisSunday = new Date(now);
      thisSunday.setDate(now.getDate() - now.getDay());
      thisSunday.setHours(0, 0, 0, 0);
      let start: Date, end: Date;
      if (weekFilter === "this_week") {
        start = thisSunday;
        end = new Date(thisSunday);
        end.setDate(end.getDate() + 7);
      } else {
        start = new Date(thisSunday);
        start.setDate(start.getDate() - 7);
        end = thisSunday;
      }
      const inRange = (d: string | undefined) => {
        if (!d) return false;
        const date = new Date(d + "T00:00:00");
        return date >= start && date < end;
      };
      tasks = tasks.filter((t) => inRange(t.created as string) || inRange(t.done as string));
    }
    return tasks;
  }, [projectData, hideDone, weekFilter]);

  // Merge visible (possibly filtered) tasks back into the full task list,
  // preserving any tasks hidden by filters (hideDone, weekFilter, etc.)
  // and respecting reordering (drag-and-drop) within visible tasks.
  const handleTasksChanged = useCallback(
    (visibleTasks: typeof filteredTasks) => {
      if (!projectData) return;

      const isFiltered = hideDone || !!weekFilter;
      if (!isFiltered) {
        updateTasks(visibleTasks);
        return;
      }

      // IDs that were visible before the edit
      const visibleIds = new Set(filteredTasks.map((t) => t.id));

      // Walk the full list. Hidden tasks keep their position.
      // Each "visible slot" is filled with the next task from visibleTasks
      // (which may have been reordered by drag-and-drop or edited).
      const merged: typeof filteredTasks = [];
      let vi = 0;
      for (const task of projectData.tasks) {
        if (!visibleIds.has(task.id)) {
          merged.push(task);
        } else {
          if (vi < visibleTasks.length) {
            merged.push(visibleTasks[vi]);
            vi++;
          }
        }
      }
      // Append any extra tasks (e.g. newly added while filtered)
      while (vi < visibleTasks.length) {
        merged.push(visibleTasks[vi]);
        vi++;
      }

      updateTasks(merged);
    },
    [projectData, filteredTasks, hideDone, weekFilter, updateTasks]
  );

  const selectedTask = useMemo(
    () =>
      selectedTaskId
        ? projectData?.tasks.find((t) => t.id === selectedTaskId) ?? null
        : null,
    [selectedTaskId, projectData?.tasks]
  );

  const handleDescriptionChange = useCallback(
    (taskId: string, description: string) => {
      updateTask(taskId, { description });
    },
    [updateTask]
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      if (!projectData) return;
      updateTasks(projectData.tasks.filter((t) => t.id !== taskId));
      setSelectedTaskId(null);
    },
    [projectData, updateTasks]
  );

  // Click-outside-to-close drawer
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedTaskId) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setSelectedTaskId(null);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [selectedTaskId]);

  // Apply dark mode class
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  // Apply initial group from view config
  useEffect(() => {
    if (projectData?.meta.views.default?.group_by) {
      setGroupBy(projectData.meta.views.default.group_by);
    }
  }, [projectData?.meta.views.default?.group_by]);

  // Cmd+S save handler
  const handleSave = useCallback(async () => {
    if (!projectData) return;
    if (!activeFilePath) {
      // Untitled file — prompt Save As
      const newPath = await saveFileDialog();
      if (!newPath) return;
      const content = serializeProjectMd(projectData);
      await writeFile(newPath, content);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, filePath: newPath, label: newPath.split("/").pop()! }
            : t
        )
      );
    } else {
      flushSave();
    }
  }, [activeFilePath, activeTabId, projectData, flushSave]);

  // Cmd+R (Mac) / Ctrl+R (Win) to refresh current file
  // Cmd+S (Mac) / Ctrl+S (Win) to save
  // Cmd+1..9 (Mac) / Ctrl+1..9 (Win) to switch tabs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
  }, [loadFile, handleSave, tabs]);

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
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onWeekFilterChange={setWeekFilter}
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
    </div>
  );
}

export default App;
