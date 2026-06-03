import type { FileConflict } from "../hooks/useFileSync";

interface ConflictModalProps {
  conflict: FileConflict | null;
  /** Discard local edits and load the version on disk. */
  onKeepDisk: () => void;
  /** Overwrite the file on disk with our in-memory version. */
  onKeepMine: () => void;
}

/**
 * Blocking modal shown when a file changed on disk while NoteHub had unsaved edits.
 * Mirrors IntelliJ's "File Cache Conflict": the user must explicitly choose which
 * version to keep — NoteHub never silently discards either side.
 */
export function ConflictModal({ conflict, onKeepDisk, onKeepMine }: ConflictModalProps) {
  if (!conflict) return null;

  const fileName = conflict.path.split("/").pop() ?? conflict.path;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-[400px] max-w-[90vw] rounded-lg p-5"
        style={{
          background: "var(--nh-bg-elevated)",
          border: "1px solid var(--nh-border)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
        }}
      >
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--nh-text)" }}>
          File changed on disk
        </h2>
        <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--nh-text-secondary)" }}>
          <span style={{ color: "var(--nh-text)" }}>{fileName}</span> was modified by
          another program while you had unsaved edits. Which version do you want to keep?
        </p>
        <div className="flex justify-end gap-2">
          <button className="nh-btn" onClick={onKeepDisk}>
            Keep disk
          </button>
          <button className="nh-btn-primary" onClick={onKeepMine}>
            Keep mine
          </button>
        </div>
      </div>
    </div>
  );
}
