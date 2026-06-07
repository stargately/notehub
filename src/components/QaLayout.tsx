import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from "react";
import { useKeymapAction } from "../lib/keymap/provider";
import { ACTIONS } from "../lib/keymap/actions";
import { MarkdownWysiwyg } from "./MarkdownWysiwyg";
import { QaFindBar } from "./QaFindBar";
import { printQaDocument } from "../lib/print";
import { toFraction, fromFraction } from "../lib/scroll-sync";
import {
  splitFrontmatter,
  parseQaBlocks,
  assembleQa,
  diffChangedFields,
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

const IS_MAC = typeof navigator !== "undefined" && navigator.platform.includes("Mac");

interface QaLayoutProps {
  /** Full raw file content (frontmatter + body). */
  content: string;
  /** Called with the rebuilt raw file whenever the user edits a cell. */
  onChange: (raw: string) => void;
  onToggleEditor: () => void;
  darkMode: boolean;
  /** Base file name (no dir, no `.md`) — the document title + print/PDF title. */
  fileName?: string;
  /**
   * "qa" → two-column Q&A doc (`layout: qa`). "plain" → a normal markdown file with
   * no layout: it has no `**>>>**` markers, so it renders as one full-width editor.
   * Only affects presentation (badge text); the edit/save path is identical.
   */
  variant?: "qa" | "plain";
  /** Whether this doc's tab is active — gates its keymap shortcuts (Cmd+F find, Cmd+Shift+P print). */
  active?: boolean;
  /** Shared scroll-progress fraction carried across a Cmd+/ view toggle (see DocumentView). */
  scrollRef?: MutableRefObject<number | null>;
}

interface ParsedState {
  frontmatter: string;
  doc: QaDocument;
}

function parse(content: string): ParsedState {
  const { frontmatter, body } = splitFrontmatter(content);
  return { frontmatter, doc: parseQaBlocks(body) };
}

// Apply a string transform to one field (`header` | `block-<i>-left|right|after`) and return the
// new ParsedState, or null if the field is unknown or the value is unchanged. Pure — hoisted so
// it's shared by the cell edit handler and find/replace, and never a fresh closure per render.
function applyFieldReplace(
  state: ParsedState,
  field: string,
  fn: (value: string) => string,
): ParsedState | null {
  if (field === "header") {
    const header = fn(state.doc.header);
    if (header === state.doc.header) return null;
    return { ...state, doc: { ...state.doc, header } };
  }
  const m = field.match(/^block-(\d+)-(left|right|after)$/);
  if (!m) return null;
  const i = Number(m[1]);
  const side = m[2] as "left" | "right" | "after";
  const block = state.doc.blocks[i];
  if (!block) return null;
  const current = block[side] ?? "";
  const replaced = fn(current);
  if (replaced === current) return null;
  const blocks = state.doc.blocks.map((b, idx) => (idx === i ? { ...b, [side]: replaced } : b));
  return { ...state, doc: { ...state.doc, blocks } };
}

interface QaCellProps {
  /** The cell's `data-qa-field` (`header` | `block-<i>-left|right|after`) — its edit identity + find anchor. */
  field: string;
  className: string;
  value: string;
  darkMode: boolean;
  placeholder: string;
  /** Stable edit handler keyed by `field`; QaCell binds it so its `onChange` identity is stable. */
  onEdit: (field: string, value: string) => void;
}

/**
 * One memoized Milkdown cell. Because `onEdit` is stable and the bound `onChange` is `useCallback`d,
 * editing one cell doesn't reconcile the others — each `QaLayout` re-render only touches the cell
 * whose `value` actually changed (and Milkdown is mount-once, so even that is a cheap no-op render).
 */
const QaCell = memo(function QaCell({ field, className, value, darkMode, placeholder, onEdit }: QaCellProps) {
  const handleChange = useCallback((v: string) => onEdit(field, v), [onEdit, field]);
  return (
    <div className={className} data-qa-field={field}>
      <MarkdownWysiwyg value={value} onChange={handleChange} darkMode={darkMode} placeholder={placeholder} />
    </div>
  );
});

/**
 * Typora-style two-column Q&A view for `layout: qa` files. Renders pre-marker
 * content as a full-width header, then each `**>>>**`/`**<<<**` block as a
 * two-column row (question | answer). Edits round-trip back to raw markdown.
 */
export function QaLayout({
  content, onChange, onToggleEditor, darkMode, fileName,
  variant = "qa", active = true, scrollRef,
}: QaLayoutProps) {
  const [parsed, setParsed] = useState<ParsedState>(() => parse(content));
  // Bumped on EXTERNAL change / replace — used only to re-run the find match collection (the
  // actual editor remounts are now driven per-cell by `versionsRef`, so a live reload only
  // remounts the cells whose content changed and preserves cursor/scroll in the rest).
  const [mountKey, setMountKey] = useState(0);
  // The last raw string this view is in sync with (either received or emitted).
  const lastSyncedRef = useRef(content);
  const parsedRef = useRef(parsed);
  parsedRef.current = parsed;

  // Per-cell remount version, keyed by `data-qa-field`. A cell remounts (recreating its mount-once
  // Milkdown editor) only when its version bumps — which happens for the specific cells whose
  // content changed on an external reload or a replace, never on normal typing.
  const versionsRef = useRef<Map<string, number>>(new Map());
  const cellKey = (field: string) => `${field}-${darkMode ? "d" : "l"}-v${versionsRef.current.get(field) ?? 0}`;
  const bumpChanged = useCallback((oldDoc: QaDocument, newDoc: QaDocument) => {
    for (const field of diffChangedFields(oldDoc, newDoc)) {
      versionsRef.current.set(field, (versionsRef.current.get(field) ?? 0) + 1);
    }
  }, []);

  // Latest content/title in a ref so the print shortcut always uses current values.
  const printRef = useRef<() => void>(() => {});
  // The browser's "Save as PDF" defaults the file name to the document <title>, so use the
  // actual file name (consistent with the .md on disk).
  printRef.current = () => void printQaDocument(content, fileName || "Untitled");

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

  // Cmd+Shift+P prints; Cmd+F opens the find bar (suppressing the broken WKWebView native find).
  // Both are dispatched by the global keymap while the QA editor is the active context.
  useKeymapAction(ACTIONS.print, () => printRef.current(), active);
  useKeymapAction(ACTIONS.find, () => setFindOpen(true), active);

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

  // Cmd+/ view toggle: on mount, resume the scroll progress carried over from the raw editor —
  // re-applying across a few frames while the mount-once Milkdown editors create and the doc height
  // settles. On unmount, hand our own progress back so the raw editor can resume at the same place.
  useLayoutEffect(() => {
    const el = docRef.current;
    if (!el) return;
    let raf = 0;
    const incoming = scrollRef?.current;
    if (incoming != null) {
      if (scrollRef) scrollRef.current = null;
      let prevHeight = -1;
      let stable = 0;
      let frames = 0;
      const apply = () => {
        el.scrollTop = fromFraction(incoming, el.scrollHeight, el.clientHeight);
        stable = el.scrollHeight === prevHeight ? stable + 1 : 0;
        prevHeight = el.scrollHeight;
        if (stable < 2 && ++frames < 30) raf = requestAnimationFrame(apply);
      };
      raf = requestAnimationFrame(apply);
    }
    return () => {
      cancelAnimationFrame(raf);
      if (scrollRef) scrollRef.current = toFraction(el.scrollTop, el.scrollHeight, el.clientHeight);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gotoMatch = (next: number) => {
    const matches = matchesRef.current;
    if (!matches.length) return;
    const wrapped = (next + matches.length) % matches.length;
    setActiveIndex(wrapped);
    paintHighlights(matches, wrapped);
    scrollToMatch(matches[wrapped]);
  };

  // Commit a new parsed state: update local state + serialize back to raw markdown for the file.
  // Stable identity (dep: onChange) so the memoized QaCell children aren't re-rendered each edit.
  const commit = useCallback(
    (next: ParsedState) => {
      setParsed(next);
      parsedRef.current = next;
      const raw = assembleQa(next.frontmatter, next.doc);
      lastSyncedRef.current = raw; // mark as ours so the [content] effect ignores the echo
      onChange(raw);
    },
    [onChange],
  );

  // Programmatic edits (replace) must remount the mount-once editors so the new text renders —
  // commit() alone only updates React state for serialization, not the live Crepe DOM (normal
  // typing updates the DOM itself). Bump only the cells whose content actually changed.
  const commitRemount = useCallback(
    (next: ParsedState) => {
      bumpChanged(parsedRef.current.doc, next.doc);
      commit(next);
      setMountKey((k) => k + 1);
    },
    [commit, bumpChanged],
  );

  // One stable edit handler for every cell (header/left/right/after), keyed by `data-qa-field`.
  const onEdit = useCallback(
    (field: string, value: string) => {
      const next = applyFieldReplace(parsedRef.current, field, () => value);
      if (next) commit(next);
    },
    [commit],
  );

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
      ...b,
      left: replaceAllOccurrences(b.left, query, replaceText, caseSensitive),
      right: replaceAllOccurrences(b.right, query, replaceText, caseSensitive),
      ...(b.after !== undefined && { after: replaceAllOccurrences(b.after, query, replaceText, caseSensitive) }),
    }));
    commitRemount({ ...cur, doc: { header, blocks } });
  };

  // External content changes (live reload, Monaco raw-edit, tab switch) → re-parse. Only the cells
  // whose content changed remount (via `bumpChanged`); unchanged cells keep their editor — so the
  // user's cursor and the scroll position survive a reload that touched a different cell.
  useEffect(() => {
    if (content !== lastSyncedRef.current) {
      lastSyncedRef.current = content;
      const next = parse(content);
      bumpChanged(parsedRef.current.doc, next.doc);
      setParsed(next);
      parsedRef.current = next;
      setMountKey((k) => k + 1);
    }
  }, [content, bumpChanged]);

  const { doc } = parsed;

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
      {/* Thin Zed-style header bar: file name + type badge + icon actions. */}
      <div className="nh-qa-topbar nh-doc-header">
        <span className="text-[13px] font-semibold truncate" style={{ color: "var(--nh-text)" }}>
          {fileName || "Untitled"}
        </span>
        <span className="text-[10px] uppercase tracking-wide shrink-0" style={{ color: "var(--nh-text-tertiary)" }}>
          {variant === "qa" ? "Q&A" : "Markdown"}
        </span>
        <div className="flex-1" />
        <button
          onClick={() => printRef.current()}
          className="nh-icon-btn"
          title={`Print cheatsheet (${IS_MAC ? "⌘⇧P" : "Ctrl+Shift+P"})`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
          </svg>
        </button>
        <button
          onClick={onToggleEditor}
          className="nh-icon-btn"
          title={`Edit raw markdown (${IS_MAC ? "⌘/" : "Ctrl+/"})`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </button>
      </div>

      <div ref={docRef} className="nh-qa-doc flex-1 overflow-y-auto">
        {(doc.header || doc.blocks.length === 0) && (
          <QaCell
            key={cellKey("header")}
            field="header"
            className="nh-qa-header"
            value={doc.header}
            darkMode={darkMode}
            placeholder="Write here…"
            onEdit={onEdit}
          />
        )}

        {doc.blocks.map((block, i) => (
          <Fragment key={`b-${i}`}>
            <div className="nh-qa-row">
              <QaCell
                key={cellKey(`block-${i}-left`)}
                field={`block-${i}-left`}
                className="nh-qa-col nh-qa-col-left"
                value={block.left}
                darkMode={darkMode}
                placeholder="Question…"
                onEdit={onEdit}
              />
              <QaCell
                key={cellKey(`block-${i}-right`)}
                field={`block-${i}-right`}
                className="nh-qa-col nh-qa-col-right"
                value={block.right}
                darkMode={darkMode}
                placeholder="Answer…"
                onEdit={onEdit}
              />
            </div>
            {block.after !== undefined && (
              <QaCell
                key={cellKey(`block-${i}-after`)}
                field={`block-${i}-after`}
                className="nh-qa-after"
                value={block.after}
                darkMode={darkMode}
                placeholder="Notes…"
                onEdit={onEdit}
              />
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
