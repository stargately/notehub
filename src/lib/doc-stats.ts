// Live document statistics for the status bar (Typora-style): word count, character count, and
// estimated reading time, computed from a doc's raw markdown source.
//
// Two halves:
//   - Pure stats: `computeDocStats` derives an honest plain-text rendering of the markdown
//     (frontmatter, fence delimiters, QA markers, and syntax decoration dropped; the *content* of
//     code blocks is kept — it's real text the reader reads) and counts it. `formatDocStats`
//     renders the one status-bar string.
//   - A tiny module store (`publishDocStats`/`subscribeDocStats`/`getDocStats`, the same pattern
//     as `recent-files.ts` / `tree-refresh.ts`): the active DocumentView publishes, StatusBar
//     subscribes via `useSyncExternalStore`. Keeping this out of App state means a stats tick
//     while typing re-renders only the status bar — not the Sidebar/TabBar/document tree.

import { isQaMarkerLine } from "./qa-parser";

export interface DocStats {
  /** Word count: whitespace-separated tokens, plus each CJK character counted as one word. */
  words: number;
  /** Characters of the derived plain text, line breaks excluded (spaces count). */
  chars: number;
  /** Estimated reading time at ~200 wpm, rounded; ≥1 whenever there are any words. */
  readingMinutes: number;
}

const READING_WPM = 200;

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
// Pure-decoration lines: setext underlines, thematic breaks, table separator rows.
const DECORATION_LINE = /^\s*(={3,}|-{3,}|_{3,}|\*{3,}|\|?[\s:|-]*-[\s:|-]*\|?)\s*$/;

// CJK ranges counted per-character (a whitespace-token count would lump a whole sentence into one
// "word"): Hiragana/Katakana, CJK Unified (+ext A, compat), Hangul syllables.
const CJK = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF]/g;

/** Reduce one non-code line to its display text (block + inline markdown decoration dropped). */
function stripLine(line: string): string {
  let s = line.replace(/^( {0,3}> ?)+/, ""); // blockquote markers
  s = s.replace(/^ {0,3}#{1,6}[ \t]+/, "").replace(/[ \t]+#+[ \t]*$/, ""); // ATX heading hashes
  s = s.replace(/^\s*([-*+]|\d{1,9}[.)])[ \t]+/, ""); // list markers
  s = s.replace(/^\[( |x|X)\][ \t]+/, ""); // task checkbox (after its list marker)
  s = s.replace(/\|/g, " "); // table cell pipes
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1"); // images → alt text
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // links → link text
  s = s.replace(/`+([^`]+)`+/g, "$1"); // code spans
  s = s.replace(/(\*\*|__)(.+?)\1/g, "$2"); // bold
  s = s.replace(/\*([^*]+)\*/g, "$1"); // *italic*
  s = s.replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, "$1$2"); // _italic_ (not snake_case)
  s = s.replace(/~~([^~]+)~~/g, "$1"); // strikethrough
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Derive the plain text a reader actually reads from a markdown source: frontmatter, fence
 * delimiter lines, QA structural markers, and decoration-only lines are dropped; markdown syntax
 * is stripped from prose lines; the content of fenced code blocks is kept verbatim.
 */
export function stripToPlainText(source: string): string {
  const body = source.replace(FRONTMATTER, "");
  const out: string[] = [];
  let fence: { char: string; len: number } | null = null;

  for (const line of body.split("\n")) {
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.char &&
        fenceMatch[1].length >= fence.len &&
        fenceMatch[2].trim() === ""
      ) {
        fence = null;
      } else {
        out.push(line); // code content counts as text, verbatim
      }
      continue;
    }
    if (FENCE.test(line)) {
      fence = { char: fenceMatch![1][0], len: fenceMatch![1].length };
      continue;
    }
    if (isQaMarkerLine(line) || DECORATION_LINE.test(line)) continue;
    out.push(stripLine(line));
  }

  return out.join("\n");
}

/** Word/char/reading-time stats for a markdown source string. */
export function computeDocStats(source: string): DocStats {
  const plain = stripToPlainText(source);
  const cjkWords = (plain.match(CJK) ?? []).length;
  const tokenWords = (plain.replace(CJK, " ").match(/\S+/g) ?? []).length;
  const words = cjkWords + tokenWords;
  return {
    words,
    chars: plain.replace(/\n/g, "").length,
    readingMinutes: words === 0 ? 0 : Math.max(1, Math.round(words / READING_WPM)),
  };
}

/** The status-bar string, e.g. `1,234 words · 5,678 chars · ~6 min read` (reading time only when non-empty). */
export function formatDocStats(stats: DocStats): string {
  const n = (v: number) => v.toLocaleString("en-US");
  const parts = [
    `${n(stats.words)} ${stats.words === 1 ? "word" : "words"}`,
    `${n(stats.chars)} ${stats.chars === 1 ? "char" : "chars"}`,
  ];
  if (stats.words > 0) parts.push(`~${n(stats.readingMinutes)} min read`);
  return parts.join(" · ");
}

// ─── Module store: active-document stats → status bar ───

let current: DocStats | null = null;
const listeners = new Set<() => void>();

function statsEqual(a: DocStats | null, b: DocStats | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.words === b.words && a.chars === b.chars && a.readingMinutes === b.readingMinutes;
}

/**
 * Publish the active doc's stats (or `null` when no doc is active). Only the **active** tab's
 * DocumentView publishes — the same single-publisher model as its `DocCommands` bundle. Equal
 * stats are dropped so subscribers don't re-render on a no-op tick.
 */
export function publishDocStats(stats: DocStats | null): void {
  if (statsEqual(current, stats)) return;
  current = stats;
  for (const l of [...listeners]) l();
}

/** Snapshot for `useSyncExternalStore` (stable identity between publishes). */
export function getDocStats(): DocStats | null {
  return current;
}

/** Subscribe to stats changes; returns the unsubscribe. */
export function subscribeDocStats(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}
