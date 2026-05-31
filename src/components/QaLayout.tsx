import { useEffect, useRef, useState } from "react";
import { MarkdownWysiwyg } from "./MarkdownWysiwyg";
import { ThemeIcon } from "./ThemeIcon";
import type { ThemeMode } from "../hooks/useDarkMode";
import {
  splitFrontmatter,
  parseQaBlocks,
  assembleQa,
  type QaDocument,
} from "../lib/qa-parser";

interface QaLayoutProps {
  /** Full raw file content (frontmatter + body). */
  content: string;
  /** Called with the rebuilt raw file whenever the user edits a cell. */
  onChange: (raw: string) => void;
  onToggleEditor: () => void;
  onCycleTheme: () => void;
  themeMode: ThemeMode;
  projectName?: string;
}

interface ParsedState {
  frontmatter: string;
  doc: QaDocument;
}

function parse(content: string): ParsedState {
  const { frontmatter, body } = splitFrontmatter(content);
  return { frontmatter, doc: parseQaBlocks(body) };
}

/**
 * Typora-style two-column Q&A view for `layout: qa` files. Renders pre-marker
 * content as a full-width header, then each `**>>>**`/`**<<<**` block as a
 * two-column row (question | answer). Edits round-trip back to raw markdown.
 */
export function QaLayout({
  content, onChange, onToggleEditor, onCycleTheme, themeMode, projectName,
}: QaLayoutProps) {
  const [parsed, setParsed] = useState<ParsedState>(() => parse(content));
  // Bumped only on EXTERNAL content changes, to force a remount of the (mount-once) editors.
  const [mountKey, setMountKey] = useState(0);
  // The last raw string this view is in sync with (either received or emitted).
  const lastSyncedRef = useRef(content);
  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;

  // External content changes (reload, Monaco edit, tab switch) → re-parse + remount.
  useEffect(() => {
    if (content !== lastSyncedRef.current) {
      lastSyncedRef.current = content;
      const next = parse(content);
      setParsed(next);
      parsedRef.current = next;
      setMountKey((k) => k + 1);
    }
  }, [content]);

  const commit = (next: ParsedState) => {
    setParsed(next);
    parsedRef.current = next;
    const raw = assembleQa(next.frontmatter, next.doc);
    lastSyncedRef.current = raw; // mark as ours so the effect above ignores the echo
    onChange(raw);
  };

  const updateHeader = (header: string) => {
    const cur = parsedRef.current;
    commit({ ...cur, doc: { ...cur.doc, header } });
  };

  const updateBlock = (index: number, side: "left" | "right", value: string) => {
    const cur = parsedRef.current;
    const blocks = cur.doc.blocks.map((b, i) => (i === index ? { ...b, [side]: value } : b));
    commit({ ...cur, doc: { ...cur.doc, blocks } });
  };

  const { doc } = parsed;
  const isMac = navigator.platform.includes("Mac");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header bar (mirrors the Monaco editor header) */}
      <div
        className="flex flex-wrap items-center gap-2 px-4 py-2 border-b"
        style={{ borderColor: "var(--nh-border)", background: "var(--nh-bg-elevated)" }}
      >
        <h1 className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--nh-text)" }}>
          {projectName || "Untitled"}
        </h1>
        <span
          className="px-2 py-0.5 text-[10px] rounded-full font-medium uppercase tracking-wide"
          style={{ background: "var(--nh-accent-subtle)", color: "var(--nh-accent)" }}
        >
          Q&amp;A
        </span>
        <span className="text-[10px]" style={{ color: "var(--nh-text-tertiary)" }}>
          {isMac ? "Cmd" : "Ctrl"}+/ to edit raw
        </span>
        <div className="flex-1" />
        <button onClick={onToggleEditor} className="nh-btn">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          Code
        </button>
        <button onClick={onCycleTheme} className="nh-btn" style={{ padding: "6px 8px" }} title={`Theme: ${themeMode} (click to cycle)`}>
          <ThemeIcon themeMode={themeMode} />
        </button>
      </div>

      <div className="nh-qa-doc flex-1 overflow-y-auto">
        {doc.header && (
          <div className="nh-qa-header">
            <MarkdownWysiwyg key={`h-${mountKey}`} value={doc.header} onChange={updateHeader} placeholder="Write here…" />
          </div>
        )}

        {doc.blocks.map((block, i) => (
          <div key={`b-${i}-${mountKey}`} className="nh-qa-row">
            <div className="nh-qa-col nh-qa-col-left">
              <MarkdownWysiwyg
                key={`l-${i}-${mountKey}`}
                value={block.left}
                onChange={(v) => updateBlock(i, "left", v)}
                placeholder="Question…"
              />
            </div>
            <div className="nh-qa-col nh-qa-col-right">
              <MarkdownWysiwyg
                key={`r-${i}-${mountKey}`}
                value={block.right}
                onChange={(v) => updateBlock(i, "right", v)}
                placeholder="Answer…"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
