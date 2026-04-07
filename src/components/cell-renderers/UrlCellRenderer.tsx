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
        className="truncate text-[12px] cursor-pointer text-left bg-transparent border-none p-0 font-inherit underline-offset-2 hover:underline"
        style={{ color: "var(--nh-accent)" }}
        title={value}
      >{value}</button>
      <button
        onClick={handleOpen}
        className="flex-shrink-0 cursor-pointer transition-colors"
        style={{ color: "var(--nh-text-tertiary)" }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "var(--nh-accent)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--nh-text-tertiary)"; }}
        title="Open URL"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </button>
    </span>
  );
}
