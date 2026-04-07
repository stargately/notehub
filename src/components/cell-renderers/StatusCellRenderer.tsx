import type { ICellRendererParams } from "ag-grid-community";

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  todo: { bg: "rgba(156,163,175,0.1)", text: "#6b7280", dot: "#9ca3af" },
  in_progress: { bg: "rgba(59,130,246,0.1)", text: "#2563eb", dot: "#3b82f6" },
  in_review: { bg: "rgba(245,158,11,0.1)", text: "#d97706", dot: "#f59e0b" },
  done: { bg: "rgba(34,197,94,0.1)", text: "#16a34a", dot: "#22c55e" },
  blocked: { bg: "rgba(239,68,68,0.1)", text: "#dc2626", dot: "#ef4444" },
};

export function StatusCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;
  if (!value) return null;

  const style = STATUS_STYLES[value] || STATUS_STYLES.todo;
  const label = value.replace(/_/g, " ");

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium"
      style={{ background: style.bg, color: style.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: style.dot }}
      />
      {label}
    </span>
  );
}
