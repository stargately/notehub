import { memo } from "react";
import type { OutlineHeading } from "../lib/outline";

interface OutlinePanelProps {
  headings: OutlineHeading[];
  /** Jump to `headings[index]` in the active view (scroll-to + focus). */
  onJump: (index: number) => void;
  onClose: () => void;
}

/**
 * Typora-style outline of the active document's headings, docked to the right of the editor.
 * Nesting is shown by indentation relative to the shallowest heading in the doc. Pure display —
 * `DocumentView` owns the parsed outline and the per-view scroll-to logic.
 */
export const OutlinePanel = memo(function OutlinePanel({ headings, onJump, onClose }: OutlinePanelProps) {
  const minLevel = headings.reduce((m, h) => Math.min(m, h.level), 6);

  return (
    <div
      className="flex flex-col shrink-0 overflow-hidden"
      style={{ width: 220, background: "var(--nh-bg-elevated)", borderLeft: "1px solid var(--nh-border)" }}
    >
      <div
        className="flex items-center gap-2 px-3 h-9 shrink-0 border-b"
        style={{ borderColor: "var(--nh-border)" }}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-wide flex-1"
          style={{ color: "var(--nh-text-secondary)" }}
        >
          Outline
        </span>
        <button onClick={onClose} className="nh-icon-btn" title="Close outline" aria-label="Close outline">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {headings.length === 0 ? (
          <div className="px-3 py-3 text-[12px]" style={{ color: "var(--nh-text-tertiary)" }}>
            No headings
          </div>
        ) : (
          headings.map((h, i) => (
            <button
              key={`${h.line}-${i}`}
              onClick={() => onJump(i)}
              className="nh-outline-item w-full text-left text-[12px] leading-5 py-[2px] pr-3 truncate block"
              style={{
                paddingLeft: 12 + (h.level - minLevel) * 12,
                color: h.level === minLevel ? "var(--nh-text)" : "var(--nh-text-secondary)",
              }}
              title={h.text}
            >
              {h.text}
            </button>
          ))
        )}
      </div>
    </div>
  );
});
