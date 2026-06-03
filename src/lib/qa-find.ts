// Find/replace helpers for the `layout: qa` view.
//
// The QA view renders many independent Milkdown editors. Find/highlight runs over
// the *rendered* DOM (what the user sees) using the CSS Custom Highlight API, which
// paints ranges without mutating the editors' ProseMirror-managed DOM. Replace, by
// contrast, runs against the markdown *source* strings held in QaLayout's state (see
// `replaceNthOccurrence`) — the real source of truth. For plain prose the two align
// 1:1; a query that overlaps markdown syntax (e.g. inside `**bold**`) can diverge.

/** A single rendered-text match, anchored to a DOM Range and its source field. */
export interface QaMatch {
  range: Range;
  /** Value of the nearest `[data-qa-field]` ancestor (e.g. "header", "block-0-left"). */
  field: string;
  /** 0-based index of this match among matches within the same field, in document order. */
  indexInField: number;
}

const HL_ALL = "nh-find";
const HL_ACTIVE = "nh-find-active";

/** Whether the CSS Custom Highlight API is available (Safari/WKWebView 17.2+). */
export function supportsHighlightApi(): boolean {
  return (
    typeof CSS !== "undefined" &&
    "highlights" in CSS &&
    typeof Highlight !== "undefined"
  );
}

/**
 * Walk the rendered DOM under `container` and return every occurrence of `query`,
 * in document order. Each `[data-qa-field]` region is scanned independently: its
 * descendant text nodes are concatenated (with an offset→node map) so a match that
 * spans adjacent inline text nodes still resolves to a valid Range.
 */
export function collectMatches(
  container: HTMLElement,
  query: string,
  opts: { caseSensitive: boolean },
): QaMatch[] {
  const matches: QaMatch[] = [];
  if (!query) return matches;

  const fields = container.querySelectorAll<HTMLElement>("[data-qa-field]");
  fields.forEach((fieldEl) => {
    const field = fieldEl.getAttribute("data-qa-field") || "";

    // Concatenate text nodes, tracking where each node starts in the combined string.
    const walker = document.createTreeWalker(fieldEl, NodeFilter.SHOW_TEXT);
    const segments: { node: Text; start: number }[] = [];
    let combined = "";
    let node = walker.nextNode();
    while (node) {
      const text = node.nodeValue || "";
      segments.push({ node: node as Text, start: combined.length });
      combined += text;
      node = walker.nextNode();
    }
    if (!combined) return;

    const haystack = opts.caseSensitive ? combined : combined.toLowerCase();
    const needle = opts.caseSensitive ? query : query.toLowerCase();

    let from = 0;
    let indexInField = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      const range = rangeForSpan(segments, at, at + needle.length);
      if (range) {
        matches.push({ range, field, indexInField });
        indexInField += 1;
      }
      from = at + needle.length; // non-overlapping
    }
  });

  return matches;
}

/** Build a DOM Range spanning [start, end) offsets in the concatenated field text. */
function rangeForSpan(
  segments: { node: Text; start: number }[],
  start: number,
  end: number,
): Range | null {
  const startPos = locate(segments, start);
  const endPos = locate(segments, end);
  if (!startPos || !endPos) return null;
  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  return range;
}

/** Map a combined-string offset to the (text node, local offset) it falls in. */
function locate(
  segments: { node: Text; start: number }[],
  offset: number,
): { node: Text; offset: number } | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const len = seg.node.nodeValue?.length ?? 0;
    if (offset >= seg.start && offset <= seg.start + len) {
      return { node: seg.node, offset: offset - seg.start };
    }
  }
  return null;
}

/** Paint all matches (and the active one separately). No-op when unsupported. */
export function paintHighlights(matches: QaMatch[], activeIndex: number): void {
  if (!supportsHighlightApi()) return;
  const all = new Highlight(...matches.map((m) => m.range));
  CSS.highlights.set(HL_ALL, all);
  const active = matches[activeIndex];
  if (active) CSS.highlights.set(HL_ACTIVE, new Highlight(active.range));
  else CSS.highlights.delete(HL_ACTIVE);
}

/** Remove all find highlights. */
export function clearHighlights(): void {
  if (!supportsHighlightApi()) return;
  CSS.highlights.delete(HL_ALL);
  CSS.highlights.delete(HL_ACTIVE);
}

/** Scroll the match's containing element into view (centered). */
export function scrollToMatch(match: QaMatch): void {
  const el = match.range.startContainer.parentElement;
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}

/**
 * Replace the `n`-th (0-based) occurrence of `query` in `src` with `replacement`.
 * Returns `src` unchanged if there are fewer than `n+1` occurrences.
 */
export function replaceNthOccurrence(
  src: string,
  query: string,
  replacement: string,
  n: number,
  caseSensitive: boolean,
): string {
  if (!query) return src;
  const haystack = caseSensitive ? src : src.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();

  let from = 0;
  let seen = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return src;
    if (seen === n) {
      return src.slice(0, at) + replacement + src.slice(at + needle.length);
    }
    seen += 1;
    from = at + needle.length;
  }
}

/** Replace every occurrence of `query` in `src` with `replacement`. */
export function replaceAllOccurrences(
  src: string,
  query: string,
  replacement: string,
  caseSensitive: boolean,
): string {
  if (!query) return src;
  if (caseSensitive) return src.split(query).join(replacement);
  // Case-insensitive: walk and rebuild so the original casing of surrounding text is kept.
  const lower = src.toLowerCase();
  const needle = query.toLowerCase();
  let out = "";
  let from = 0;
  for (;;) {
    const at = lower.indexOf(needle, from);
    if (at === -1) {
      out += src.slice(from);
      return out;
    }
    out += src.slice(from, at) + replacement;
    from = at + needle.length;
  }
}
