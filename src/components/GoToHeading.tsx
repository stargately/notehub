import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fuzzyFilter } from "../lib/fuzzy";
import type { OutlineHeading } from "../lib/outline";

interface GoToHeadingProps {
  open: boolean;
  onClose: () => void;
  /** The active doc's parsed outline, in document order. */
  headings: OutlineHeading[];
  /** Jump to `headings[index]` (scroll-to + focus in the active view). */
  onJump: (index: number) => void;
}

interface Row {
  heading: OutlineHeading;
  /** Index into the original `headings` array (what `onJump` expects). */
  index: number;
  indices?: number[];
}

const MAX_ROWS = 100;

/** Heading text with fuzzy-matched characters accented (same treatment as QuickOpen). */
function RowLabel({ text, indices }: { text: string; indices?: number[] }) {
  if (!indices || indices.length === 0) {
    return (
      <span className="truncate" style={{ color: "var(--nh-text)" }}>
        {text}
      </span>
    );
  }
  const set = new Set(indices);
  return (
    <span className="truncate">
      {Array.from(text).map((ch, i) =>
        set.has(i) ? (
          <span key={i} style={{ color: "var(--nh-accent)", fontWeight: 600 }}>
            {ch}
          </span>
        ) : (
          <span key={i} style={{ color: "var(--nh-text)" }}>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

/**
 * Zed-style "Go to Symbol" (Cmd+Shift+O): a fuzzy finder over the active document's headings.
 * An empty query lists the full outline in document order; Enter jumps to the selection.
 */
export function GoToHeading({ open, onClose, headings, onJump }: GoToHeadingProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    inputRef.current?.focus();
  }, [open]);

  const minLevel = useMemo(
    () => headings.reduce((m, h) => Math.min(m, h.level), 6),
    [headings],
  );

  const results = useMemo<Row[]>(() => {
    if (!open) return [];
    const indexed = headings.map((heading, index) => ({ heading, index }));
    if (!query.trim()) return indexed.slice(0, MAX_ROWS);
    return fuzzyFilter(query.trim(), indexed, (r) => r.heading.text)
      .slice(0, MAX_ROWS)
      .map(({ item, match }) => ({ ...item, indices: match.indices }));
  }, [open, query, headings]);

  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, results.length - 1)));
  }, [results.length]);
  useEffect(() => {
    // Optional call: jsdom (tests) doesn't implement scrollIntoView.
    rowRefs.current[selected]?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  const choose = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      onClose();
      onJump(row.index);
    },
    [onClose, onJump],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (results.length ? (s + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => (results.length ? (s - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[selected]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center nh-fade-in"
      style={{ background: "rgba(0,0,0,0.32)", paddingTop: "14vh" }}
      onMouseDown={onClose}
    >
      <div
        className="w-[560px] max-w-[92vw] flex flex-col overflow-hidden"
        style={{
          background: "var(--nh-bg-elevated)",
          border: "1px solid var(--nh-border)",
          borderRadius: "var(--nh-radius-lg)",
          boxShadow: "var(--nh-shadow-lg)",
          maxHeight: "62vh",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Go to heading…"
          spellCheck={false}
          className="w-full bg-transparent outline-none px-4 h-12 text-[15px]"
          style={{ color: "var(--nh-text)", borderBottom: "1px solid var(--nh-border)" }}
        />

        <div className="flex-1 overflow-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px]" style={{ color: "var(--nh-text-tertiary)" }}>
              {headings.length === 0 ? "No headings in this document" : "No matching headings"}
            </div>
          ) : (
            results.map((row, i) => (
              <button
                key={`${row.heading.line}-${row.index}`}
                ref={(el) => (rowRefs.current[i] = el)}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => choose(row)}
                onMouseMove={() => setSelected(i)}
                className="w-full flex items-center gap-2 text-left pr-4 py-[6px] text-[13px]"
                style={{
                  background: i === selected ? "var(--nh-accent-subtle)" : undefined,
                  // Indent by nesting only while browsing the outline; search results stay flat.
                  paddingLeft: 16 + (query.trim() ? 0 : (row.heading.level - minLevel) * 14),
                }}
              >
                <span
                  className="shrink-0 text-[10px] font-semibold uppercase w-6"
                  style={{ color: "var(--nh-text-tertiary)" }}
                >
                  H{row.heading.level}
                </span>
                <RowLabel text={row.heading.text} indices={row.indices} />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
