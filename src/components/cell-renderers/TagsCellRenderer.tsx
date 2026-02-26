import type { ICellRendererParams } from "ag-grid-community";

const TAG_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export function TagsCellRenderer(params: ICellRendererParams) {
  const tags = params.value as string[];
  if (!tags || tags.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getTagColor(tag)}`}
        >
          {tag}
        </span>
      ))}
    </span>
  );
}
