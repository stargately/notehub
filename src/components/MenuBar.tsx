import { useRef, useState } from "react";
import { ContextMenu, type MenuItem } from "./ContextMenu";

interface MenuBarProps {
  workspaceRoot: string | null;
  /** Whether a file is open to save (gates the Save item). */
  canSave: boolean;
  onNewFile: () => void;
  onNewFolder: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onQuickOpen: () => void;
  onSave: () => void;
  onRefresh: () => void;
}

/**
 * A thin top menu bar with a Zed-style **File** dropdown. The dropdown reuses the shared
 * `ContextMenu` (anchored under the File button), so it inherits outside-click / Esc / scroll
 * close behavior. File actions are passed in from `App`; this component is presentational.
 */
export function MenuBar({
  workspaceRoot,
  canSave,
  onNewFile,
  onNewFolder,
  onOpenFile,
  onOpenFolder,
  onQuickOpen,
  onSave,
  onRefresh,
}: MenuBarProps) {
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const fileBtnRef = useRef<HTMLButtonElement>(null);
  const open = menuPos !== null;

  // Toggle the dropdown. stopPropagation so the open menu's document-click-close doesn't also
  // fire and fight the toggle (clicking File while open should just close it).
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) {
      setMenuPos(null);
      return;
    }
    const r = fileBtnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ x: r.left, y: r.bottom + 2 });
  };

  const hasWorkspace = !!workspaceRoot;
  const items: MenuItem[] = [
    { label: "New File", onClick: onNewFile, disabled: !hasWorkspace },
    { label: "New Folder", onClick: onNewFolder, disabled: !hasWorkspace },
    { label: "Open File…", shortcut: "⌘O", separatorBefore: true, onClick: onOpenFile },
    { label: "Open Folder…", onClick: onOpenFolder },
    { label: "Quick Open…", shortcut: "⌘P", separatorBefore: true, onClick: onQuickOpen },
    { label: "Save", shortcut: "⌘S", separatorBefore: true, onClick: onSave, disabled: !canSave },
    { label: "Refresh File Tree", separatorBefore: true, onClick: onRefresh, disabled: !hasWorkspace },
  ];

  return (
    <div
      className="flex items-center h-8 shrink-0 px-1"
      style={{ background: "var(--nh-bg-elevated)", borderBottom: "1px solid var(--nh-border)" }}
    >
      <button
        ref={fileBtnRef}
        onClick={toggle}
        className="flex items-center gap-1 px-2.5 py-1 text-[13px] rounded transition-colors"
        style={{ color: "var(--nh-text-secondary)", background: open ? "var(--nh-bg-sunken)" : "transparent" }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = "var(--nh-bg-sunken)";
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = "transparent";
        }}
      >
        File
        <span className="text-[9px]" style={{ color: "var(--nh-text-tertiary)" }}>
          ▾
        </span>
      </button>
      {menuPos && (
        <ContextMenu x={menuPos.x} y={menuPos.y} items={items} onClose={() => setMenuPos(null)} />
      )}
    </div>
  );
}
