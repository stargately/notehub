import { describe, it, expect } from "vitest";
import { splitFrontmatter, parseQaBlocks, assembleQa } from "../qa-parser";

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
