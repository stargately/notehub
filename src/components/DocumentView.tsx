import { useState, useRef, useCallback, useEffect, useMemo, memo, type MutableRefObject } from "react";
import { useProjectFile } from "../hooks/useProjectFile";
import { useViewMode } from "../hooks/useViewMode";
import { useTaskFilters } from "../hooks/useTaskFilters";
import { useFileSync } from "../hooks/useFileSync";
import { useFileWatcher } from "../hooks/useFileWatcher";
import { useClickOutside } from "../hooks/useClickOutside";
import { useKeymapContext, useKeymapAction } from "../lib/keymap/provider";
import { CONTEXTS, ACTIONS } from "../lib/keymap/actions";
import { serializeProjectMd } from "../lib/markdown-parser";
import { parseOutline, findDomHeadingIndex } from "../lib/outline";
import { computeDocStats, publishDocStats } from "../lib/doc-stats";
import { deriveBaseName } from "../lib/print";
import type { ProjectData, TabInfo, WeekFilter, FileKind, Task } from "../lib/types";
import type { UndoHistory } from "../hooks/useUndoHistory";
import { TaskTable } from "./TaskTable";
import { Toolbar } from "./Toolbar";
import { ProjectNotes } from "./ProjectNotes";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { MarkdownEditor } from "./MarkdownEditor";
import { RawFileEditor } from "./RawFileEditor";
import { QaLayout } from "./QaLayout";
import { OutlinePanel } from "./OutlinePanel";
import { GoToHeading } from "./GoToHeading";
import { ConflictModal } from "./ConflictModal";

/** Whether the outline panel was left open — a global preference, read per tab on mount. */
const OUTLINE_OPEN_KEY = "nh-outline-open";

const WYSIWYG_HEADING_SELECTOR = [1, 2, 3, 4, 5, 6]
  .map((n) => `.nh-qa-doc .ProseMirror h${n}`)
  .join(", ");

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
  /**
   * Sidebar open/closed. Threaded to the editors purely as a width-reflow signal: when it flips, the
   * document area's width changes and wrapped text reflows, so the editor preserves its scroll
   * fraction across the toggle (see MarkdownEditor / QaLayout). A resize *drag* changes `sidebarWidth`,
   * not this boolean, so the editors never fight the drag.
   */
  sidebarOpen?: boolean;
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
function DocumentViewImpl({
  tabId, filePath, kind, active, darkMode, sidebarOpen, setTabs, undoHistory, publishCommands,
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

  // Carries scroll progress (0..1) across a Cmd+/ view toggle: the outgoing view (QaLayout or the
  // raw Monaco editor) writes its fraction on unmount, the incoming one restores it on mount, so
  // toggling lands at roughly the same place instead of the top.
  const viewScrollRef = useRef<number | null>(null);

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
    viewMode, editorContent, editorContentRef,
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

  // Stable so it doesn't defeat TaskTable's React.memo on non-data re-renders (drawer/notes toggles).
  const handleTaskSelected = useCallback((task: Task) => setSelectedTaskId(task.id), []);

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

  // ── Document outline + go-to-heading. Available whenever a markdown view is showing: the
  // WYSIWYG (QaLayout) or the raw Monaco editor — not the task grid or raw/image files. ──
  const showsMarkdownView = !isRawFile && !!projectData && (isRawDoc || viewMode === "editor");
  const [outlineOpen, setOutlineOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(OUTLINE_OPEN_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [gotoOpen, setGotoOpen] = useState(false);
  const contentAreaRef = useRef<HTMLDivElement>(null);
  // Filled by the mounted Monaco editor (cleared on its unmount): jump-to-line for the raw view.
  const revealLineRef = useRef<((line: number) => void) | null>(null);

  const toggleOutline = useCallback(() => {
    setOutlineOpen((v) => {
      try {
        localStorage.setItem(OUTLINE_OPEN_KEY, v ? "0" : "1");
      } catch {
        /* preference only */
      }
      return !v;
    });
  }, []);

  // Both views edit the same raw string, so one parse serves Monaco (by line) and the WYSIWYG
  // (by rendered heading element). Recomputed when the (debounced-save, live-updated) content changes.
  const outline = useMemo(
    () => (showsMarkdownView ? parseOutline(editorContent) : []),
    [showsMarkdownView, editorContent],
  );
  const outlineRef = useRef(outline);
  outlineRef.current = outline;

  const jumpToHeading = useCallback(
    (index: number) => {
      const headings = outlineRef.current;
      const h = headings[index];
      if (!h) return;
      if (revealLineRef.current) {
        // Raw Monaco view — `line` is 0-based in the same string Monaco shows.
        revealLineRef.current(h.line + 1);
        return;
      }
      // WYSIWYG view — map the heading to its rendered element and scroll it into view.
      const container = contentAreaRef.current;
      if (!container) return;
      const els = Array.from(container.querySelectorAll<HTMLElement>(WYSIWYG_HEADING_SELECTOR));
      const dom = els.map((el) => ({
        level: Number(el.tagName.charAt(1)),
        text: el.textContent ?? "",
      }));
      const at = findDomHeadingIndex(headings, index, dom);
      if (at >= 0) els[at].scrollIntoView({ block: "start", behavior: "smooth" });
    },
    [],
  );

  // Cmd+Shift+O (go-to-heading) + the remappable outline toggle — active markdown views only.
  useKeymapAction(ACTIONS.goToSymbol, () => setGotoOpen(true), active && showsMarkdownView);
  useKeymapAction(ACTIONS.toggleOutline, toggleOutline, active && showsMarkdownView);

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
    if (!loadPath) return;
    // `mine` is a getter: reconcile's disk read is async, and a watcher event can land between a
    // keystroke and its React commit — `editorContentRef` is updated synchronously on edit, so the
    // comparison sees the freshest buffer instead of one a keystroke behind (which would misread a
    // genuine local edit as "not editing" and live-reload over it, remounting the editor).
    fileSync.reconcile(loadPath, () => (isRawDoc ? editorContentRef.current : currentBytes), loadFile);
  };
  const handleExternalChange = useCallback(() => reconcileRef.current(), []);
  useFileWatcher(loadPath, handleExternalChange);

  // ── Live doc stats for the status bar. Only the active tab publishes (the DocCommands model);
  // the module store (lib/doc-stats.ts) means a stats tick re-renders only StatusBar, not App.
  // `currentBytes` covers every doc type (raw string for qa/plain, serialized for todo); raw/image
  // files are self-contained in RawFileEditor and publish nothing. The first publish after
  // activation/load is immediate (a tab switch shouldn't lag); edits are debounced. ──
  const statsPublishedRef = useRef(false);
  // For one commit after a raw doc loads, `editorContent` hasn't been seeded from `rawContent`
  // yet — publishing then would flash "0 words" before the debounce corrects it. Hold the first
  // publish until the seed lands. Gated on "not yet published" so a doc the user *empties* later
  // still updates to 0 (only the initial-load window is treated as unseeded).
  const seedPending =
    isRawDoc && !!projectData && editorContent === "" && projectData.rawContent !== "";
  const statsSource =
    !isRawFile && projectData && !(seedPending && !statsPublishedRef.current) ? currentBytes : null;
  useEffect(() => {
    if (!active || statsSource == null) return;
    if (!statsPublishedRef.current) {
      statsPublishedRef.current = true;
      publishDocStats(computeDocStats(statsSource));
      return;
    }
    const t = setTimeout(() => publishDocStats(computeDocStats(statsSource)), 300);
    return () => clearTimeout(t);
  }, [active, statsSource]);
  useEffect(() => {
    if (!active) return;
    // Deactivation/unmount clears the bar. React runs all cleanups before the next commit's
    // effects, so on a tab switch this null always lands before the incoming tab's publish.
    return () => {
      statsPublishedRef.current = false;
      publishDocStats(null);
    };
  }, [active]);

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

      {showsMarkdownView && (
        <GoToHeading
          open={gotoOpen}
          onClose={() => setGotoOpen(false)}
          headings={outline}
          onJump={jumpToHeading}
        />
      )}

      <div className="flex-1 flex flex-row overflow-hidden min-h-0">
        <div ref={contentAreaRef} className="flex-1 flex flex-col overflow-hidden min-w-0">
          {viewMode === "editor" ? (
            <>
              <div className="nh-doc-header">
                <span className="text-[13px] font-semibold truncate" style={{ color: "var(--nh-text)" }}>
                  {deriveBaseName(filePath) || "Untitled"}
                </span>
                <span className="text-[10px] uppercase tracking-wide shrink-0" style={{ color: "var(--nh-text-tertiary)" }}>
                  Markdown
                </span>
                <div className="flex-1" />
                <button
                  onClick={toggleOutline}
                  className="nh-icon-btn"
                  title="Toggle outline"
                  aria-pressed={outlineOpen}
                  style={outlineOpen ? { color: "var(--nh-accent)" } : undefined}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M9 12h11M13 18h7" />
                  </svg>
                </button>
                <button
                  onClick={handleToggleViewMode}
                  className="nh-icon-btn"
                  title={`Grid view (${navigator.platform.includes("Mac") ? "⌘/" : "Ctrl+/"})`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden">
                <MarkdownEditor
                  content={editorContent}
                  onChange={handleEditorChange}
                  darkMode={darkMode}
                  scrollRef={viewScrollRef}
                  sidebarOpen={sidebarOpen}
                  revealLineRef={revealLineRef}
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
              darkMode={darkMode}
              scrollRef={viewScrollRef}
              sidebarOpen={sidebarOpen}
              fileName={deriveBaseName(filePath)}
              filePath={filePath}
              variant={isQa ? "qa" : "plain"}
              active={active}
              outlineOpen={outlineOpen}
              onToggleOutline={toggleOutline}
            />
          ) : (
            <>
              <Toolbar
                fileName={deriveBaseName(filePath)}
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
                          onTaskSelected={handleTaskSelected}
                        />
                      </div>

                      {selectedTask && (
                        <div ref={drawerRef}>
                          <TaskDetailDrawer
                            task={selectedTask}
                            onDescriptionChange={handleDescriptionChange}
                            onDelete={handleDeleteTask}
                            onClose={() => setSelectedTaskId(null)}
                            active={active}
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
        </div>

        {showsMarkdownView && outlineOpen && (
          <OutlinePanel headings={outline} onJump={jumpToHeading} onClose={toggleOutline} />
        )}
      </div>
    </>
  );
}

/**
 * Memoized so unrelated `App` re-renders (sidebar-resize drag, terminal/quick-open toggles, theme,
 * tab switches of *other* tabs) don't re-render this tab's whole editor subtree. App passes only
 * stable props (primitives + the stable `setTabs`/`undoHistory`/`publishCommands`), so the shallow
 * compare holds; this tab re-renders only when its own `active`/`filePath`/`darkMode` actually change.
 */
export const DocumentView = memo(DocumentViewImpl);
