import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  readDir,
  createFile,
  createDir,
  renamePath,
  deletePath,
  revealInFinder,
} from "../lib/tauri-api";
import { sortEntries } from "../lib/tree";
import { subscribeDir, parentDir, refreshAllDirs } from "../lib/tree-refresh";
import type { DirEntry } from "../lib/types";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { ConfirmModal } from "./ConfirmModal";

/** Subscribe a loaded directory so it re-reads itself when its contents change on disk. */
function useDirWatch(dir: string | null, reload: () => void) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    if (!dir) return;
    return subscribeDir(dir, () => reloadRef.current());
  }, [dir]);
}

/** Turn a raw backend error into a short, user-facing message. */
function friendlyError(raw: unknown): string {
  const s = String(raw);
  if (/exist/i.test(s)) return "A file or folder with that name already exists";
  if (/invalid/i.test(s)) return "That name isn't allowed";
  return s.replace(/^Error:\s*/i, "");
}

interface NewItemDraft {
  parentDir: string;
  isDir: boolean;
}

interface FolderCtl {
  expand: () => void;
  reload: () => void;
}

/** The operations a tree row can invoke. Stable callbacks + the volatile edit state. */
interface FileTreeOps {
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
  openMenu: (x: number, y: number, target: DirEntry | null) => void;
  beginRename: (entry: DirEntry) => void;
  beginNewItem: (parent: string, isDir: boolean) => void;
  requestDelete: (entry: DirEntry) => void;
  doReveal: (path: string) => void;
  doCopyPath: (path: string) => void;
  registerFolder: (path: string, ctl: FolderCtl) => () => void;
  submitRename: (entry: DirEntry, name: string) => Promise<boolean>;
  submitNewItem: (name: string) => Promise<boolean>;
  cancelEdit: () => void;
  renamingPath: string | null;
  draft: NewItemDraft | null;
}

const FileTreeContext = createContext<FileTreeOps | null>(null);
const useFileTreeOps = () => useContext(FileTreeContext)!;

export interface FileTreeHandle {
  newFileAtRoot: () => void;
  newFolderAtRoot: () => void;
}

interface FileTreeProps {
  root: string;
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
  /** A file/folder was renamed on disk — sync any open tab pointing at it. */
  onRenamed?: (oldPath: string, newPath: string) => void;
  /** A file/folder was deleted — close any open tab pointing at it. */
  onDeleted?: (path: string) => void;
}

/** The root of the lazy file tree. Children of each folder load on first expand. */
export const FileTree = forwardRef<FileTreeHandle, FileTreeProps>(function FileTree(
  { root, activeFilePath, onOpenFile, onRenamed, onDeleted },
  ref,
) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; target: DirEntry | null } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewItemDraft | null>(null);
  const [confirm, setConfirm] = useState<DirEntry | null>(null);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const onRenamedRef = useRef(onRenamed);
  onRenamedRef.current = onRenamed;
  const onDeletedRef = useRef(onDeleted);
  onDeletedRef.current = onDeleted;

  const folders = useRef(new Map<string, FolderCtl>());

  const reloadRoot = useCallback(() => {
    readDir(root)
      .then((e) => setEntries(sortEntries(e)))
      .catch(() => setEntries([]));
  }, [root]);

  useEffect(() => {
    setEntries(null);
    reloadRoot();
  }, [reloadRoot]);

  // Live-update the root when its contents change on disk (the watcher drives this).
  useDirWatch(root, reloadRoot);

  const registerFolder = useCallback((path: string, ctl: FolderCtl) => {
    folders.current.set(path, ctl);
    return () => {
      if (folders.current.get(path) === ctl) folders.current.delete(path);
    };
  }, []);

  const reloadFolder = useCallback(
    (dir: string) => {
      if (dir === root) {
        reloadRoot();
        return;
      }
      const ctl = folders.current.get(dir);
      if (ctl) ctl.reload();
      else refreshAllDirs();
    },
    [root, reloadRoot],
  );

  const requestExpand = useCallback(
    (path: string) => {
      if (path !== root) folders.current.get(path)?.expand();
    },
    [root],
  );

  const beginRename = useCallback((entry: DirEntry) => {
    setDraft(null);
    setRenamingPath(entry.path);
  }, []);

  const beginNewItem = useCallback(
    (parent: string, isDir: boolean) => {
      setRenamingPath(null);
      requestExpand(parent);
      setDraft({ parentDir: parent, isDir });
    },
    [requestExpand],
  );

  const cancelEdit = useCallback(() => {
    setDraft(null);
    setRenamingPath(null);
  }, []);

  const submitNewItem = useCallback(
    async (name: string): Promise<boolean> => {
      const d = draftRef.current;
      if (!d) return true;
      const trimmed = name.trim();
      if (!trimmed) {
        setDraft(null);
        return true;
      }
      const target = `${d.parentDir}/${trimmed}`;
      try {
        if (d.isDir) {
          await createDir(target);
          reloadFolder(d.parentDir);
        } else {
          const canonical = await createFile(target);
          reloadFolder(d.parentDir);
          onOpenFile(canonical);
        }
        setDraft(null);
        return true;
      } catch (e) {
        toast.error(friendlyError(e));
        return false;
      }
    },
    [reloadFolder, onOpenFile],
  );

  const submitRename = useCallback(
    async (entry: DirEntry, name: string): Promise<boolean> => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === entry.name) {
        setRenamingPath(null);
        return true;
      }
      const to = `${parentDir(entry.path)}/${trimmed}`;
      try {
        const canonical = await renamePath(entry.path, to);
        reloadFolder(parentDir(entry.path));
        onRenamedRef.current?.(entry.path, canonical);
        setRenamingPath(null);
        return true;
      } catch (e) {
        toast.error(friendlyError(e));
        return false;
      }
    },
    [reloadFolder],
  );

  const requestDelete = useCallback((entry: DirEntry) => setConfirm(entry), []);

  const performDelete = useCallback(async () => {
    const entry = confirm;
    setConfirm(null);
    if (!entry) return;
    try {
      await deletePath(entry.path);
      reloadFolder(parentDir(entry.path));
      onDeletedRef.current?.(entry.path);
    } catch (e) {
      toast.error(friendlyError(e));
    }
  }, [confirm, reloadFolder]);

  const doReveal = useCallback((path: string) => {
    revealInFinder(path).catch(() => {});
  }, []);
  const doCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
  }, []);
  const openMenu = useCallback(
    (x: number, y: number, target: DirEntry | null) => setMenu({ x, y, target }),
    [],
  );

  const ops = useMemo<FileTreeOps>(
    () => ({
      activeFilePath,
      onOpenFile,
      openMenu,
      beginRename,
      beginNewItem,
      requestDelete,
      doReveal,
      doCopyPath,
      registerFolder,
      submitRename,
      submitNewItem,
      cancelEdit,
      renamingPath,
      draft,
    }),
    [
      activeFilePath,
      onOpenFile,
      openMenu,
      beginRename,
      beginNewItem,
      requestDelete,
      doReveal,
      doCopyPath,
      registerFolder,
      submitRename,
      submitNewItem,
      cancelEdit,
      renamingPath,
      draft,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      newFileAtRoot: () => beginNewItem(root, false),
      newFolderAtRoot: () => beginNewItem(root, true),
    }),
    [beginNewItem, root],
  );

  const menuItems = useMemo<MenuItem[]>(() => {
    if (!menu) return [];
    const t = menu.target;
    if (t && t.is_dir) {
      return [
        { label: "New File", onClick: () => beginNewItem(t.path, false) },
        { label: "New Folder", onClick: () => beginNewItem(t.path, true) },
        { label: "Rename", separatorBefore: true, onClick: () => beginRename(t) },
        { label: "Delete", danger: true, onClick: () => requestDelete(t) },
        { label: "Reveal in Finder", separatorBefore: true, onClick: () => doReveal(t.path) },
        { label: "Copy Path", onClick: () => doCopyPath(t.path) },
      ];
    }
    if (t) {
      return [
        { label: "Rename", onClick: () => beginRename(t) },
        { label: "Delete", danger: true, onClick: () => requestDelete(t) },
        { label: "Reveal in Finder", separatorBefore: true, onClick: () => doReveal(t.path) },
        { label: "Copy Path", onClick: () => doCopyPath(t.path) },
      ];
    }
    return [
      { label: "New File", onClick: () => beginNewItem(root, false) },
      { label: "New Folder", onClick: () => beginNewItem(root, true) },
    ];
  }, [menu, root, beginNewItem, beginRename, requestDelete, doReveal, doCopyPath]);

  if (entries === null) {
    return (
      <div className="px-3 py-2 text-xs" style={{ color: "var(--nh-text-tertiary)" }}>
        Loading…
      </div>
    );
  }

  return (
    <FileTreeContext.Provider value={ops}>
      <div
        role="tree"
        className="py-1 min-h-full"
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu(e.clientX, e.clientY, null);
        }}
      >
        {draft?.parentDir === root && (
          <InlineInput
            depth={0}
            isDir={draft.isDir}
            initial={draft.isDir ? "" : "untitled.md"}
            onSubmit={submitNewItem}
            onCancel={cancelEdit}
          />
        )}
        {entries.map((entry) => (
          <TreeNode key={entry.path} entry={entry} depth={0} />
        ))}
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      <ConfirmModal
        open={!!confirm}
        title="Move to Trash"
        message={
          confirm ? (
            <>
              Move <span style={{ color: "var(--nh-text)" }}>{confirm.name}</span> to the Trash? You
              can restore it from there.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Move to Trash"
        danger
        onConfirm={performDelete}
        onCancel={() => setConfirm(null)}
      />
    </FileTreeContext.Provider>
  );
});

interface TreeNodeProps {
  entry: DirEntry;
  depth: number;
}

function TreeNode({ entry, depth }: TreeNodeProps) {
  const ops = useFileTreeOps();
  const { registerFolder } = ops;
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);

  const loadChildren = useCallback(() => {
    readDir(entry.path)
      .then((c) => setChildren(sortEntries(c)))
      .catch(() => {
        /* dir may have been removed — leave stale children to unmount with the parent */
      });
  }, [entry.path]);

  // Load children when first expanded; keep them in sync with disk while expanded.
  useEffect(() => {
    if (entry.is_dir && expanded && children === null) loadChildren();
  }, [entry.is_dir, expanded, children, loadChildren]);
  useDirWatch(entry.is_dir && expanded ? entry.path : null, loadChildren);

  // Register this folder so a create/refresh can expand and reload it imperatively.
  useEffect(() => {
    if (!entry.is_dir) return;
    return registerFolder(entry.path, { expand: () => setExpanded(true), reload: loadChildren });
  }, [entry.is_dir, entry.path, registerFolder, loadChildren]);

  const handleClick = () => {
    if (ops.renamingPath === entry.path) return;
    if (!entry.is_dir) {
      ops.onOpenFile(entry.path);
      return;
    }
    setExpanded((v) => !v);
  };

  const isActive = !entry.is_dir && entry.path === ops.activeFilePath;
  const isRenaming = ops.renamingPath === entry.path;

  return (
    <>
      <div
        role="treeitem"
        aria-expanded={entry.is_dir ? expanded : undefined}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          ops.openMenu(e.clientX, e.clientY, entry);
        }}
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
        {isRenaming ? (
          <InlineInput
            depth={0}
            inline
            isDir={entry.is_dir}
            initial={entry.name}
            onSubmit={(name) => ops.submitRename(entry, name)}
            onCancel={ops.cancelEdit}
          />
        ) : (
          <span className="truncate">{entry.name}</span>
        )}
      </div>
      {entry.is_dir && expanded && (
        <>
          {ops.draft?.parentDir === entry.path && (
            <InlineInput
              depth={depth + 1}
              isDir={ops.draft.isDir}
              initial={ops.draft.isDir ? "" : "untitled.md"}
              onSubmit={ops.submitNewItem}
              onCancel={ops.cancelEdit}
            />
          )}
          {children?.map((child) => (
            <TreeNode key={child.path} entry={child} depth={depth + 1} />
          ))}
        </>
      )}
    </>
  );
}

interface InlineInputProps {
  depth: number;
  isDir: boolean;
  initial: string;
  onSubmit: (name: string) => Promise<boolean>;
  onCancel: () => void;
  /** When true the input sits inside an existing row (rename) and skips the row chrome. */
  inline?: boolean;
}

/** A temporary text input for naming a new file/folder or renaming an existing one. */
function InlineInput({ depth, isDir, initial, onSubmit, onCancel, inline }: InlineInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initial);
  const committing = useRef(false);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    // Select the basename, leaving the extension untouched (Zed/Finder behavior).
    const dot = initial.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async (commit: boolean) => {
    if (committing.current) return;
    if (!commit) {
      onCancel();
      return;
    }
    committing.current = true;
    const ok = await onSubmit(value);
    // On failure keep the input open so the user can fix the name and retry.
    committing.current = ok ? committing.current : false;
  };

  const input = (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        }
      }}
      onBlur={() => finish(false)}
      spellCheck={false}
      className="flex-1 min-w-0 bg-transparent outline-none text-[13px] px-1"
      style={{ color: "var(--nh-text)", border: "1px solid var(--nh-accent)", borderRadius: 3 }}
    />
  );

  if (inline) return input;

  return (
    <div
      className="flex items-center gap-1 pr-2 py-[3px] text-[13px]"
      style={{ paddingLeft: depth * 12 + 6 }}
    >
      <span className="w-3.5 h-3.5 shrink-0" />
      <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
        {isDir ? <FolderIcon /> : <FileIcon />}
      </span>
      {input}
    </div>
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
