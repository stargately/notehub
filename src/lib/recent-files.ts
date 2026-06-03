/**
 * A tiny in-memory most-recently-opened list, used to order the Cmd+P finder when the query is
 * empty. The macOS recent-documents list (`note_recent_document`) is write-only, so we track our
 * own MRU here, updated from `useTabManagement.openPath` whenever any path is opened (dialog,
 * sidebar, drag-drop, OS association, or the finder itself).
 */

const MAX_RECENTS = 100;

let recents: string[] = [];

/** Move `path` to the front of the MRU (dedup, bounded). No-op for empty/browser paths. */
export function noteOpened(path: string): void {
  if (!path || path.startsWith("browser://")) return;
  recents = [path, ...recents.filter((p) => p !== path)].slice(0, MAX_RECENTS);
}

/** Snapshot of the MRU paths, most-recent first. */
export function recentPaths(): string[] {
  return recents.slice();
}

/** Reset the MRU (used by tests). */
export function clearRecents(): void {
  recents = [];
}
