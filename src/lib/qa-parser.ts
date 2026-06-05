// Parsing helpers for `layout: qa` documents.
//
// A QA file is a plain markdown file whose body is split by marker lines:
//   - everything before the first `**>>>**`  -> full-width header
//   - text between `**>>>**` and `**<<<**`    -> left column (question)
//   - text after `**<<<**` (until the next `**>>>**`, `**===**`, or EOF) -> right column (answer)
//   - text after an optional `**===**` (until the next `**>>>**` or EOF) -> full-width band
//     below the row (the block's `after` field) — lets an answer end early so trailing prose
//     isn't swallowed into the answer column.
//
// These functions operate purely on the raw file string. The frontmatter block is
// preserved verbatim so `layout: qa` is never reformatted or polluted on save.

const OPEN_MARKER = "**>>>**";
const CLOSE_MARKER = "**<<<**";
const TERM_MARKER = "**===**";

export interface QaBlock {
  left: string;
  right: string;
  /** Optional full-width band after the answer, introduced by a `**===**` terminator. */
  after?: string;
}

export interface QaDocument {
  header: string;
  blocks: QaBlock[];
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

function isMarker(line: string, marker: string): boolean {
  return line.trim() === marker;
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
      target = "left";
      continue;
    }
    if (isMarker(line, CLOSE_MARKER) && target === "left") {
      target = "right";
      continue;
    }
    if (isMarker(line, TERM_MARKER) && target === "right") {
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
  };
}

/**
 * Rebuild a full raw file from frontmatter + a QA document. Inverse of
 * `splitFrontmatter` + `parseQaBlocks` (stable for normalized input).
 */
export function assembleQa(frontmatter: string, doc: QaDocument): string {
  const parts: string[] = [];
  if (doc.header.trim()) parts.push(doc.header.trim());
  for (const block of doc.blocks) {
    const lines = [OPEN_MARKER, "", block.left.trim(), "", CLOSE_MARKER, "", block.right.trim()];
    if (block.after?.trim()) lines.push("", TERM_MARKER, "", block.after.trim());
    parts.push(lines.join("\n"));
  }
  const bodyText = parts.join("\n\n");

  const fm = frontmatter.replace(/\n*$/, "");
  const prefix = fm ? `${fm}\n\n` : "";
  return `${prefix}${bodyText}\n`;
}
