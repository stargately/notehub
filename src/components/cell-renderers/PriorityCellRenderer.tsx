import type { ICellRendererParams } from "ag-grid-community";

const PRIORITY_CONFIG: Record<string, { icon: string; color: string }> = {
  urgent: { icon: "\u{1F534}", color: "text-red-600 dark:text-red-400" },
  high: { icon: "\u{1F7E0}", color: "text-orange-600 dark:text-orange-400" },
  medium: { icon: "\u{1F7E1}", color: "text-yellow-600 dark:text-yellow-400" },
  low: { icon: "\u26AA", color: "text-gray-500 dark:text-gray-400" },
};

export function PriorityCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;
  if (!value) return null;

  const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.medium;

  return (
    <span className={`inline-flex items-center gap-1 text-sm ${config.color}`}>
      <span>{config.icon}</span>
      <span className="capitalize">{value}</span>
    </span>
  );
}
