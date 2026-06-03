import { useEffect, useRef, useState } from "react";
import { MarkdownWysiwyg } from "./MarkdownWysiwyg";
import { QaFindBar } from "./QaFindBar";
import { ThemeIcon } from "./ThemeIcon";
import type { ThemeMode } from "../hooks/useDarkMode";
import { printQaDocument } from "../lib/print";
import {
  splitFrontmatter,
  parseQaBlocks,
  assembleQa,
  type QaDocument,
} from "../lib/qa-parser";
import {
  collectMatches,
  paintHighlights,
  clearHighlights,
  scrollToMatch,
  replaceNthOccurrence,
  replaceAllOccurrences,
  type QaMatch,
} from "../lib/qa-find";

interface QaLayoutProps {
  /** Full raw file content (frontmatter + body). */
  content: string;
  /** Called with the rebuilt raw file whenever the user edits a cell. */
  onChange: (raw: string) => void;
  onToggleEditor: () => void;
  onCycleTheme: () => void;
  themeMode: ThemeMode;
  darkMode: boolean;
  projectName?: string;
  /** Base file name (no dir, no `.md`) — used as the print/PDF document title. */
  fileName?: string;
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
  content, onChange, onToggleEditor, onCycleTheme, themeMode, darkMode, projectName, fileName,
}: QaLayoutProps) {
  const [parsed, setParsed] = useState<ParsedState>(() => parse(content));
  // Bumped only on EXTERNAL content changes, to force a remount of the (mount-once) editors.
  const [mountKey, setMountKey] = useState(0);
  // The last raw string this view is in sync with (either received or emitted).
  const lastSyncedRef = useRef(content);
  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;

  // Latest content/title in a ref so the print shortcut always uses current values.
  const printRef = useRef<() => void>(() => {});
  // The browser's "Save as PDF" defaults the file name to the document <title>, so prefer
  // the actual file name (consistent with the .md on disk) over the YAML project name.
  printRef.current = () => void printQaDocument(content, fileName || projectName || "Untitled");

  // ─── Find & replace state ───
  // Find/highlight runs over the rendered DOM (CSS Highlight API); replace runs over
  // the markdown source strings in `parsed.doc`. See src/lib/qa-find.ts.
  const [findOpen, setFindOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const docRef = useRef<HTMLDivElement>(null);
  const matchesRef = useRef<QaMatch[]>([]);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;

  const closeFind = () => {
    setFindOpen(false);
    clearHighlights();
  };

  // Cmd/Ctrl+P prints; Cmd/Ctrl+F opens the find bar (and suppresses the WKWebView
  // native find, which doesn't work in the embedded webview anyway).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        printRef.current();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setFindOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Recompute matches when the query/case/open-state changes, and after the editors
  // remount (mountKey bumps on external change *and* on our own replace commits). The
  // rAF lets the remounted Crepe DOM lay out before we walk it.
  useEffect(() => {
    if (!findOpen) return;
    let raf = 0;
    raf = requestAnimationFrame(() => {
      const container = docRef.current;
      const matches = container && query ? collectMatches(container, query, { caseSensitive }) : [];
      matchesRef.current = matches;
      setMatchCount(matches.length);
      const clamped = matches.length ? Math.min(activeIndexRef.current, matches.length - 1) : 0;
      setActiveIndex(clamped);
      paintHighlights(matches, clamped);
      if (matches[clamped]) scrollToMatch(matches[clamped]);
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findOpen, query, caseSensitive, mountKey]);

  useEffect(() => () => clearHighlights(), []);

  const gotoMatch = (next: number) => {
    const matches = matchesRef.current;
    if (!matches.length) return;
    const wrapped = (next + matches.length) % matches.length;
    setActiveIndex(wrapped);
    paintHighlights(matches, wrapped);
    scrollToMatch(matches[wrapped]);
  };

  // Apply a string transform to one field ("header" | "block-<i>-left|right") and
  // return the new ParsedState, or null if the field is unknown or unchanged.
  const applyFieldReplace = (
    state: ParsedState,
    field: string,
    fn: (value: string) => string,
  ): ParsedState | null => {
    if (field === "header") {
      const header = fn(state.doc.header);
      if (header === state.doc.header) return null;
      return { ...state, doc: { ...state.doc, header } };
    }
    const m = field.match(/^block-(\d+)-(left|right)$/);
    if (!m) return null;
    const i = Number(m[1]);
    const side = m[2] as "left" | "right";
    const block = state.doc.blocks[i];
    if (!block) return null;
    const replaced = fn(block[side]);
    if (replaced === block[side]) return null;
    const blocks = state.doc.blocks.map((b, idx) => (idx === i ? { ...b, [side]: replaced } : b));
    return { ...state, doc: { ...state.doc, blocks } };
  };

  // Programmatic edits (replace) must remount the mount-once editors so the new text
  // renders — commit() alone only updates React state for serialization, not the live
  // Crepe DOM (normal typing updates the DOM itself, so it never bumps mountKey).
  const commitRemount = (next: ParsedState) => {
    commit(next);
    setMountKey((k) => k + 1);
  };

  const replaceCurrent = () => {
    const match = matchesRef.current[activeIndexRef.current];
    if (!match) return;
    const next = applyFieldReplace(parsedRef.current, match.field, (value) =>
      replaceNthOccurrence(value, query, replaceText, match.indexInField, caseSensitive));
    if (next) commitRemount(next);
  };

  const replaceAll = () => {
    if (!query) return;
    const cur = parsedRef.current;
    const header = replaceAllOccurrences(cur.doc.header, query, replaceText, caseSensitive);
    const blocks = cur.doc.blocks.map((b) => ({
      left: replaceAllOccurrences(b.left, query, replaceText, caseSensitive),
      right: replaceAllOccurrences(b.right, query, replaceText, caseSensitive),
    }));
    commitRemount({ ...cur, doc: { header, blocks } });
  };

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
  // Remount editors on theme change so mermaid diagrams re-render in the matching theme.
  const themeKey = `${mountKey}-${darkMode ? "d" : "l"}`;

  return (
    <div className="nh-qa-layout relative flex-1 flex flex-col overflow-hidden">
      {findOpen && (
        <QaFindBar
          query={query}
          replace={replaceText}
          caseSensitive={caseSensitive}
          matchCount={matchCount}
          activeIndex={activeIndex}
          onQueryChange={setQuery}
          onReplaceChange={setReplaceText}
          onToggleCase={() => setCaseSensitive((v) => !v)}
          onNext={() => gotoMatch(activeIndexRef.current + 1)}
          onPrev={() => gotoMatch(activeIndexRef.current - 1)}
          onReplaceCurrent={replaceCurrent}
          onReplaceAll={replaceAll}
          onClose={closeFind}
        />
      )}
      {/* Header bar (mirrors the Monaco editor header) */}
      <div
        className="nh-qa-topbar flex flex-wrap items-center gap-2 px-4 py-2 border-b"
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
          {isMac ? "Cmd" : "Ctrl"}+/ to edit raw · {isMac ? "Cmd" : "Ctrl"}+F to find · {isMac ? "Cmd" : "Ctrl"}+P to print
        </span>
        <div className="flex-1" />
        <button onClick={() => printRef.current()} className="nh-btn" title="Print (cheatsheet, letter size)">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
          </svg>
          Print
        </button>
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

      <div ref={docRef} className="nh-qa-doc flex-1 overflow-y-auto">
        {doc.header && (
          <div className="nh-qa-header" data-qa-field="header">
            <MarkdownWysiwyg key={`h-${themeKey}`} value={doc.header} onChange={updateHeader} darkMode={darkMode} placeholder="Write here…" />
          </div>
        )}

        {doc.blocks.map((block, i) => (
          <div key={`b-${i}-${themeKey}`} className="nh-qa-row">
            <div className="nh-qa-col nh-qa-col-left" data-qa-field={`block-${i}-left`}>
              <MarkdownWysiwyg
                key={`l-${i}-${themeKey}`}
                value={block.left}
                onChange={(v) => updateBlock(i, "left", v)}
                darkMode={darkMode}
                placeholder="Question…"
              />
            </div>
            <div className="nh-qa-col nh-qa-col-right" data-qa-field={`block-${i}-right`}>
              <MarkdownWysiwyg
                key={`r-${i}-${themeKey}`}
                value={block.right}
                onChange={(v) => updateBlock(i, "right", v)}
                darkMode={darkMode}
                placeholder="Answer…"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
