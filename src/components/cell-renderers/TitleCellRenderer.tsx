import type { ICellRendererParams } from "ag-grid-community";

export function TitleCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;

  return (
    <span
      className="font-medium text-sm text-gray-900 dark:text-gray-100 block truncate"
      style={{ maxWidth: "100%" }}
      title={value}
    >
      {value}
    </span>
  );
}
