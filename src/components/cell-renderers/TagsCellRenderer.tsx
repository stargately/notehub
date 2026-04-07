import type { ICellRendererParams } from "ag-grid-community";

const TAG_PALETTES = [
  { bg: "rgba(59,130,246,0.1)", text: "#2563eb" },
  { bg: "rgba(34,197,94,0.1)", text: "#16a34a" },
  { bg: "rgba(168,85,247,0.1)", text: "#9333ea" },
  { bg: "rgba(236,72,153,0.1)", text: "#db2777" },
  { bg: "rgba(99,102,241,0.1)", text: "#4f46e5" },
  { bg: "rgba(20,184,166,0.1)", text: "#0d9488" },
];

function getTagPalette(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_PALETTES[Math.abs(hash) % TAG_PALETTES.length];
}

export function TagsCellRenderer(params: ICellRendererParams) {
  const tags = params.value as string[];
  if (!tags || tags.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {tags.map((tag) => {
        const palette = getTagPalette(tag);
        return (
          <span
            key={tag}
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ background: palette.bg, color: palette.text }}
          >
            {tag}
          </span>
        );
      })}
    </span>
  );
}
