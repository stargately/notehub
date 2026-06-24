import { describe, it, expect } from "vitest";
import {
  parseOutline,
  stripInlineMarkdown,
  findDomHeadingIndex,
  type OutlineHeading,
} from "../outline";

describe("parseOutline", () => {
  it("parses ATX headings with levels and 0-based line numbers", () => {
    const src = "# One\n\ntext\n\n## Two\n\n### Three";
    expect(parseOutline(src)).toEqual([
      { level: 1, text: "One", raw: "One", line: 0 },
      { level: 2, text: "Two", raw: "Two", line: 4 },
      { level: 3, text: "Three", raw: "Three", line: 6 },
    ]);
  });

  it("returns an empty list for a doc with no headings", () => {
    expect(parseOutline("just some\nprose lines\n")).toEqual([]);
    expect(parseOutline("")).toEqual([]);
  });

  it("requires a space after the hashes and at most 6 levels", () => {
    expect(parseOutline("#nospace")).toEqual([]);
    expect(parseOutline("####### seven")).toEqual([]);
    expect(parseOutline("###### six")).toEqual([{ level: 6, text: "six", raw: "six", line: 0 }]);
  });

  it("strips an ATX closing sequence and skips empty headings", () => {
    expect(parseOutline("## foo ##")).toEqual([{ level: 2, text: "foo", raw: "foo", line: 0 }]);
    expect(parseOutline("##")).toEqual([]);
    expect(parseOutline("#   ")).toEqual([]);
  });

  it("allows up to 3 leading spaces but treats 4+ as indented code", () => {
    expect(parseOutline("   # indented")).toEqual([
      { level: 1, text: "indented", raw: "indented", line: 0 },
    ]);
    expect(parseOutline("    # code")).toEqual([]);
  });

  it("skips headings inside fenced code blocks (``` and ~~~, longer closers ok)", () => {
    const src = [
      "# Real",
      "```js",
      "# not a heading",
      "```",
      "~~~",
      "## also not",
      "~~~~",
      "## After",
    ].join("\n");
    expect(parseOutline(src).map((h) => h.text)).toEqual(["Real", "After"]);
  });

  it("does not close a fence with the other fence character", () => {
    const src = "```\n~~~\n# still code\n```\n# out";
    expect(parseOutline(src).map((h) => h.text)).toEqual(["out"]);
  });

  it("skips YAML frontmatter but keeps line numbers global to the file", () => {
    const src = "---\nlayout: qa\ntitle: x\n---\n\n# First";
    expect(parseOutline(src)).toEqual([{ level: 1, text: "First", raw: "First", line: 5 }]);
  });

  it("does not treat frontmatter delimiters as setext underlines", () => {
    const src = "---\nproject: x\n---\nbody text";
    expect(parseOutline(src)).toEqual([]);
  });

  it("parses setext headings (=== → h1, --- → h2)", () => {
    const src = "Title\n=====\n\nSection\n---";
    expect(parseOutline(src)).toEqual([
      { level: 1, text: "Title", raw: "Title", line: 0 },
      { level: 2, text: "Section", raw: "Section", line: 3 },
    ]);
  });

  it("keeps an hr after a blank line / list item from becoming a setext heading", () => {
    expect(parseOutline("para\n\n---\n")).toEqual([]);
    expect(parseOutline("- item\n---\n")).toEqual([]);
    expect(parseOutline("| a | b |\n---\n")).toEqual([]);
  });

  it("parses headings inside blockquotes", () => {
    expect(parseOutline("> # Quoted\n> > ## Nested")).toEqual([
      { level: 1, text: "Quoted", raw: "Quoted", line: 0 },
      { level: 2, text: "Nested", raw: "Nested", line: 1 },
    ]);
  });

  it("ignores QA marker lines and never reads one as setext text", () => {
    const src = "# Head\n\n**>>>**\n\nQ?\n\n**<<<**\n\nA.\n\n**===**\n---\n";
    expect(parseOutline(src).map((h) => h.text)).toEqual(["Head"]);
  });

  it("ignores plain and HTML-comment QA markers too", () => {
    const plain = "# Head\n\n>>>\n\nQ?\n\n<<<\n\nA.\n\n===\n";
    expect(parseOutline(plain).map((h) => h.text)).toEqual(["Head"]);
    const comment = "# Head\n\n<!-- Q -->\n\nQ?\n\n<!-- A -->\n\nA.\n\n<!-- E -->\n";
    expect(parseOutline(comment).map((h) => h.text)).toEqual(["Head"]);
  });

  it("a plain `===` terminator right under the answer is not promoted to a setext h1", () => {
    // Without the early QA-marker check (before the setext branch), `Answer.` + `===` would
    // wrongly outline as an h1 — the collision plain markers introduce.
    const src = ">>>\nQ?\n<<<\nAnswer.\n===\nnote";
    expect(parseOutline(src)).toEqual([]);
  });

  it("strips inline markdown from the display text but keeps it in raw", () => {
    const src = "## **Bold** and `code` and [link](http://x)";
    expect(parseOutline(src)).toEqual([
      {
        level: 2,
        text: "Bold and code and link",
        raw: "**Bold** and `code` and [link](http://x)",
        line: 0,
      },
    ]);
  });
});

describe("stripInlineMarkdown", () => {
  it("unwraps bold, italic, code, strikethrough", () => {
    expect(stripInlineMarkdown("**b** *i* _u_ `c` ~~s~~")).toBe("b i u c s");
    expect(stripInlineMarkdown("__bold__")).toBe("bold");
  });

  it("keeps snake_case underscores", () => {
    expect(stripInlineMarkdown("use snake_case_names here")).toBe("use snake_case_names here");
  });

  it("reduces links and images to their text", () => {
    expect(stripInlineMarkdown("see [docs](https://x.dev) and ![alt](img.png)")).toBe(
      "see docs and alt",
    );
  });

  it("collapses whitespace", () => {
    expect(stripInlineMarkdown("  a   b\tc ")).toBe("a b c");
  });
});

describe("findDomHeadingIndex", () => {
  const h = (level: number, text: string, line = 0): OutlineHeading => ({
    level,
    text,
    raw: text,
    line,
  });

  it("matches by level + text", () => {
    const headings = [h(1, "Intro"), h(2, "Setup")];
    const dom = [
      { level: 1, text: "Intro" },
      { level: 2, text: "Setup" },
    ];
    expect(findDomHeadingIndex(headings, 1, dom)).toBe(1);
  });

  it("disambiguates duplicate headings by occurrence", () => {
    const headings = [h(2, "Notes"), h(1, "Other"), h(2, "Notes")];
    const dom = [
      { level: 2, text: "Notes" },
      { level: 1, text: "Other" },
      { level: 2, text: "Notes" },
    ];
    expect(findDomHeadingIndex(headings, 0, dom)).toBe(0);
    expect(findDomHeadingIndex(headings, 2, dom)).toBe(2);
  });

  it("normalizes whitespace when comparing against DOM textContent", () => {
    const headings = [h(1, "A B")];
    const dom = [{ level: 1, text: "  A B ".replace(" ", " ") }];
    expect(findDomHeadingIndex(headings, 0, dom)).toBe(0);
  });

  it("falls back to positional matching when texts diverge but levels align", () => {
    const headings = [h(1, "Stripped one way")];
    const dom = [{ level: 1, text: "rendered another way" }];
    expect(findDomHeadingIndex(headings, 0, dom)).toBe(0);
  });

  it("returns -1 when nothing matches", () => {
    expect(findDomHeadingIndex([h(1, "X")], 0, [{ level: 3, text: "Y" }])).toBe(-1);
    expect(findDomHeadingIndex([], 0, [])).toBe(-1);
  });
});
