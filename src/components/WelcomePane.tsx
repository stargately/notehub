import { useMemo } from "react";
import { formatSequence } from "../lib/keymap/keystroke";

const IS_MAC = typeof navigator !== "undefined" && navigator.platform.includes("Mac");

interface WelcomePaneProps {
  /** Whether a workspace folder is open — gates the workspace-only actions (New File / Quick Open). */
  hasWorkspace: boolean;
  onNewFile: () => void;
  onOpenFile: () => void;
  onQuickOpen: () => void;
  onOpenFolder: () => void;
}

interface HintRow {
  label: string;
  /** A live-keymap keystroke (e.g. `"mod-o"`); rendered to `⌘O` / `Ctrl+O`. Omit for menu-only actions. */
  keystroke?: string;
  onClick: () => void;
}

/**
 * Zed-style empty pane shown when no tabs are open: a clean, minimal list of the key file/workspace
 * actions with their shortcuts, on the blank editor background — not a marketing card. Rows are
 * clickable; the shortcut chips mirror the live keymap via `formatSequence`, so a user remap shows
 * here too. Workspace-only actions (New File / Quick Open) appear only with a folder open.
 */
export function WelcomePane({ hasWorkspace, onNewFile, onOpenFile, onQuickOpen, onOpenFolder }: WelcomePaneProps) {
  const rows = useMemo<HintRow[]>(() => {
    const r: HintRow[] = [];
    if (hasWorkspace) r.push({ label: "New File", onClick: onNewFile });
    r.push({ label: "Open File", keystroke: "mod-o", onClick: onOpenFile });
    if (hasWorkspace) r.push({ label: "Quick Open", keystroke: "mod-p", onClick: onQuickOpen });
    r.push({ label: hasWorkspace ? "Open Another Folder…" : "Open Folder…", onClick: onOpenFolder });
    return r;
  }, [hasWorkspace, onNewFile, onOpenFile, onQuickOpen, onOpenFolder]);

  return (
    <div
      className="flex-1 flex items-center justify-center nh-fade-in select-none"
      style={{ background: "var(--nh-bg)" }}
    >
      <div className="w-full max-w-[18rem] px-4">
        <div
          className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-wider"
          style={{ color: "var(--nh-text-tertiary)" }}
        >
          NoteHub
        </div>
        <div className="flex flex-col">
          {rows.map((row) => (
            <button key={row.label} onClick={row.onClick} className="nh-welcome-row">
              <span>{row.label}</span>
              {row.keystroke && <kbd className="nh-kbd">{formatSequence(row.keystroke, IS_MAC)}</kbd>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
