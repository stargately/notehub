import type { ICellRendererParams } from "ag-grid-community";

export function TitleCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;

  return (
    <span
      className="font-medium text-[13px] block truncate"
      style={{ maxWidth: "100%", color: "var(--nh-text)" }}
      title={value}
    >
      {value}
    </span>
  );
}
