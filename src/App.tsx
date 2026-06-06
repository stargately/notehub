import { useState, useRef, useCallback, useEffect, type MutableRefObject } from "react";
import { useDarkMode } from "./hooks/useDarkMode";
import { useTabManagement } from "./hooks/useTabManagement";
import { useWorkspace } from "./hooks/useWorkspace";
import { useFileIndex } from "./hooks/useFileIndex";
import { useKeymapAction } from "./lib/keymap/provider";
import { ACTIONS } from "./lib/keymap/actions";
import { useUndoHistory } from "./hooks/useUndoHistory";
import { useAutoUpdate } from "./hooks/useAutoUpdate";
import { isTauri, getWindowRect } from "./lib/tauri-api";
import { isReleaseOutsideWindow } from "./lib/tear-off";
import { refreshAllDirs } from "./lib/tree-refresh";
import { TabBar } from "./components/TabBar";
import { TerminalPanel } from "./components/TerminalPanel";
import { Sidebar } from "./components/Sidebar";
import { StatusBar } from "./components/StatusBar";
import { useNativeMenu } from "./hooks/useNativeMenu";
import type { FileTreeHandle } from "./components/FileTree";
import { QuickOpen } from "./components/QuickOpen";
import { KeybindingsHelp } from "./components/KeybindingsHelp";
import { DocumentView, type DocCommands } from "./components/DocumentView";
import { Toaster } from "sonner";

function App() {
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalMounted, setTerminalMounted] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [keymapHelpOpen, setKeymapHelpOpen] = useState(false);

  const { darkMode, themeMode, cycleThemeMode } = useDarkMode();
  // Shared, tab-id-keyed undo stacks — survive while a tab is open; cleaned up on close.
  const undoHistory = useUndoHistory();
  useAutoUpdate();

  const {
    workspaceRoot, ready: workspaceReady,
    sidebarOpen, toggleSidebar, openSidebar, sidebarWidth, setSidebarWidth, openFolder, setWorkspace,
  } = useWorkspace();

  const { ensureIndex } = useFileIndex(workspaceRoot);

  // Imperative handle to the file tree, owned here so the top File menu can create at the root.
  const fileTreeRef = useRef<FileTreeHandle>(null);
  const [pendingNew, setPendingNew] = useState<"file" | "folder" | null>(null);
  const triggerNew = useCallback(
    (kind: "file" | "folder") => {
      if (!workspaceRoot) return; // no workspace → nothing to create at root (don't leave pendingNew set)
      openSidebar();
      setPendingNew(kind);
    },
    [openSidebar, workspaceRoot],
  );
  useEffect(() => {
    if (!pendingNew || !sidebarOpen) return;
    const handle = fileTreeRef.current;
    if (!handle) return; // FileTree not mounted yet (no workspace) — leave pending
    if (pendingNew === "file") handle.newFileAtRoot();
    else handle.newFolderAtRoot();
    setPendingNew(null);
  }, [pendingNew, sidebarOpen]);

  const {
    tabs, setTabs, activeTabId, setActiveTabId, initialized,
    activeFilePath, terminalCwd,
    handleAddTab, handleCloseTab, handleSelectTab, openPath,
    renameTabPath, closeTabByPath, detachTab,
  } = useTabManagement({
    workspaceRoot,
    workspaceReady,
    onOpenFolder: setWorkspace,
    onTabClosed: (id) => undoHistory.cleanupTab(id),
  });

  // The active document publishes its command bundle (Cmd+S/R/-/undo/redo) here, so the
  // window-level keymap and File menu act on the focused doc without App owning its state.
  const activeCmdsRef = useRef<MutableRefObject<DocCommands> | null>(null);
  const publishCommands = useCallback((ref: MutableRefObject<DocCommands>) => {
    activeCmdsRef.current = ref;
    return () => {
      if (activeCmdsRef.current === ref) activeCmdsRef.current = null;
    };
  }, []);
  const runActive = useCallback((fn: (c: DocCommands) => void) => {
    const cmds = activeCmdsRef.current?.current;
    if (cmds) fn(cmds);
  }, []);

  // Keep editor subtrees alive once a tab has been viewed (lazy: restored-but-unopened tabs
  // don't instantiate heavy editors until first activated). The active tab always renders.
  const [everActive, setEverActive] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!activeTabId) return;
    setEverActive((prev) => (prev.has(activeTabId) ? prev : new Set(prev).add(activeTabId)));
  }, [activeTabId]);

  // Tab tear-off: a tab dropped outside this window's bounds moves into a new window.
  const handleDetachTab = useCallback(
    async (tabId: string, screenX: number, screenY: number) => {
      try {
        const rect = await getWindowRect();
        if (isReleaseOutsideWindow(screenX, screenY, rect)) {
          await detachTab(tabId, screenX, screenY);
        }
      } catch {
        /* geometry unavailable (e.g. non-Tauri) → treat as in-window, no-op */
      }
    },
    [detachTab],
  );

  // Shared by the Ctrl+` keymap action and the status-bar toggle button.
  const toggleTerminal = useCallback(() => {
    setShowTerminal((prev) => !prev);
    setTerminalMounted(true);
  }, []);

  // ── Global (workspace-level) keymap actions. Per-doc actions delegate to the active tab. ──
  useKeymapAction(ACTIONS.quickOpen, () => setQuickOpenOpen(true));
  useKeymapAction(ACTIONS.openFile, () => void handleAddTab());
  useKeymapAction(ACTIONS.toggleSidebar, () => toggleSidebar());
  useKeymapAction(ACTIONS.toggleTerminal, toggleTerminal);
  useKeymapAction(ACTIONS.copyPath, () => {
    if (activeFilePath) navigator.clipboard.writeText(activeFilePath);
  });
  useKeymapAction(ACTIONS.activateTab, (arg) => {
    const idx = typeof arg === "number" ? arg : 0;
    if (idx >= 0 && idx < tabs.length) setActiveTabId(tabs[idx].id);
  });
  useKeymapAction(ACTIONS.openKeymap, () => setKeymapHelpOpen(true));
  useKeymapAction(ACTIONS.reload, () => runActive((c) => c.reload()));
  useKeymapAction(ACTIONS.save, () => runActive((c) => c.save()));
  useKeymapAction(ACTIONS.toggleRawView, () => runActive((c) => c.toggleView()));
  useKeymapAction(ACTIONS.undo, () => runActive((c) => c.undo()));
  useKeymapAction(ACTIONS.redo, () => runActive((c) => c.redo()));

  // Native OS File menu (macOS top bar). Replaces the old in-window MenuBar; clicks arrive as
  // `menu:*` events routed to the focused window, and we keep the menu's enabled state in sync.
  useNativeMenu(
    {
      onNewFile: () => triggerNew("file"),
      onNewFolder: () => triggerNew("folder"),
      onOpenFile: handleAddTab,
      onOpenFolder: openFolder,
      onQuickOpen: () => setQuickOpenOpen(true),
      onSave: () => runActive((c) => c.save()),
      onRefresh: refreshAllDirs,
      onOpenKeymap: () => setKeymapHelpOpen(true),
    },
    { hasWorkspace: !!workspaceRoot, canSave: tabs.length > 0 },
  );

  if (!initialized) {
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

  return (
    <div className="nh-app-root h-screen flex flex-col" style={{ background: "var(--nh-bg)" }}>
      <Toaster richColors position="bottom-right" theme={darkMode ? "dark" : "light"} />
      <QuickOpen
        open={quickOpenOpen}
        onClose={() => setQuickOpenOpen(false)}
        workspaceRoot={workspaceRoot}
        tabs={tabs}
        ensureIndex={ensureIndex}
        onOpenFile={openPath}
        onOpenFolder={openFolder}
      />
      <KeybindingsHelp open={keymapHelpOpen} onClose={() => setKeymapHelpOpen(false)} />
      <div className="flex-1 flex flex-row overflow-hidden">
        {isTauri && (
          <Sidebar
            open={sidebarOpen}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            workspaceRoot={workspaceRoot}
            activeFilePath={activeFilePath}
            onOpenFile={openPath}
            onOpenFolder={openFolder}
            treeRef={fileTreeRef}
            onRenamed={renameTabPath}
            onDeleted={closeTabByPath}
          />
        )}
        <div className="flex-1 flex flex-col overflow-hidden">
          {isTauri && tabs.length > 0 && (
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSelectTab={handleSelectTab}
              onCloseTab={handleCloseTab}
              onAddTab={handleAddTab}
              onDetachTab={handleDetachTab}
            />
          )}

          {tabs.length === 0 ? (
            // No open tabs — no auto-created untitled doc. The sidebar tree and File menu stay
            // available to open or create a file.
            <div className="flex-1 flex items-center justify-center nh-fade-in">
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl mx-auto mb-4 flex items-center justify-center" style={{ background: "var(--nh-accent-subtle)" }}>
                  <svg className="w-5 h-5" style={{ color: "var(--nh-accent)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold mb-1" style={{ color: "var(--nh-text)" }}>
                  Welcome to NoteHub
                </h2>
                <p className="text-sm" style={{ color: "var(--nh-text-secondary)" }}>
                  Create or open a file from the sidebar or the File menu to get started.
                </p>
              </div>
            </div>
          ) : (
            // One mounted DocumentView per (viewed) tab; only the active one is visible. Each owns
            // its own buffer + path + autosave, so one tab can never write onto another's file.
            tabs.map((tab) =>
              tab.id === activeTabId || everActive.has(tab.id) ? (
                <div
                  key={tab.id}
                  className="flex-1 flex flex-col overflow-hidden min-h-0"
                  style={{ display: tab.id === activeTabId ? "flex" : "none" }}
                >
                  <DocumentView
                    tabId={tab.id}
                    filePath={tab.filePath}
                    kind={tab.kind}
                    active={tab.id === activeTabId}
                    darkMode={darkMode}
                    setTabs={setTabs}
                    undoHistory={undoHistory}
                    publishCommands={publishCommands}
                  />
                </div>
              ) : null
            )
          )}

          {terminalMounted && (
            <TerminalPanel
              visible={showTerminal}
              cwd={terminalCwd}
              onClose={() => setShowTerminal(false)}
            />
          )}
        </div>
      </div>

      <StatusBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        terminalVisible={showTerminal}
        onToggleTerminal={toggleTerminal}
        themeMode={themeMode}
        onCycleTheme={cycleThemeMode}
        workspaceRoot={workspaceRoot}
      />
    </div>
  );
}

export default App;
