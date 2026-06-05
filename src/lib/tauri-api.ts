import type { DirEntry, FileEntry } from "./types";

export const isTauri = !!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

// Lazy-load invoke to avoid top-level await
let _invoke: (<T>(cmd: string, args?: Record<string, unknown>) => Promise<T>) | null = null;

async function getInvoke() {
  if (_invoke) return _invoke;
  if (isTauri) {
    const mod = await import("@tauri-apps/api/core");
    _invoke = mod.invoke;
  } else {
    _invoke = async () => {
      throw new Error("Not in Tauri");
    };
  }
  return _invoke;
}

// In-memory store for browser mode
let browserFileContent: string | null = null;

export function getDefaultProjectContent(): string {
  const today = new Date().toISOString().split("T")[0];
  return `---
project: "Untitled Project"
created: "${today}"
layout: todo
views:
  default:
    group_by: status
    sort_by: priority
    sort_order: desc
columns:
  - field: id
    width: 60
  - field: title
    width: 400
  - field: status
    width: 120
  - field: priority
    width: 100
  - field: assignee
    width: 120
  - field: due
    width: 120
  - field: tags
    width: 200
status_options: [todo, in_progress, in_review, done, blocked]
priority_options: [urgent, high, medium, low]
assignee_options: []
---

## Tasks

| Id | Title | Status | Priority | Assignee | Due | Tags |
| --- | --- | --- | --- | --- | --- | --- |

## Task Details

## Notes
`;
}

export async function saveFileDialog(): Promise<string | null> {
  if (!isTauri) return null;
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const selected = await save({
      filters: [{ name: "Markdown", extensions: ["md"] }],
      defaultPath: "untitled-todo.md",
    });
    return selected || null;
  } catch {
    return null;
  }
}

export async function openFileDialog(): Promise<string | null> {
  if (!isTauri) return null;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    return (selected as string) || null;
  } catch {
    return null;
  }
}

/** Open a directory picker; returns the chosen folder path or null if cancelled. */
export async function openFolderDialog(): Promise<string | null> {
  if (!isTauri) return null;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false });
    return (selected as string) || null;
  } catch {
    return null;
  }
}

export interface InitialSession {
  paths: string[];
  activeIndex: number;
  workspaceRoot?: string | null;
}

export async function getInitialSession(): Promise<InitialSession> {
  if (!isTauri)
    return { paths: ["browser://sample-project.md"], activeIndex: 0, workspaceRoot: null };
  const invoke = await getInvoke();
  return invoke<InitialSession>("get_project_file_paths");
}

export async function saveSession(
  paths: string[],
  activeIndex: number,
  workspaceRoot: string | null = null,
): Promise<void> {
  if (!isTauri) return;
  const invoke = await getInvoke();
  await invoke<void>("save_session", { paths, activeIndex, workspaceRoot });
}

// Workspace / file-tree bridges

/** List one level of a directory (folders first, alphabetical; noise dirs hidden by Rust). */
export async function readDir(path: string): Promise<DirEntry[]> {
  if (!isTauri) return [];
  const invoke = await getInvoke();
  return invoke<DirEntry[]>("read_dir", { path });
}

/** Recursively index every file under `root` for the quick-open finder (gitignore-aware in Rust). */
export async function listWorkspaceFiles(root: string): Promise<FileEntry[]> {
  if (!isTauri) return [];
  const invoke = await getInvoke();
  return invoke<FileEntry[]>("list_workspace_files", { root });
}

/** Create an empty file (errors if it exists); returns the canonical path. */
export async function createFile(path: string): Promise<string> {
  if (!isTauri) return path;
  const invoke = await getInvoke();
  return invoke<string>("create_file", { path });
}

/** Create a directory (errors if it exists); returns the canonical path. */
export async function createDir(path: string): Promise<string> {
  if (!isTauri) return path;
  const invoke = await getInvoke();
  return invoke<string>("create_dir", { path });
}

/** Rename/move a file or folder (errors if the target exists); returns the canonical new path. */
export async function renamePath(from: string, to: string): Promise<string> {
  if (!isTauri) return to;
  const invoke = await getInvoke();
  return invoke<string>("rename_path", { from, to });
}

/** Move a file or folder to the OS Trash (recoverable). */
export async function deletePath(path: string): Promise<void> {
  if (!isTauri) return;
  const invoke = await getInvoke();
  await invoke<void>("delete_path", { path });
}

/** Reveal a path in the OS file manager (Finder/Explorer), selecting the item. */
export async function revealInFinder(path: string): Promise<void> {
  if (!isTauri) return;
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

/** Read any file as text; rejects with "binary" for non-text files (images, blobs, …). */
export async function readTextFile(path: string): Promise<string> {
  const invoke = await getInvoke();
  return invoke<string>("read_text_file", { path });
}

/** Whether a path is a directory — routes a dropped path to the tree (folder) vs a tab (file). */
export async function isDirectory(path: string): Promise<boolean> {
  if (!isTauri) return false;
  const invoke = await getInvoke();
  return invoke<boolean>("is_directory", { path });
}

/** Start a recursive file watcher on a directory (emits "file-changed" for edits within it). */
export async function startWatching(path: string): Promise<void> {
  if (!isTauri) return;
  const invoke = await getInvoke();
  await invoke<void>("start_watching", { path });
}

/** Resolve a path to its canonical (realpath) form so it matches the watcher's event paths. */
export async function canonicalizePath(path: string): Promise<string> {
  if (!isTauri) return path;
  try {
    const invoke = await getInvoke();
    return await invoke<string>("canonicalize", { path });
  } catch {
    return path;
  }
}

/** Open `folder` as a workspace in a new window (or focus the window that already owns it). */
export async function openWorkspaceWindow(folder: string): Promise<void> {
  if (!isTauri) return;
  const invoke = await getInvoke();
  await invoke<void>("open_workspace_window", { folder });
}

/** Tear a tab off into a brand-new window at the release point; returns the new window label. */
export async function detachTab(path: string, screenX: number, screenY: number): Promise<string> {
  const invoke = await getInvoke();
  return invoke<string>("detach_tab", { path, screenX, screenY });
}

/** Files this (torn-off) window should open on mount — drained server-side; `[]` for normal windows. */
export async function getWindowFiles(): Promise<string[]> {
  if (!isTauri) return [];
  const invoke = await getInvoke();
  return invoke<string[]>("get_window_files");
}

/** This window's outer bounds in logical (CSS) pixels — to test whether a drop landed outside it. */
export async function getWindowRect(): Promise<{ x: number; y: number; width: number; height: number }> {
  const invoke = await getInvoke();
  return invoke<{ x: number; y: number; width: number; height: number }>("get_window_rect");
}

/** Record this window's adopted workspace root (or clear it with null) in the backend map. */
export async function setWorkspaceRoot(path: string | null): Promise<void> {
  if (!isTauri) return;
  const invoke = await getInvoke();
  await invoke<void>("set_workspace_root", { path });
}

/** Fetch the workspace root this window was opened for (null if it has none yet). */
export async function getWindowWorkspace(): Promise<string | null> {
  if (!isTauri) return null;
  const invoke = await getInvoke();
  return invoke<string | null>("get_window_workspace");
}

/** Convert a filesystem path into a URL the webview can load (e.g. for <img src>). */
export async function toAssetUrl(path: string): Promise<string> {
  if (!isTauri) return path;
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return convertFileSrc(path);
}

/** Label of the current window ("main" for the primary window, "workspace-N" for spawned ones). */
export async function getWindowLabel(): Promise<string> {
  if (!isTauri) return "main";
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
}

export async function noteRecentDocument(path: string): Promise<void> {
  if (!isTauri || !path || path.startsWith("browser://")) return;
  const invoke = await getInvoke();
  await invoke<void>("note_recent_document", { path });
}

export async function readFile(path: string): Promise<string> {
  if (!isTauri) {
    // Only serve sample-project.md for the main project file
    if (path === "browser://sample-project.md") {
      if (browserFileContent !== null) return browserFileContent;
      const resp = await fetch("/sample-project.md");
      browserFileContent = await resp.text();
      return browserFileContent;
    }
    // For any other path (e.g. task detail files), throw to trigger creation
    throw new Error("File not found in browser mode");
  }
  const invoke = await getInvoke();
  return invoke<string>("read_file", { path });
}

export async function openUrl(url: string): Promise<void> {
  if (isTauri) {
    try {
      const { openUrl: tauriOpenUrl } = await import("@tauri-apps/plugin-opener");
      await tauriOpenUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  } else {
    window.open(url, "_blank");
  }
}

/** Write an HTML doc to a temp file and open it in the default browser (for printing). */
export async function printHtml(html: string, name?: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("print_html", { html, name: name ?? null });
}

export async function writeFile(path: string, content: string): Promise<void> {
  if (!isTauri) {
    browserFileContent = content;
    return;
  }
  const invoke = await getInvoke();
  // Echo from our own write is suppressed by content comparison against the per-path
  // baseline in useFileSync — no time-based lock needed (it would swallow concurrent
  // external writes that happen to land within the window).
  await invoke<void>("write_file", { path, content });
}

// Terminal API

export async function spawnTerminal(cwd?: string): Promise<number> {
  const invoke = await getInvoke();
  return invoke<number>("spawn_terminal", { cwd: cwd ?? null });
}

export async function writeTerminal(sessionId: number, data: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("write_terminal", { sessionId, data });
}

export async function resizeTerminal(sessionId: number, cols: number, rows: number): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("resize_terminal", { sessionId, cols: cols, rows: rows });
}

export async function killTerminal(sessionId: number): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("kill_terminal", { sessionId });
}

