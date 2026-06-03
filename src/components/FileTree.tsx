import { useCallback, useEffect, useRef, useState } from "react";
import { readDir } from "../lib/tauri-api";
import { sortEntries } from "../lib/tree";
import { subscribeDir } from "../lib/tree-refresh";
import type { DirEntry } from "../lib/types";

/** Subscribe a loaded directory so it re-reads itself when its contents change on disk. */
function useDirWatch(dir: string | null, reload: () => void) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    if (!dir) return;
    return subscribeDir(dir, () => reloadRef.current());
  }, [dir]);
}

interface FileTreeProps {
  root: string;
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
}

/** The root of the lazy file tree. Children of each folder load on first expand. */
export function FileTree({ root, activeFilePath, onOpenFile }: FileTreeProps) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);

  const reload = useCallback(() => {
    readDir(root)
      .then((e) => setEntries(sortEntries(e)))
      .catch(() => setEntries([]));
  }, [root]);

  useEffect(() => {
    setEntries(null);
    reload();
  }, [reload]);

  // Live-update the root when its contents change on disk (the watcher drives this).
  useDirWatch(root, reload);

  if (entries === null) {
    return (
      <div className="px-3 py-2 text-xs" style={{ color: "var(--nh-text-tertiary)" }}>
        Loading…
      </div>
    );
  }

  return (
    <div role="tree" className="py-1">
      {entries.map((entry) => (
        <TreeNode
          key={entry.path}
          entry={entry}
          depth={0}
          activeFilePath={activeFilePath}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  entry: DirEntry;
  depth: number;
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
}

function TreeNode({ entry, depth, activeFilePath, onOpenFile }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);

  const handleClick = async () => {
    if (!entry.is_dir) {
      onOpenFile(entry.path);
      return;
    }
    const next = !expanded;
    setExpanded(next);
    if (next && children === null) {
      try {
        setChildren(sortEntries(await readDir(entry.path)));
      } catch {
        setChildren([]);
      }
    }
  };

  // Keep an expanded folder's children in sync with the filesystem.
  const reloadChildren = useCallback(() => {
    readDir(entry.path)
      .then((c) => setChildren(sortEntries(c)))
      .catch(() => {
        /* dir may have been removed — leave stale children to unmount with the parent */
      });
  }, [entry.path]);
  useDirWatch(entry.is_dir && expanded ? entry.path : null, reloadChildren);

  const isActive = !entry.is_dir && entry.path === activeFilePath;

  return (
    <>
      <div
        role="treeitem"
        aria-expanded={entry.is_dir ? expanded : undefined}
        onClick={handleClick}
        className="nh-tree-row flex items-center gap-1 pr-2 py-[3px] cursor-pointer text-[13px] select-none"
        style={{
          paddingLeft: depth * 12 + 6,
          background: isActive ? "var(--nh-accent-subtle)" : undefined,
          color: isActive ? "var(--nh-accent)" : "var(--nh-text-secondary)",
        }}
        title={entry.name}
      >
        <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
          {entry.is_dir ? <Chevron expanded={expanded} /> : null}
        </span>
        <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
          {entry.is_dir ? <FolderIcon /> : <FileIcon />}
        </span>
        <span className="truncate">{entry.name}</span>
      </div>
      {entry.is_dir &&
        expanded &&
        children?.map((child) => (
          <TreeNode
            key={child.path}
            entry={child}
            depth={depth + 1}
            activeFilePath={activeFilePath}
            onOpenFile={onOpenFile}
          />
        ))}
    </>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 0.1s" }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 3h7l5 5v13a0 0 0 01 0 0H7a2 2 0 01-2-2V5a2 2 0 012-2z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
    </svg>
  );
}
