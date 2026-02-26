import type { ICellRendererParams } from "ag-grid-community";

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-teal-500",
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
  if (!value) return <span className="text-gray-400 text-sm">Unassigned</span>;

  const initials = getInitials(value);
  const color = getColor(value);

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-medium ${color}`}
      >
        {initials}
      </span>
      <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>
    </span>
  );
}
