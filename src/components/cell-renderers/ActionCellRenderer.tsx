import type { ICellRendererParams } from "ag-grid-community";

export function ActionCellRenderer(params: ICellRendererParams) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    params.context?.onTaskSelected?.(params.data);
  };

  return (
    <button
      onClick={handleClick}
      className="w-full h-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      title="Open details"
    >
      &hellip;
    </button>
  );
}
