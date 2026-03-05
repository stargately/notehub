import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { resolveInitialFilePaths } from "./useProjectFile";
import { isTauri, openFileDialog } from "../lib/tauri-api";
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
  return { id: String(tabCounter), filePath, label };
}

interface UseTabManagementOptions {
  onTabClosed?: (tabId: string) => void;
  onTabSwitch?: () => void;
}

export function useTabManagement(options: UseTabManagementOptions = {}) {
  const { onTabClosed, onTabSwitch } = options;
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [initialized, setInitialized] = useState(false);

  // Stable refs for callbacks to avoid re-triggering effects
  const onTabClosedRef = useRef(onTabClosed);
  onTabClosedRef.current = onTabClosed;
  const onTabSwitchRef = useRef(onTabSwitch);
  onTabSwitchRef.current = onTabSwitch;

  // Resolve initial files on mount
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

  const terminalCwd = useMemo(() => {
    if (!activeFilePath || activeFilePath.startsWith("browser://")) return undefined;
    const lastSlash = activeFilePath.lastIndexOf("/");
    return lastSlash > 0 ? activeFilePath.substring(0, lastSlash) : undefined;
  }, [activeFilePath]);

  // Reset filter/notes when switching tabs
  useEffect(() => {
    onTabSwitchRef.current?.();
  }, [activeTabId]);

  const handleAddTab = useCallback(async () => {
    const path = await openFileDialog();
    if (!path) return;
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
      unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type !== "drop") return;
        const mdPaths = (event.payload.paths ?? []).filter((p: string) =>
          /\.mdx?$/i.test(p)
        );
        if (mdPaths.length === 0) return;

        setTabs((prev) => {
          const existing = new Set(prev.map((t) => t.filePath));
          const newTabs = mdPaths
            .filter((p: string) => !existing.has(p))
            .map(makeTab);
          if (newTabs.length === 0) {
            const match = prev.find((t) => t.filePath === mdPaths[0]);
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
    handleAddTab, handleCloseTab, handleSelectTab,
  };
}
