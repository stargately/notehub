import { describe, it, expect } from "vitest";
import {
  splitFrontmatter,
  parseQaBlocks,
  assembleQa,
  diffChangedFields,
  isQaMarkerLine,
} from "../qa-parser";

describe("splitFrontmatter", () => {
  it("splits a leading frontmatter block from the body verbatim", () => {
    const raw = "---\nlayout: qa\n---\n\n# Hello\n\nbody";
    const { frontmatter, body } = splitFrontmatter(raw);
    expect(frontmatter).toContain("layout: qa");
    expect(body.trim()).toBe("# Hello\n\nbody");
  });

  it("returns empty frontmatter when there is none", () => {
    const { frontmatter, body } = splitFrontmatter("# No frontmatter");
    expect(frontmatter).toBe("");
    expect(body).toBe("# No frontmatter");
  });
});

describe("parseQaBlocks", () => {
  it("treats a body with no markers as a single full-width header", () => {
    const doc = parseQaBlocks("# Title\n\nsome content");
    expect(doc.header).toBe("# Title\n\nsome content");
    expect(doc.blocks).toHaveLength(0);
  });

  it("splits a single >>>/<<< block into left and right", () => {
    const body = ["intro", "", "**>>>**", "the question", "**<<<**", "the answer"].join("\n");
    const doc = parseQaBlocks(body);
    expect(doc.header).toBe("intro");
    expect(doc.blocks).toEqual([{ left: "the question", right: "the answer" }]);
  });

  it("supports multiple stacked blocks", () => {
    const body = [
      "**>>>**", "q1", "**<<<**", "a1",
      "**>>>**", "q2", "**<<<**", "a2",
    ].join("\n");
    const doc = parseQaBlocks(body);
    expect(doc.header).toBe("");
    expect(doc.blocks).toEqual([
      { left: "q1", right: "a1" },
      { left: "q2", right: "a2" },
    ]);
  });

  it("handles an open marker with no close (right is empty)", () => {
    const doc = parseQaBlocks("**>>>**\nonly a question");
    expect(doc.blocks).toEqual([{ left: "only a question", right: "" }]);
  });

  it("ends an answer at `**===**` and captures trailing text as `after`", () => {
    const body = ["**>>>**", "q", "**<<<**", "a", "**===**", "a full-width note"].join("\n");
    const doc = parseQaBlocks(body);
    expect(doc.blocks).toEqual([{ left: "q", right: "a", after: "a full-width note" }]);
  });

  it("keeps `after` band attached when a following block starts", () => {
    const body = [
      "**>>>**", "q1", "**<<<**", "a1", "**===**", "note 1",
      "**>>>**", "q2", "**<<<**", "a2",
    ].join("\n");
    const doc = parseQaBlocks(body);
    expect(doc.blocks).toEqual([
      { left: "q1", right: "a1", after: "note 1" },
      { left: "q2", right: "a2" },
    ]);
  });

  it("a normal block has no `after` key (optional field, no regression)", () => {
    const doc = parseQaBlocks(["**>>>**", "q", "**<<<**", "a"].join("\n"));
    expect(doc.blocks).toEqual([{ left: "q", right: "a" }]);
    expect("after" in doc.blocks[0]).toBe(false);
  });

  it("treats `**===**` as literal text outside an answer (header/left region)", () => {
    const header = parseQaBlocks("intro\n**===**\nmore");
    expect(header.header).toBe("intro\n**===**\nmore");
    expect(header.blocks).toHaveLength(0);

    const left = parseQaBlocks(["**>>>**", "q", "**===**", "still q"].join("\n"));
    expect(left.blocks).toEqual([{ left: "q\n**===**\nstill q", right: "" }]);
  });
});

describe("marker forms — plain / bold / HTML-comment", () => {
  // Each marker has three interchangeable spellings; a doc in any of them parses identically.
  const forms = {
    plain: { open: ">>>", close: "<<<", term: "===" },
    bold: { open: "**>>>**", close: "**<<<**", term: "**===**" },
    comment: { open: "<!-- Q -->", close: "<!-- A -->", term: "<!-- E -->" },
  } as const;

  for (const [style, m] of Object.entries(forms)) {
    it(`parses ${style} markers into the same blocks`, () => {
      const body = ["intro", "", m.open, "q", m.close, "a", m.term, "note"].join("\n");
      const doc = parseQaBlocks(body);
      expect(doc.header).toBe("intro");
      expect(doc.blocks).toEqual([{ left: "q", right: "a", after: "note" }]);
    });

    it(`detects markerStyle="${style}" from the first marker`, () => {
      const body = [m.open, "q", m.close, "a"].join("\n");
      expect(parseQaBlocks(body).markerStyle).toBe(style);
    });

    it(`assembleQa re-emits ${style} markers and round-trips stably`, () => {
      const body = [m.open, "q", m.close, "a", m.term, "note"].join("\n");
      const doc = parseQaBlocks(body);
      const out = assembleQa("", doc);
      expect(out).toContain(m.open);
      expect(out).toContain(m.close);
      expect(out).toContain(m.term);
      const reparsed = parseQaBlocks(splitFrontmatter(out).body);
      expect(reparsed).toEqual(doc); // blocks + markerStyle preserved
    });
  }

  it("defaults markerStyle to 'bold' for a marker-less doc", () => {
    expect(parseQaBlocks("# just a header").markerStyle).toBe("bold");
  });

  it("the first marker's form wins for a mixed-form doc", () => {
    const body = [">>>", "q", "**<<<**", "a"].join("\n");
    const doc = parseQaBlocks(body);
    expect(doc.blocks).toEqual([{ left: "q", right: "a" }]);
    expect(doc.markerStyle).toBe("plain");
  });

  it("comment markers are whitespace- and case-tolerant", () => {
    const body = ["<!--Q-->", "q", "<!--  a  -->", "a"].join("\n");
    expect(parseQaBlocks(body).blocks).toEqual([{ left: "q", right: "a" }]);
  });

  it("a non-Q/A/E HTML comment is not a marker (stays literal content)", () => {
    const body = [">>>", "q", "<<<", "a\n<!-- TODO: revisit -->"].join("\n");
    const doc = parseQaBlocks(body);
    expect(doc.blocks).toEqual([{ left: "q", right: "a\n<!-- TODO: revisit -->" }]);
  });

  it("isQaMarkerLine recognizes every form and rejects non-markers", () => {
    for (const line of [">>>", "<<<", "===", "**>>>**", "<!-- Q -->", "<!--e-->", "  <<<  "]) {
      expect(isQaMarkerLine(line)).toBe(true);
    }
    for (const line of ["hello", "<!-- X -->", ">> >", "= = ="]) {
      expect(isQaMarkerLine(line)).toBe(false);
    }
  });
});

describe("assembleQa round-trip", () => {
  it("is stable: parse → assemble → parse yields the same document", () => {
    const raw = [
      "---", "layout: qa", "---", "",
      "# Header", "",
      "**>>>**", "", "Question one?", "", "**<<<**", "", "Answer one.", "",
      "**>>>**", "", "Question two?", "", "**<<<**", "", "Answer two.",
    ].join("\n");

    const { frontmatter, body } = splitFrontmatter(raw);
    const doc = parseQaBlocks(body);
    const rebuilt = assembleQa(frontmatter, doc);

    const reparsed = splitFrontmatter(rebuilt);
    expect(reparsed.frontmatter).toContain("layout: qa");
    expect(parseQaBlocks(reparsed.body)).toEqual(doc);
  });

  it("round-trips a block with an `after` band", () => {
    const raw = [
      "---", "layout: qa", "---", "",
      "**>>>**", "", "Question?", "", "**<<<**", "", "Answer.", "", "**===**", "", "Full-width note.",
    ].join("\n");

    const { frontmatter, body } = splitFrontmatter(raw);
    const doc = parseQaBlocks(body);
    expect(doc.blocks).toEqual([{ left: "Question?", right: "Answer.", after: "Full-width note." }]);

    const rebuilt = assembleQa(frontmatter, doc);
    expect(rebuilt).toContain("**===**");
    expect(parseQaBlocks(splitFrontmatter(rebuilt).body)).toEqual(doc);
  });

  it("emits no `**===**` for a block without an `after` band", () => {
    const out = assembleQa("", { header: "", blocks: [{ left: "q", right: "a" }] });
    expect(out).not.toContain("**===**");
  });

  it("preserves frontmatter verbatim (no task-format pollution)", () => {
    const fm = "---\nlayout: qa\n---\n";
    const out = assembleQa(fm, { header: "hi", blocks: [] });
    expect(out).toContain("layout: qa");
    expect(out).not.toContain("project:");
    expect(out).not.toContain("columns:");
  });
});

describe("rich WYSIWYG content round-trips verbatim", () => {
  // The Crepe editor emits plain markdown for math ($…$), task lists (- [ ]), GFM tables,
  // fenced code, and ```mermaid fences. The QA parser is line-based and never interprets that
  // syntax, so cell content must pass through parse → assemble → parse unchanged (the
  // parser-layer half of the round-trip; Milkdown's getMarkdown owns the other half).
  const MATH = "Inline $E = mc^2$ and a block:\n\n$$\n\\int_0^1 x^2 dx\n$$";
  const TASKS = "- [ ] todo item\n- [x] done item";
  const TABLE = "| A | B |\n| --- | --- |\n| 1 | 2 |";
  const CODE = "```ts\nconst x: number = 1;\n```";
  const MERMAID = "```mermaid\ngraph TD;\n  A-->B;\n```";

  for (const [name, content] of Object.entries({ MATH, TASKS, TABLE, CODE, MERMAID })) {
    it(`preserves ${name} as a plain-doc header (no markers)`, () => {
      const doc = parseQaBlocks(content);
      expect(doc.header).toBe(content);
      expect(doc.blocks).toHaveLength(0);
      const rebuilt = assembleQa("---\nlayout: qa\n---\n", doc);
      expect(rebuilt).toContain(content);
      const reparsed = splitFrontmatter(rebuilt);
      expect(reparsed.frontmatter).toContain("layout: qa");
      expect(parseQaBlocks(reparsed.body)).toEqual(doc);
    });

    it(`preserves ${name} inside a QA answer column`, () => {
      const body = ["**>>>**", "the question", "**<<<**", content].join("\n");
      const doc = parseQaBlocks(body);
      expect(doc.blocks).toEqual([{ left: "the question", right: content }]);
      const rebuilt = assembleQa("", doc);
      expect(parseQaBlocks(splitFrontmatter(rebuilt).body)).toEqual(doc);
    });
  }

  it("does not let table pipes or task brackets be mistaken for markers", () => {
    const body = ["**>>>**", TABLE, "**<<<**", TASKS].join("\n");
    const doc = parseQaBlocks(body);
    expect(doc.blocks).toEqual([{ left: TABLE, right: TASKS }]);
  });
});

describe("diffChangedFields", () => {
  const doc = (header: string, blocks: { left: string; right: string; after?: string }[]) => ({ header, blocks });

  it("returns nothing when the documents are identical", () => {
    const a = doc("H", [{ left: "Q1", right: "A1" }, { left: "Q2", right: "A2" }]);
    const b = doc("H", [{ left: "Q1", right: "A1" }, { left: "Q2", right: "A2" }]);
    expect(diffChangedFields(a, b)).toEqual([]);
  });

  it("reports only the cell that changed (the live-reload case)", () => {
    const a = doc("H", [{ left: "Q1", right: "A1" }, { left: "Q2", right: "A2" }]);
    const b = doc("H", [{ left: "Q1", right: "A1" }, { left: "Q2", right: "A2 EDITED" }]);
    expect(diffChangedFields(a, b)).toEqual(["block-1-right"]);
  });

  it("reports the header and an added/removed block", () => {
    const a = doc("H", [{ left: "Q1", right: "A1" }]);
    const b = doc("H2", [{ left: "Q1", right: "A1" }, { left: "Q2", right: "A2" }]);
    expect(diffChangedFields(a, b)).toEqual(["header", "block-1-left", "block-1-right"]);
  });

  it("treats an added/dropped `after` band as a change", () => {
    const a = doc("H", [{ left: "Q1", right: "A1" }]);
    const b = doc("H", [{ left: "Q1", right: "A1", after: "note" }]);
    expect(diffChangedFields(a, b)).toEqual(["block-0-after"]);
  });
});
