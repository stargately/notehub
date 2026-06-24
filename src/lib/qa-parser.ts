// Parsing helpers for `layout: qa` documents.
//
// A QA file is a plain markdown file whose body is split by marker lines. Each of the three markers
// is accepted in three interchangeable forms — plain (`>>>`), bold-wrapped (`**>>>**`), or an
// HTML comment (`<!-- Q -->`) — so hand- or Claude-authored files in any style render as a Q&A:
//   open `>>>` / `**>>>**` / `<!-- Q -->`   close `<<<` / `**<<<**` / `<!-- A -->`
//   term `===` / `**===**` / `<!-- E -->`
//   - everything before the first open marker -> full-width header
//   - text between open and close             -> left column (question)
//   - text after close (until the next open, term, or EOF) -> right column (answer)
//   - text after an optional term (until the next open or EOF) -> full-width band
//     below the row (the block's `after` field) — lets an answer end early so trailing prose
//     isn't swallowed into the answer column.
//
// The authored form is preserved on save: `parseQaBlocks` records the form of the first marker as
// `markerStyle` and `assembleQa` re-emits that style, so a file stays plain / bold / comment as
// written (a marker-less / brand-new doc defaults to bold).
//
// These functions operate purely on the raw file string. The frontmatter block is
// preserved verbatim so `layout: qa` is never reformatted or polluted on save.

// The canonical (plain) marker tokens. `isMarker` also matches each one wrapped in `**…**` or as
// the HTML comment whose letter is keyed below (open=Q / close=A / term=E).
const OPEN_MARKER = ">>>";
const CLOSE_MARKER = "<<<";
const TERM_MARKER = "===";
const COMMENT_LETTER: Record<string, string> = { ">>>": "Q", "<<<": "A", "===": "E" };

export interface QaBlock {
  left: string;
  right: string;
  /** Optional full-width band after the answer, introduced by a `===` terminator. */
  after?: string;
}

export interface QaDocument {
  header: string;
  blocks: QaBlock[];
  /**
   * The marker form to serialize with — detected from the first marker on parse, preserved through
   * edits. Optional so doc literals built as `{ header, blocks }` still serialize (defaulting to
   * `"bold"`, the historical output).
   */
  markerStyle?: "bold" | "plain" | "comment";
}

/**
 * Split a raw file into its (verbatim) frontmatter block and the body that follows.
 * If there is no leading `---` frontmatter, `frontmatter` is an empty string.
 */
export function splitFrontmatter(raw: string): { frontmatter: string; body: string } {
  const match = raw.match(/^(---\r?\n[\s\S]*?\r?\n---\r?\n?)([\s\S]*)$/);
  if (!match) return { frontmatter: "", body: raw };
  return { frontmatter: match[1], body: match[2] };
}

const COMMENT_MARKER = /^<!--\s*([A-Za-z])\s*-->$/;

/** A line that is exactly `marker` — plain, bold-wrapped (`**…**`), or the matching HTML comment
 *  (`<!-- Q/A/E -->`, whitespace + case tolerant). */
function isMarker(line: string, marker: string): boolean {
  const t = line.trim();
  if (t === marker || t === `**${marker}**`) return true;
  const m = t.match(COMMENT_MARKER);
  return !!m && m[1].toUpperCase() === COMMENT_LETTER[marker];
}

/** The form a (confirmed) marker line was written in — drives `markerStyle` for serialization. */
function markerForm(line: string): "comment" | "bold" | "plain" {
  const t = line.trim();
  return t.startsWith("<!--") ? "comment" : t.startsWith("**") ? "bold" : "plain";
}

/** True for any QA structural marker line (`>>>` / `<<<` / `===`), in any form. Shared with the
 *  doc-stats and outline modules so those strip markers consistently with the parser. */
export function isQaMarkerLine(line: string): boolean {
  return (
    isMarker(line, OPEN_MARKER) || isMarker(line, CLOSE_MARKER) || isMarker(line, TERM_MARKER)
  );
}

/** Trim leading/trailing blank lines while preserving interior content. */
function trimBlankLines(text: string): string {
  return text.replace(/^\s*\n/, "").replace(/\n\s*$/, "").trim();
}

/**
 * Parse a QA body into a header plus zero or more two-column blocks.
 * Files with no markers yield a header equal to the whole body and no blocks.
 */
export function parseQaBlocks(body: string): QaDocument {
  const lines = body.split("\n");

  const headerLines: string[] = [];
  const blocks: QaBlock[] = [];

  // "header" until the first open marker, then left -> right -> (optional) after within blocks.
  let target: "header" | "left" | "right" | "after" = "header";
  let leftLines: string[] = [];
  let rightLines: string[] = [];
  let afterLines: string[] = [];
  // Form of the first recognized marker — the whole doc serializes in that style.
  let detectedStyle: "bold" | "plain" | "comment" | null = null;
  const noteStyle = (line: string) => {
    if (detectedStyle === null) detectedStyle = markerForm(line);
  };

  const flushBlock = () => {
    const after = trimBlankLines(afterLines.join("\n"));
    const block: QaBlock = {
      left: trimBlankLines(leftLines.join("\n")),
      right: trimBlankLines(rightLines.join("\n")),
    };
    if (after) block.after = after;
    blocks.push(block);
    leftLines = [];
    rightLines = [];
    afterLines = [];
  };

  for (const line of lines) {
    if (isMarker(line, OPEN_MARKER)) {
      if (target !== "header") flushBlock();
      noteStyle(line);
      target = "left";
      continue;
    }
    if (isMarker(line, CLOSE_MARKER) && target === "left") {
      noteStyle(line);
      target = "right";
      continue;
    }
    if (isMarker(line, TERM_MARKER) && target === "right") {
      noteStyle(line);
      target = "after";
      continue;
    }

    if (target === "header") headerLines.push(line);
    else if (target === "left") leftLines.push(line);
    else if (target === "right") rightLines.push(line);
    else afterLines.push(line);
  }

  if (target !== "header") flushBlock();

  return {
    header: trimBlankLines(headerLines.join("\n")),
    blocks,
    markerStyle: detectedStyle ?? "bold",
  };
}

/**
 * Compare two parsed QA documents and return the `data-qa-field` ids whose content changed
 * (`header`, `block-<i>-left|right|after`). Lets a live-reload remount only the cells an external
 * edit actually touched, so the user's cursor/scroll survive in every cell that didn't change
 * under them. A field present on one side but not the other (block added/removed, `after`
 * added/dropped) counts as changed.
 */
export function diffChangedFields(oldDoc: QaDocument, newDoc: QaDocument): string[] {
  const changed: string[] = [];
  if (oldDoc.header !== newDoc.header) changed.push("header");
  const count = Math.max(oldDoc.blocks.length, newDoc.blocks.length);
  for (let i = 0; i < count; i++) {
    const o = oldDoc.blocks[i];
    const b = newDoc.blocks[i];
    for (const side of ["left", "right", "after"] as const) {
      if (o?.[side] !== b?.[side]) changed.push(`block-${i}-${side}`);
    }
  }
  return changed;
}

/**
 * Rebuild a full raw file from frontmatter + a QA document. Inverse of
 * `splitFrontmatter` + `parseQaBlocks` (stable for normalized input).
 */
export function assembleQa(frontmatter: string, doc: QaDocument): string {
  // Re-emit the authored marker style; an unset style (doc literals, brand-new docs) stays bold.
  const style = doc.markerStyle ?? "bold";
  const tok = (plain: string, letter: string) =>
    style === "comment" ? `<!-- ${letter} -->` : style === "plain" ? plain : `**${plain}**`;
  const open = tok(OPEN_MARKER, COMMENT_LETTER[OPEN_MARKER]);
  const close = tok(CLOSE_MARKER, COMMENT_LETTER[CLOSE_MARKER]);
  const term = tok(TERM_MARKER, COMMENT_LETTER[TERM_MARKER]);

  const parts: string[] = [];
  if (doc.header.trim()) parts.push(doc.header.trim());
  for (const block of doc.blocks) {
    const lines = [open, "", block.left.trim(), "", close, "", block.right.trim()];
    if (block.after?.trim()) lines.push("", term, "", block.after.trim());
    parts.push(lines.join("\n"));
  }
  const bodyText = parts.join("\n\n");

  const fm = frontmatter.replace(/\n*$/, "");
  const prefix = fm ? `${fm}\n\n` : "";
  return `${prefix}${bodyText}\n`;
}
