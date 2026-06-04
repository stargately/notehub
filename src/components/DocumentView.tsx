import { useState, useRef, useCallback, useEffect, type MutableRefObject } from "react";
import { useProjectFile } from "../hooks/useProjectFile";
import { useViewMode } from "../hooks/useViewMode";
import { useTaskFilters } from "../hooks/useTaskFilters";
import { useFileSync } from "../hooks/useFileSync";
import { useFileWatcher } from "../hooks/useFileWatcher";
import { useClickOutside } from "../hooks/useClickOutside";
import { useKeymapContext } from "../lib/keymap/provider";
import { CONTEXTS } from "../lib/keymap/actions";
import { serializeProjectMd } from "../lib/markdown-parser";
import { deriveBaseName } from "../lib/print";
import type { ProjectData, TabInfo, WeekFilter, FileKind } from "../lib/types";
import type { ThemeMode } from "../hooks/useDarkMode";
import type { UndoHistory } from "../hooks/useUndoHistory";
import { TaskTable } from "./TaskTable";
import { Toolbar } from "./Toolbar";
import { ProjectNotes } from "./ProjectNotes";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { MarkdownEditor } from "./MarkdownEditor";
import { RawFileEditor } from "./RawFileEditor";
import { QaLayout } from "./QaLayout";
import { ThemeIcon } from "./ThemeIcon";
import { ConflictModal } from "./ConflictModal";

/**
 * The commands the active document exposes to the global keymap / menu (Cmd+S, Cmd+R, Cmd+/,
 * undo, redo). Each tab's DocumentView publishes its own bundle when it becomes active, so the
 * window-level shortcuts always act on the focused document without App reaching into its state.
 */
export interface DocCommands {
  save: () => void;
  reload: () => void;
  toggleView: () => void;
  undo: () => void;
  redo: () => void;
}

interface DocumentViewProps {
  tabId: string;
  filePath: string | null;
  kind: FileKind;
  /** Whether this is the active (focused, visible) tab. Gates keymap registration & command publish. */
  active: boolean;
  darkMode: boolean;
  themeMode: ThemeMode;
  onCycleTheme: () => void;
  /** Used by Save-As on an untitled doc to point this tab at its new path. */
  setTabs: React.Dispatch<React.SetStateAction<TabInfo[]>>;
  /** Shared, tab-id-keyed undo stacks (survive as long as the tab is open). */
  undoHistory: UndoHistory;
  /** Register this doc's command bundle while active; returns an unregister (race-safe). */
  publishCommands: (cmds: MutableRefObject<DocCommands>) => () => void;
}

/**
 * A single open document — Zed's "buffer + view" as one self-contained React subtree. It owns its
 * own content, file-sync baseline, dirty state, autosave, and per-tab UI (filter, selection, view
 * mode), all bound to its **own fixed `filePath`**. Because every write target is captured from
 * this instance's props — never read from a global "active file" — one tab can never write its
 * content onto another. All open tabs stay mounted (visibility-toggled by App); only the active
 * one registers keymap actions/contexts.
 */
export function DocumentView({
  tabId, filePath, kind, active, darkMode, themeMode, onCycleTheme, setTabs, undoHistory, publishCommands,
}: DocumentViewProps) {
  const isRawFile = kind === "raw" || kind === "image";

  // Per-tab UI state (each tab remembers its own filter / grouping / selection / notes).
  const [filterText, setFilterText] = useState("");
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(false);
  const [weekFilter, setWeekFilter] = useState<WeekFilter>(null);
  const [highlightTaskId, setHighlightTaskId] = useState<string | null>(null);

  // Content-based disk reconciliation, scoped to this one file (one tab per path → no sharing).
  const fileSync = useFileSync();

  // Debounced onBeforeSave: coalesce rapid edits into one undo snapshot for this tab.
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSnapshotRef = useRef<string | null>(null);

  const flushPendingSnapshot = useCallback(() => {
    if (snapshotTimerRef.current) {
      clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = null;
    }
    if (pendingSnapshotRef.current) {
      undoHistory.pushSnapshot(tabId, pendingSnapshotRef.current);
      pendingSnapshotRef.current = null;
    }
  }, [tabId, undoHistory]);

  const onBeforeSave = useCallback(
    (currentData: ProjectData) => {
      const snapshot = serializeProjectMd(currentData);
      pendingSnapshotRef.current = snapshot;
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current);
      snapshotTimerRef.current = setTimeout(() => {
        if (pendingSnapshotRef.current) {
          undoHistory.pushSnapshot(tabId, pendingSnapshotRef.current);
          pendingSnapshotRef.current = null;
        }
      }, 500);
    },
    [tabId, undoHistory]
  );

  // Init undo history when file data loads (from inside loadFile to avoid races with stale data).
  const onDataLoaded = useCallback((data: ProjectData) => {
    // QA/plain docs are edited as raw markdown; only `layout: todo` serializes from tasks.
    const snapshot = data.meta.layout !== "todo" ? data.rawContent : serializeProjectMd(data);
    undoHistory.initTab(tabId, snapshot);
  }, [tabId, undoHistory]);

  const {
    filePath: loadPath, loadedPath, projectData, loading,
    loadFile, updateTasks, updateTask, addTask, updateNotes,
    replaceFromRaw, flushSave,
  } = useProjectFile(isRawFile ? null : filePath, onBeforeSave, onDataLoaded, fileSync);

  const {
    viewMode, editorContent,
    handleToggleViewMode, handleEditorChange, handleSave,
  } = useViewMode({
    activeTabId: tabId, activeFilePath: filePath, projectData, loadedPath,
    replaceFromRaw, flushSave, setTabs,
    setSelectedTaskId, setShowNotes,
    undoHistory, sync: fileSync,
  });

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

  const drawerRef = useRef<HTMLDivElement>(null);
  useClickOutside(drawerRef, !!selectedTaskId, () => setSelectedTaskId(null));

  const handleUndoExhausted = useCallback(() => {
    flushPendingSnapshot();
    undoHistory.suppressNextPush();
    return undoHistory.undo(tabId);
  }, [tabId, undoHistory, flushPendingSnapshot]);

  const handleRedoExhausted = useCallback(() => {
    undoHistory.suppressNextPush();
    return undoHistory.redo(tabId);
  }, [tabId, undoHistory]);

  const isQa = projectData?.meta.layout === "qa";
  // "raw unless todo": both `layout: qa` and plain (no-layout) docs are edited as raw markdown.
  const isRawDoc = !!projectData && projectData.meta.layout !== "todo";

  // ── Keymap contexts — only the active tab contributes them. ──
  useKeymapContext(CONTEXTS.grid, active && !!projectData && !isRawDoc && !isRawFile && viewMode === "grid");
  useKeymapContext(CONTEXTS.editor, active && !!projectData && !isRawDoc && !isRawFile && viewMode === "editor");
  useKeymapContext(CONTEXTS.qa, active && !!projectData && isRawDoc && !isRawFile);
  useKeymapContext(CONTEXTS.rawFile, active && isRawFile);

  // ── Command bundle (Cmd+S/R/-/undo/redo) published to App when this tab is active. ──
  const doUndo = useCallback(() => {
    if (isRawFile) return;
    flushPendingSnapshot();
    const snapshot = undoHistory.undo(tabId);
    if (snapshot) {
      undoHistory.suppressNextPush();
      replaceFromRaw(snapshot);
    }
  }, [isRawFile, flushPendingSnapshot, undoHistory, tabId, replaceFromRaw]);

  const doRedo = useCallback(() => {
    if (isRawFile) return;
    flushPendingSnapshot();
    const snapshot = undoHistory.redo(tabId);
    if (snapshot) {
      undoHistory.suppressNextPush();
      replaceFromRaw(snapshot);
    }
  }, [isRawFile, flushPendingSnapshot, undoHistory, tabId, replaceFromRaw]);

  // Raw/image docs autosave themselves (RawFileEditor) and have no grid/editor mode, so Cmd+S /
  // Cmd+/ are no-ops here (RawFileEditor handles its own Cmd+R reload).
  const cmdsRef = useRef<DocCommands>({ save: () => {}, reload: () => {}, toggleView: () => {}, undo: () => {}, redo: () => {} });
  cmdsRef.current = {
    save: () => { if (!isRawFile) handleSave(); },
    reload: () => { if (!isRawFile) loadFile(); },
    toggleView: () => { if (!isRawFile) handleToggleViewMode(); },
    undo: doUndo,
    redo: doRedo,
  };
  useEffect(() => {
    if (!active) return;
    return publishCommands(cmdsRef);
  }, [active, publishCommands]);

  // ── File watcher → reconcile against disk (clean buffer reloads, dirty buffer conflicts). ──
  const currentBytes = isRawDoc
    ? editorContent
    : projectData
    ? serializeProjectMd(projectData)
    : "";
  const reconcileRef = useRef<() => void>(() => {});
  reconcileRef.current = () => {
    if (loadPath) fileSync.reconcile(loadPath, currentBytes, loadFile);
  };
  const handleExternalChange = useCallback(() => reconcileRef.current(), []);
  useFileWatcher(loadPath, handleExternalChange);

  // Raw/image files: RawFileEditor is fully self-contained (own sync + conflict + reload).
  if (isRawFile && filePath) {
    return <RawFileEditor filePath={filePath} kind={kind} darkMode={darkMode} />;
  }

  return (
    <>
      {active && (
        <ConflictModal
          conflict={fileSync.conflict}
          onKeepDisk={() => fileSync.resolveKeepDisk(loadFile)}
          onKeepMine={() => fileSync.resolveKeepMine()}
        />
      )}

      {viewMode === "editor" ? (
        <>
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
            <button
              onClick={onCycleTheme}
              className="nh-btn"
              style={{ padding: "6px 8px" }}
              title={`Theme: ${themeMode} (click to cycle)`}
            >
              <ThemeIcon themeMode={themeMode} />
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
      ) : isRawDoc ? (
        <QaLayout
          content={editorContent}
          onChange={handleEditorChange}
          onToggleEditor={handleToggleViewMode}
          onCycleTheme={onCycleTheme}
          themeMode={themeMode}
          darkMode={darkMode}
          projectName={projectData?.meta.project}
          fileName={deriveBaseName(filePath)}
          variant={isQa ? "qa" : "plain"}
          active={active}
        />
      ) : (
        <>
          <Toolbar
            meta={projectData?.meta ?? { project: "", created: "", views: {}, columns: [], status_options: [], priority_options: [], assignee_options: [] }}
            filterText={filterText}
            groupBy={groupBy}
            hideDone={hideDone}
            showNotes={showNotes}
            weekFilter={weekFilter}
            onFilterChange={setFilterText}
            onGroupByChange={setGroupBy}
            onToggleHideDone={() => setHideDone(!hideDone)}
            onAddTask={handleAddTask}
            onToggleNotes={() => setShowNotes(!showNotes)}
            themeMode={themeMode}
            onCycleTheme={onCycleTheme}
            onWeekFilterChange={setWeekFilter}
            onToggleEditor={handleToggleViewMode}
            active={active}
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
    </>
  );
}
