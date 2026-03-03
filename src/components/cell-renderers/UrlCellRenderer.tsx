import type { ICellRendererParams } from "ag-grid-community";
import { openUrl } from "../../lib/tauri-api";

export function UrlCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;
  if (!value) return null;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openUrl(value);
  };

  return (
    <span className="flex items-center gap-1 min-w-0">
      <button
        onClick={handleOpen}
        className="text-blue-500 underline truncate text-sm cursor-pointer text-left bg-transparent border-none p-0 font-inherit"
        title={value}
      >{value}</button>
      <button
        onClick={handleOpen}
        className="flex-shrink-0 text-blue-400 hover:text-blue-600 cursor-pointer"
        title="Open URL"
      >
        ↗
      </button>
    </span>
  );
}
