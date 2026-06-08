import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { resolveInitialSession } from "./useProjectFile";
import {
  isTauri,
  openFileDialog,
  saveSession,
  noteRecentDocument,
  getWindowLabel,
  isDirectory,
  canonicalizePath,
  startWatching,
  getWindowFiles,
  detachTab as detachTabApi,
} from "../lib/tauri-api";
import { fileKindForPath } from "../lib/file-kind";
import { parentDir, isUnderRoot } from "../lib/tree-refresh";
import { noteOpened } from "../lib/recent-files";
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
  // Current tabs snapshot for callbacks (e.g. closeTabByPath) that shouldn't re-create on change.
  const tabsRef = useRef<TabInfo[]>(tabs);
  tabsRef.current = tabs;
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

  // Resolve initial files on mount. A spawned workspace window opens its folder (from
  // useWorkspace) with no tabs; only the main window restores the session. We never auto-open
  // an untitled doc — the empty state shows the welcome/file-tree, and new files are created
  // from the sidebar or File menu.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const main = (await getWindowLabel()) === "main";
      if (cancelled) return;
      setIsMainWindow(main);
      if (!main) {
        // A spawned window opens any files torn off into it (tab tear-off); a plain
        // folder-workspace window gets none and starts empty (its folder comes from useWorkspace).
        const files = await getWindowFiles();
        if (cancelled) return;
        const canonical = await Promise.all(files.map((p) => canonicalizePath(p)));
        if (cancelled) return;
        const fresh = canonical.map(makeTab);
        setTabs(fresh);
        setActiveTabId(fresh.length > 0 ? fresh[0].id : "");
        setInitialized(true);
        return;
      }
      const { paths, activeIndex } = await resolveInitialSession();
      if (cancelled) return;
      // Canonicalize so restored tabs match the watcher's realpath events (live reload).
      const canonicalPaths = await Promise.all(paths.map((p) => canonicalizePath(p)));
      if (cancelled) return;
      const newTabs = canonicalPaths.map(makeTab);
      if (newTabs.length > 0) {
        const idx = Math.min(Math.max(activeIndex, 0), newTabs.length - 1);
        setTabs(newTabs);
        setActiveTabId(newTabs[idx].id);
      } else {
        setTabs([]);
        setActiveTabId("");
      }
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
  // sidebar, drag-drop, and OS file association. Canonicalizes the path so it matches the
  // watcher's realpath events, and ensures a watcher covers it so the editor live-reloads on
  // external edits (files inside the workspace are already covered by the recursive root watcher).
  const openPath = useCallback(
    async (path: string) => {
      const canonical = await canonicalizePath(path);
      noteRecentDocument(canonical);
      noteOpened(canonical); // in-memory MRU for the Cmd+P finder's empty-query ordering
      if (!isUnderRoot(canonical, workspaceRoot)) {
        startWatching(parentDir(canonical));
      }
      setTabs((prev) => {
        const existing = prev.find((t) => t.filePath === canonical);
        if (existing) {
          setActiveTabId(existing.id);
          return prev;
        }
        const tab = makeTab(canonical);
        setActiveTabId(tab.id);
        return [...prev, tab];
      });
    },
    [workspaceRoot],
  );
  // Stable ref so the drag-drop / open-files listeners (mounted once) call the latest openPath.
  const openPathRef = useRef(openPath);
  openPathRef.current = openPath;

  const handleAddTab = useCallback(async () => {
    const path = await openFileDialog();
    if (path) await openPath(path);
  }, [openPath]);

  const handleCloseTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        const next = prev.filter((t) => t.id !== id);
        // Closing the last tab is allowed — it falls back to the empty pane (no auto untitled
        // doc); the sidebar + File menu remain available to open or create files.
        if (id === activeTabId) {
          setActiveTabId(next.length === 0 ? "" : next[Math.min(idx, next.length - 1)].id);
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

  // After a tree rename, point any open tab at the new path (also handles descendants of a
  // renamed folder, whose paths share the old folder prefix).
  const renameTabPath = useCallback((oldPath: string, newPath: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (!t.filePath) return t;
        if (t.filePath === oldPath) {
          return { ...t, filePath: newPath, label: newPath.split("/").pop() ?? t.label };
        }
        const prefix = oldPath.endsWith("/") ? oldPath : oldPath + "/";
        if (t.filePath.startsWith(prefix)) {
          const moved = newPath + t.filePath.slice(oldPath.length);
          return { ...t, filePath: moved, label: moved.split("/").pop() ?? t.label };
        }
        return t;
      }),
    );
  }, []);

  // After a tree delete, close any open tab for the path or anything beneath it (folder delete).
  const closeTabByPath = useCallback(
    (path: string) => {
      const prefix = path.endsWith("/") ? path : path + "/";
      tabsRef.current
        .filter((t) => t.filePath === path || (t.filePath?.startsWith(prefix) ?? false))
        .forEach((t) => handleCloseTab(t.id));
    },
    [handleCloseTab],
  );

  // Tear a tab off into a new window at the release point, then close it here (move semantics).
  // Only real on-disk files detach (untitled / browser:// tabs have nothing to open elsewhere).
  // If the new window fails to build we keep the source tab (no data loss).
  const detachTab = useCallback(
    async (tabId: string, screenX: number, screenY: number) => {
      const tab = tabsRef.current.find((t) => t.id === tabId);
      if (!tab?.filePath || tab.filePath.startsWith("browser://")) return;
      try {
        await detachTabApi(tab.filePath, screenX, screenY);
        handleCloseTab(tabId);
      } catch {
        /* window build failed — leave the tab where it is */
      }
    },
    [handleCloseTab],
  );

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
        for (let i = 0; i < dropped.length; i++) {
          if (dirFlags[i]) onOpenFolderRef.current?.(dropped[i]);
          else await openPathRef.current(dropped[i]);
        }
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
      unlisten = await listen<string[]>("open-files", async (event) => {
        for (const p of event.payload) await openPathRef.current(p);
      });
    })();

    return () => unlisten?.();
  }, []);

  return {
    tabs, setTabs, activeTabId, setActiveTabId, initialized,
    activeFilePath, terminalCwd,
    handleAddTab, handleCloseTab, handleSelectTab, openPath,
    renameTabPath, closeTabByPath, detachTab,
  };
}
