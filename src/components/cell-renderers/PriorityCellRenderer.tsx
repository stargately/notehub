import type { ICellRendererParams } from "ag-grid-community";

const PRIORITY_CONFIG: Record<string, { color: string; bars: number }> = {
  urgent: { color: "#dc2626", bars: 4 },
  high: { color: "#f97316", bars: 3 },
  medium: { color: "#eab308", bars: 2 },
  low: { color: "#9ca3af", bars: 1 },
};

function PriorityBars({ bars, color }: { bars: number; color: string }) {
  return (
    <span className="inline-flex items-end gap-px h-3">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-sm"
          style={{
            height: `${4 + i * 2}px`,
            background: i <= bars ? color : "var(--nh-border)",
          }}
        />
      ))}
    </span>
  );
}

export function PriorityCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;
  if (!value) return null;

  const config = PRIORITY_CONFIG[value] || PRIORITY_CONFIG.medium;

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: config.color }}>
      <PriorityBars bars={config.bars} color={config.color} />
      <span className="capitalize">{value}</span>
    </span>
  );
}
