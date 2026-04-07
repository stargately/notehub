import type { ICellRendererParams } from "ag-grid-community";

const AVATAR_COLORS = [
  "#3b82f6", "#22c55e", "#a855f7",
  "#ec4899", "#6366f1", "#14b8a6",
];

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function AssigneeCellRenderer(params: ICellRendererParams) {
  const value = params.value as string;
  if (!value) {
    return (
      <span className="text-[11px]" style={{ color: "var(--nh-text-tertiary)" }}>
        —
      </span>
    );
  }

  const initials = getInitials(value);
  const color = getColor(value);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-[9px] font-semibold shrink-0"
        style={{ background: color }}
      >
        {initials}
      </span>
      <span className="text-[12px]" style={{ color: "var(--nh-text)" }}>{value}</span>
    </span>
  );
}
