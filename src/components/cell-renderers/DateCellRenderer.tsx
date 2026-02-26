import type { ICellRendererParams } from "ag-grid-community";

export function DateCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;
  if (!value) return null;

  return <span className="text-sm text-gray-400 dark:text-gray-500 font-mono">{value}</span>;
}
