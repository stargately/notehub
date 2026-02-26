import type { ICellRendererParams } from "ag-grid-community";

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  in_review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200",
  done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
  blocked: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

export function StatusCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;
  if (!value) return null;

  const colorClass = STATUS_COLORS[value] || STATUS_COLORS.todo;
  const label = value.replace(/_/g, " ");

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}
