import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { resolveInitialSession } from "./useProjectFile";
import { isTauri, openFileDialog, saveSession, noteRecentDocument, getWindowLabel, isDirectory } from "../lib/tauri-api";
import { fileKindForPath } from "../lib/file-kind";
import type { TabInfo } from "../lib/types";

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
  return { id: String(tabCounter), filePath, label, kind: fileKindForPath(filePath) };
}

interface UseTabManagementOptions {
  onTabClosed?: (tabId: string) => void;
  onTabSwitch?: () => void;
  /** Open a dropped folder as a workspace (routed here so drag-drop can split files vs dirs). */
  onOpenFolder?: (path: string) => void;
  /** Current workspace root, persisted alongside the open tabs. */
  workspaceRoot?: string | null;
  /** Whether the workspace has finished resolving — gates session-save to avoid clobbering. */
  workspaceReady?: boolean;
}

export function useTabManagement(options: UseTabManagementOptions = {}) {
  const { onTabClosed, onTabSwitch, onOpenFolder, workspaceRoot = null, workspaceReady = true } = options;
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  // The persisted session belongs to the main window only; spawned workspace windows
  // (label "workspace-N") start fresh and never write the shared session file.
  const [isMainWindow, setIsMainWindow] = useState(true);

  // Stable refs for callbacks to avoid re-triggering effects
  const onTabClosedRef = useRef(onTabClosed);
  onTabClosedRef.current = onTabClosed;
  const onTabSwitchRef = useRef(onTabSwitch);
  onTabSwitchRef.current = onTabSwitch;
  const onOpenFolderRef = useRef(onOpenFolder);
  onOpenFolderRef.current = onOpenFolder;

  // Resolve initial files on mount. A spawned workspace window starts with a single fresh
  // tab (its folder comes from useWorkspace); only the main window restores the session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const main = (await getWindowLabel()) === "main";
      if (cancelled) return;
      setIsMainWindow(main);
      if (!main) {
        const fresh = [makeTab(null)];
        setTabs(fresh);
        setActiveTabId(fresh[0].id);
        setInitialized(true);
        return;
      }
      const { paths, activeIndex } = await resolveInitialSession();
      if (cancelled) return;
      const newTabs = paths.length > 0 ? paths.map(makeTab) : [makeTab(null)];
      const idx = Math.min(Math.max(activeIndex, 0), newTabs.length - 1);
      setTabs(newTabs);
      setActiveTabId(newTabs[idx].id);
      setInitialized(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist session (open file paths + active tab index + workspace root) whenever they change.
  // Wait for the workspace to resolve so we don't overwrite the persisted root with null.
  useEffect(() => {
    if (!initialized || !workspaceReady || !isMainWindow) return;
    const persistable = tabs
      .map((t, i) => ({ path: t.filePath, index: i, id: t.id }))
      .filter(
        (entry): entry is { path: string; index: number; id: string } =>
          !!entry.path && !entry.path.startsWith("browser://"),
      );
    const paths = persistable.map((e) => e.path);
    const active = persistable.findIndex((e) => e.id === activeTabId);
    saveSession(paths, active >= 0 ? active : 0, workspaceRoot);
  }, [tabs, activeTabId, initialized, workspaceRoot, workspaceReady, isMainWindow]);

  const activeFilePath = useMemo(
    () => tabs.find((t) => t.id === activeTabId)?.filePath ?? null,
    [tabs, activeTabId]
  );

  const terminalCwd = useMemo(() => {
    if (!activeFilePath || activeFilePath.startsWith("browser://")) return undefined;
    const lastSlash = activeFilePath.lastIndexOf("/");
    return lastSlash > 0 ? activeFilePath.substring(0, lastSlash) : undefined;
  }, [activeFilePath]);

  // Reset filter/notes when switching tabs
  useEffect(() => {
    onTabSwitchRef.current?.();
  }, [activeTabId]);

  // Open a file path as a tab (focus it if already open). Shared by the dialog, the file-tree
  // sidebar, drag-drop, and OS file association.
  const openPath = useCallback((path: string) => {
    noteRecentDocument(path);
    setTabs((prev) => {
      const existing = prev.find((t) => t.filePath === path);
      if (existing) {
        setActiveTabId(existing.id);
        return prev;
      }
      const tab = makeTab(path);
      setActiveTabId(tab.id);
      return [...prev, tab];
    });
  }, []);

  const handleAddTab = useCallback(async () => {
    const path = await openFileDialog();
    if (path) openPath(path);
  }, [openPath]);

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
      onTabClosedRef.current?.(id);
    },
    [activeTabId]
  );

  const handleSelectTab = useCallback((id: string) => {
    setActiveTabId(id);
  }, []);

  // Drag-and-drop markdown files to open as tabs
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;

    (async () => {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
        if (event.payload.type !== "drop") return;
        const dropped = event.payload.paths ?? [];
        if (dropped.length === 0) return;

        // Folders open as a workspace; files open as tabs (md → its views, others as raw/image).
        const dirFlags = await Promise.all(dropped.map((p: string) => isDirectory(p)));
        const folders = dropped.filter((_: string, i: number) => dirFlags[i]);
        const files = dropped.filter((_: string, i: number) => !dirFlags[i]);
        for (const f of folders) onOpenFolderRef.current?.(f);
        if (files.length === 0) return;
        for (const p of files) noteRecentDocument(p);

        setTabs((prev) => {
          const existing = new Set(prev.map((t) => t.filePath));
          const newTabs = files
            .filter((p: string) => !existing.has(p))
            .map(makeTab);
          if (newTabs.length === 0) {
            const match = prev.find((t) => t.filePath === files[0]);
            if (match) setActiveTabId(match.id);
            return prev;
          }
          setActiveTabId(newTabs[newTabs.length - 1].id);
          return [...prev, ...newTabs];
        });
      });
    })();

    return () => unlisten?.();
  }, []);

  // Handle files opened via OS file association (e.g. drag to Dock icon)
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;

    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<string[]>("open-files", (event) => {
        const paths = event.payload;
        if (paths.length === 0) return;

        setTabs((prev) => {
          const existing = new Set(prev.map((t) => t.filePath));
          const newTabs = paths
            .filter((p) => !existing.has(p))
            .map(makeTab);
          if (newTabs.length === 0) {
            const match = prev.find((t) => t.filePath === paths[0]);
            if (match) setActiveTabId(match.id);
            return prev;
          }
          setActiveTabId(newTabs[newTabs.length - 1].id);
          return [...prev, ...newTabs];
        });
      });
    })();

    return () => unlisten?.();
  }, []);

  return {
    tabs, setTabs, activeTabId, setActiveTabId, initialized,
    activeFilePath, terminalCwd,
    handleAddTab, handleCloseTab, handleSelectTab, openPath,
  };
}
