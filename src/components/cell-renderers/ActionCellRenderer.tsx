import type { ICellRendererParams } from "ag-grid-community";

export function ActionCellRenderer(params: ICellRendererParams) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    params.context?.onTaskSelected?.(params.data);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full h-full flex items-center justify-center transition-colors"
      style={{ color: "var(--nh-text-tertiary)" }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--nh-accent)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--nh-text-tertiary)"; }}
      title="Open details"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
