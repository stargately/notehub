import { useState, useEffect, useCallback, useRef } from "react";
import {
  isTauri,
  openFolderDialog,
  openWorkspaceWindow,
  getWindowWorkspace,
  getInitialSession,
  setWorkspaceRoot as registerWorkspaceRoot,
  startWatching,
  canonicalizePath,
} from "../lib/tauri-api";

const OPEN_KEY = "nh-sidebar-open";
const WIDTH_KEY = "nh-sidebar-width";
const MIN_WIDTH = 160;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 240;

function clampWidth(w: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, w));
}

function loadOpen(): boolean {
  if (typeof window === "undefined") return true;
  // Default to open on first run so the "Open Folder" button is discoverable.
  const v = window.localStorage.getItem(OPEN_KEY);
  return v === null ? true : v === "true";
}

function loadWidth(): number {
  if (typeof window === "undefined") return DEFAULT_WIDTH;
  const v = parseInt(window.localStorage.getItem(WIDTH_KEY) ?? "", 10);
  return Number.isFinite(v) ? clampWidth(v) : DEFAULT_WIDTH;
}

/**
 * Owns the single workspace folder for this window plus the sidebar's open/width UI state.
 *
 * One folder per window: opening the first folder in a fresh window adopts it as the root
 * (existing tabs untouched); opening a *different* folder spawns/focuses another window via
 * the backend. The root is sourced on mount from this window's backend mapping (spawned
 * windows) falling back to the persisted session (cold start of the main window).
 */
export function useWorkspace() {
  const [workspaceRoot, setRoot] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(loadOpen);
  const [sidebarWidth, setWidthState] = useState<number>(loadWidth);

  // Resolve this window's workspace root on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isTauri) {
        setReady(true);
        return;
      }
      try {
        const fromWindow = await getWindowWorkspace();
        if (cancelled) return;
        if (fromWindow) {
          setRoot(await canonicalizePath(fromWindow));
          setSidebarOpen(true);
          return;
        }
        const session = await getInitialSession();
        if (cancelled) return;
        if (session.workspaceRoot) {
          setRoot(await canonicalizePath(session.workspaceRoot));
          setSidebarOpen(true);
        }
      } catch {
        /* no workspace — fine */
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Watch the workspace root recursively so any file in the tree live-reloads on external
  // edits (co-editing with Claude Code). The Rust watcher dedupes per directory.
  useEffect(() => {
    if (workspaceRoot) startWatching(workspaceRoot);
  }, [workspaceRoot]);

  // Persist sidebar UI preferences.
  useEffect(() => {
    try {
      window.localStorage.setItem(OPEN_KEY, String(sidebarOpen));
    } catch {
      /* ignore persistence failures */
    }
  }, [sidebarOpen]);
  useEffect(() => {
    try {
      window.localStorage.setItem(WIDTH_KEY, String(sidebarWidth));
    } catch {
      /* ignore persistence failures */
    }
  }, [sidebarWidth]);

  const setSidebarWidth = useCallback((w: number) => setWidthState(clampWidth(w)), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((p) => !p), []);

  /**
   * Open `path` as a workspace. Adopts it in this window if there's no root yet (and the
   * sidebar opens); otherwise opens a different folder in another window. Same folder = no-op.
   */
  const setWorkspace = useCallback(
    async (path: string) => {
      // Canonicalize so the root matches the watcher's realpath events (tree stays in sync).
      const canonical = await canonicalizePath(path);
      if (!workspaceRoot) {
        await registerWorkspaceRoot(canonical);
        setRoot(canonical);
        setSidebarOpen(true);
      } else if (canonical !== workspaceRoot) {
        await openWorkspaceWindow(canonical);
      }
    },
    [workspaceRoot],
  );

  const openFolder = useCallback(async () => {
    const path = await openFolderDialog();
    if (path) await setWorkspace(path);
  }, [setWorkspace]);

  // Folders opened via Finder / dropped on the Dock icon arrive as an "open-folder" event.
  const setWorkspaceRef = useRef(setWorkspace);
  setWorkspaceRef.current = setWorkspace;
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<string>("open-folder", (event) => {
        if (event.payload) setWorkspaceRef.current(event.payload);
      });
    })();
    return () => unlisten?.();
  }, []);

  return {
    workspaceRoot,
    ready,
    sidebarOpen,
    toggleSidebar,
    sidebarWidth,
    setSidebarWidth,
    openFolder,
    setWorkspace,
  };
}
