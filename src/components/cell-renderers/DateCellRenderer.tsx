import type { ICellRendererParams } from "ag-grid-community";

export function DateCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;
  if (!value) return null;

  return (
    <span
      className="text-[11px] font-mono"
      style={{ color: "var(--nh-text-secondary)" }}
    >
      {value}
    </span>
  );
}
