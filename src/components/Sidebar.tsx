import { useRef } from "react";
import { FileTree } from "./FileTree";
import { refreshAllDirs } from "../lib/tree-refresh";

interface SidebarProps {
  open: boolean;
  width: number;
  onWidthChange: (w: number) => void;
  workspaceRoot: string | null;
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
  onOpenFolder: () => void;
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

  if (!open) return null;

  const rootName = workspaceRoot
    ? workspaceRoot.split("/").filter(Boolean).pop() ?? workspaceRoot
    : null;

  return (
    <div
      className="relative flex flex-col shrink-0 overflow-hidden"
      style={{ width, background: "var(--nh-bg-elevated)", borderRight: "1px solid var(--nh-border)" }}
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
        {workspaceRoot && (
          <button
            onClick={() => refreshAllDirs()}
            className="nh-btn"
            style={{ padding: "2px 6px" }}
            title="Refresh tree"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h5M20 20v-5h-5M5 14a7 7 0 0012 3M19 10a7 7 0 00-12-3"
              />
            </svg>
          </button>
        )}
        <button
          onClick={onOpenFolder}
          className="nh-btn"
          style={{ padding: "2px 6px" }}
          title="Open folder"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v4m-2-2h4" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {workspaceRoot ? (
          <FileTree root={workspaceRoot} activeFilePath={activeFilePath} onOpenFile={onOpenFile} />
        ) : (
          <div className="px-3 py-4">
            <button onClick={onOpenFolder} className="nh-btn-primary w-full">
              Open Folder
            </button>
          </div>
        )}
      </div>

      <div
        onMouseDown={handleDown}
        className="absolute top-0 right-0 h-full"
        style={{ width: 5, cursor: "col-resize" }}
      />
    </div>
  );
}
