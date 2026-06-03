import { isTauri } from "./tauri-api";
import type { FileChangedPayload } from "./types";

/**
 * A tiny pub/sub that keeps the file tree in sync with the filesystem. The Rust watcher emits
 * a single global `file-changed` event per change; each loaded directory in the tree subscribes
 * by its own path and re-reads itself when a change lands inside it. One Tauri listener is
 * shared for the whole app (started lazily on first subscribe).
 */
type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
let started = false;

/** The directory portion of a path (no trailing slash). Exposed for testing. */
export function parentDir(path: string): string {
  const i = path.lastIndexOf("/");
  return i > 0 ? path.slice(0, i) : path;
}

/**
 * Whether `path` lives inside `root`'s subtree. Used to decide if an opened file already has
 * watcher coverage from the recursive workspace-root watcher (so we don't start a redundant
 * per-directory watcher). The trailing `/` prevents `/a/b` from matching a sibling `/a/bc`.
 */
export function isUnderRoot(path: string, root: string | null): boolean {
  return !!root && path.startsWith(root.endsWith("/") ? root : root + "/");
}

async function ensureStarted() {
  if (started || !isTauri) return;
  started = true;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<FileChangedPayload>("file-changed", (event) => {
    const dir = parentDir(event.payload.path);
    listeners.get(dir)?.forEach((cb) => cb());
  });
}

/** Subscribe a directory to refresh when its contents change. Returns an unsubscribe fn. */
export function subscribeDir(dir: string, cb: Listener): () => void {
  void ensureStarted();
  let set = listeners.get(dir);
  if (!set) {
    set = new Set();
    listeners.set(dir, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) listeners.delete(dir);
  };
}

/** Refresh every currently-loaded directory (manual refresh button / window refocus). */
export function refreshAllDirs() {
  listeners.forEach((set) => set.forEach((cb) => cb()));
}
