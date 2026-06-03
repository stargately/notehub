import { useEffect } from "react";
import type { ReactNode } from "react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Render the confirm button in the destructive (red) style. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Small blocking confirmation dialog. Enter confirms, Escape cancels. Styled like `ConflictModal`.
 * Used before destructive tree actions (e.g. moving a file to the Trash).
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onConfirm, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}
      role="dialog"
      aria-modal="true"
      onMouseDown={onCancel}
    >
      <div
        className="w-[400px] max-w-[90vw] rounded-lg p-5"
        style={{
          background: "var(--nh-bg-elevated)",
          border: "1px solid var(--nh-border)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.3)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--nh-text)" }}>
          {title}
        </h2>
        <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--nh-text-secondary)" }}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button className="nh-btn" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={danger ? "nh-btn" : "nh-btn-primary"}
            style={danger ? { background: "var(--nh-accent)", color: "#fff", borderColor: "var(--nh-accent)" } : undefined}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
