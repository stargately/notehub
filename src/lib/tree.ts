import type { DirEntry } from "./types";

/**
 * Order a directory listing the way a file explorer renders it: folders first, then
 * case-insensitive alphabetical within each group. Mirrors the Rust `sort_dir_entries`
 * helper so client-side re-sorts stay consistent. Pure — returns a new array.
 */
export function sortEntries(entries: DirEntry[]): DirEntry[] {
  return [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}
