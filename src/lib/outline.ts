// Document outline: parse markdown headings for the outline panel and the Cmd+Shift+O
// go-to-heading overlay.
//
// `parseOutline` runs over a doc's raw markdown source (the same string both the Monaco raw
// editor and the Milkdown WYSIWYG serialize to), so one outline serves every view:
//   - Monaco jumps by `line` (0-based in the source string → `revealLineInCenter(line + 1)`).
//   - The WYSIWYG view maps a heading to its rendered <h1>–<h6> element via
//     `findDomHeadingIndex` (level + stripped text + occurrence), since the QA layout renders
//     many independent editors and a source offset doesn't translate to a DOM position.

export interface OutlineHeading {
  /** Heading depth, 1–6. */
  level: number;
  /** Display text — inline markdown stripped, whitespace collapsed. */
  text: string;
  /** The heading text as written (inline syntax intact, closing `#`s removed). */
  raw: string;
  /** 0-based line index in the source string passed to `parseOutline`. */
  line: number;
}

/** A rendered heading element's (level, textContent) — what `findDomHeadingIndex` matches against. */
export interface DomHeading {
  level: number;
  text: string;
}

const FRONTMATTER_DELIM = /^---\s*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
// Lines that can't be the paragraph text of a setext heading (list items, table rows,
// indented code) — keeps `- item` + `---` reading as a list + hr, not an h2.
const NON_PARAGRAPH = /^( {4,}|\t| {0,3}([-*+][ \t]|\d{1,9}[.)][ \t])|\s*\|)/;
// `layout: qa` structural markers — never heading text.
const QA_MARKERS = new Set(["**>>>**", "**<<<**", "**===**"]);

/** Strip leading blockquote markers so `> # quoted heading` still outlines (and stays aligned
 *  with the rendered DOM, where it is a real <h1>). */
function stripBlockquote(line: string): string {
  return line.replace(/^( {0,3}> ?)+/, "");
}

/**
 * Reduce inline markdown to its display text: images/links → their text, code spans unwrapped,
 * emphasis/strikethrough markers dropped, whitespace collapsed. Best-effort (regex, not an AST) —
 * good enough for outline labels and for matching the rendered DOM's `textContent`.
 */
export function stripInlineMarkdown(s: string): string {
  let out = s;
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1"); // images → alt text
  out = out.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // links → link text
  out = out.replace(/`+([^`]+)`+/g, "$1"); // code spans
  out = out.replace(/(\*\*|__)(.+?)\1/g, "$2"); // bold
  out = out.replace(/\*([^*]+)\*/g, "$1"); // *italic*
  out = out.replace(/(^|[^\w])_([^_]+)_(?=[^\w]|$)/g, "$1$2"); // _italic_ (not snake_case)
  out = out.replace(/~~([^~]+)~~/g, "$1"); // strikethrough
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Parse every heading in a markdown source string, in document order. Handles ATX (`# foo`,
 * optional closing `#`s) and setext (`===`/`---` underlines) headings, including inside
 * blockquotes; skips YAML frontmatter and fenced code blocks. Line numbers are global to the
 * input string (frontmatter included), so they map 1:1 onto the raw editor.
 */
export function parseOutline(source: string): OutlineHeading[] {
  const lines = source.split("\n");
  const headings: OutlineHeading[] = [];

  // Skip a leading YAML frontmatter block verbatim (its `---` lines aren't setext/hr material).
  let start = 0;
  if (lines.length > 0 && FRONTMATTER_DELIM.test(lines[0])) {
    for (let j = 1; j < lines.length; j++) {
      if (FRONTMATTER_DELIM.test(lines[j])) {
        start = j + 1;
        break;
      }
    }
  }

  let fence: { char: string; len: number } | null = null;
  // Last paragraph-ish line — the candidate text of a setext heading.
  let prevText: string | null = null;
  let prevLine = -1;

  for (let i = start; i < lines.length; i++) {
    const line = stripBlockquote(lines[i]);

    const fenceMatch = line.match(FENCE);
    if (fence) {
      // Closing fence: same char, at least as long, nothing after it.
      if (
        fenceMatch &&
        fenceMatch[1][0] === fence.char &&
        fenceMatch[1].length >= fence.len &&
        fenceMatch[2].trim() === ""
      ) {
        fence = null;
      }
      prevText = null;
      continue;
    }
    if (fenceMatch) {
      fence = { char: fenceMatch[1][0], len: fenceMatch[1].length };
      prevText = null;
      continue;
    }

    const atx = line.match(ATX);
    if (atx) {
      const raw = (atx[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim();
      const text = stripInlineMarkdown(raw);
      if (text) headings.push({ level: atx[1].length, text, raw, line: i });
      prevText = null;
      continue;
    }

    const setext = line.match(SETEXT);
    if (setext && prevText !== null) {
      const raw = prevText.trim();
      const text = stripInlineMarkdown(raw);
      if (text) headings.push({ level: setext[1][0] === "=" ? 1 : 2, text, raw, line: prevLine });
      prevText = null;
      continue;
    }

    if (line.trim() === "" || NON_PARAGRAPH.test(line) || QA_MARKERS.has(line.trim())) {
      prevText = null;
    } else {
      prevText = line;
      prevLine = i;
    }
  }

  return headings;
}

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Map outline heading `index` to its rendered heading element: the nth DOM heading sharing its
 * (level, stripped text), where n is the heading's occurrence among identical outline entries.
 * Falls back to plain positional matching (same index, same level) when the texts diverge —
 * e.g. an inline-markdown edge the regex stripper and the real renderer disagree on. Returns the
 * index into `dom`, or -1.
 */
export function findDomHeadingIndex(
  headings: OutlineHeading[],
  index: number,
  dom: DomHeading[],
): number {
  const target = headings[index];
  if (!target) return -1;
  const key = `${target.level}:${normalize(target.text)}`;

  let occurrence = 0;
  for (let i = 0; i < index; i++) {
    if (`${headings[i].level}:${normalize(headings[i].text)}` === key) occurrence++;
  }
  let seen = 0;
  for (let j = 0; j < dom.length; j++) {
    if (`${dom[j].level}:${normalize(dom[j].text)}` === key) {
      if (seen === occurrence) return j;
      seen++;
    }
  }
  return dom[index]?.level === target.level ? index : -1;
}
