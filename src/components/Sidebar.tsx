import { useRef } from "react";
import type { RefObject } from "react";
import { FileTree, type FileTreeHandle } from "./FileTree";

interface SidebarProps {
  open: boolean;
  width: number;
  onWidthChange: (w: number) => void;
  workspaceRoot: string | null;
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
  /** Imperative handle to the file tree (owned by App so the top File menu can create at root). */
  treeRef: RefObject<FileTreeHandle>;
  /** A tree file/folder was renamed — sync any open tab pointing at it. */
  onRenamed?: (oldPath: string, newPath: string) => void;
  /** A tree file/folder was deleted — close any open tab pointing at it. */
  onDeleted?: (path: string) => void;
}

/** Collapsible, resizable left panel hosting the workspace file tree. */
export function Sidebar({
  open,
  width,
  onWidthChange,
  workspaceRoot,
  activeFilePath,
  onOpenFile,
  onOpenFolder,
  treeRef,
  onRenamed,
  onDeleted,
}: SidebarProps) {
  const startX = useRef(0);
  const startW = useRef(0);

  const handleDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startW.current = width;
    const move = (ev: MouseEvent) => onWidthChange(startW.current + (ev.clientX - startX.current));
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const rootName = workspaceRoot
    ? workspaceRoot.split("/").filter(Boolean).pop() ?? workspaceRoot
    : null;

  // Collapse (Cmd+B) by shrinking to width 0 rather than unmounting: tearing a flex child out of
  // the row and rebuilding it on re-open snaps the document width and flashes the window, and throws
  // away the tree's scroll + expanded-dir state. Staying mounted keeps that state and avoids the
  // flash; the inner content is `display:none` while collapsed so it isn't painted or focusable.
  return (
    <div
      className="relative flex flex-col shrink-0 overflow-hidden"
      style={{
        width: open ? width : 0,
        background: "var(--nh-bg-elevated)",
        borderRight: open ? "1px solid var(--nh-border)" : "none",
      }}
      aria-hidden={!open}
    >
      <div
        className="flex flex-col flex-1 min-h-0"
        style={{ display: open ? undefined : "none" }}
      >
        <div
          className="flex items-center gap-2 px-3 h-9 shrink-0 border-b"
          style={{ borderColor: "var(--nh-border)" }}
        >
          <span
            className="text-[11px] font-semibold uppercase tracking-wide truncate flex-1"
            style={{ color: "var(--nh-text-secondary)" }}
            title={workspaceRoot ?? ""}
          >
            {rootName ?? "Explorer"}
          </span>
        </div>

        <div className="flex-1 overflow-auto">
          {workspaceRoot ? (
            <FileTree
              ref={treeRef}
              root={workspaceRoot}
              activeFilePath={activeFilePath}
              onOpenFile={onOpenFile}
              onRenamed={onRenamed}
              onDeleted={onDeleted}
            />
          ) : (
            <div className="px-3 py-4">
              <button onClick={onOpenFolder} className="nh-btn-primary w-full">
                Open Folder
              </button>
            </div>
          )}
        </div>
      </div>

      {open && (
        <div
          onMouseDown={handleDown}
          className="absolute top-0 right-0 h-full"
          style={{ width: 5, cursor: "col-resize" }}
        />
      )}
    </div>
  );
}
