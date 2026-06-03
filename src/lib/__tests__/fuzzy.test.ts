import { describe, it, expect } from "vitest";
import { fuzzyMatch, fuzzyScore, fuzzyFilter } from "../fuzzy";

describe("fuzzyMatch", () => {
  it("returns null when the query is not a subsequence", () => {
    expect(fuzzyMatch("xyz", "src/App.tsx")).toBeNull();
    expect(fuzzyMatch("apz", "app.md")).toBeNull();
  });

  it("returns null for an empty query or an over-long query", () => {
    expect(fuzzyMatch("", "anything")).toBeNull();
    expect(fuzzyMatch("toolong", "short")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(fuzzyMatch("APP", "src/app.tsx")).not.toBeNull();
    expect(fuzzyMatch("app", "src/APP.tsx")).not.toBeNull();
  });

  it("reports matched indices that line up with the query characters", () => {
    const m = fuzzyMatch("ac", "abc")!;
    expect(m.indices).toEqual([0, 2]);
    // Each reported index in the target equals the corresponding query char.
    const q = "ac";
    m.indices.forEach((idx, i) => expect("abc"[idx].toLowerCase()).toBe(q[i]));
  });

  it("scores consecutive runs above gapped matches", () => {
    const consecutive = fuzzyScore("read", "readme.md")!;
    const gapped = fuzzyScore("read", "r-e-a-d.md")!;
    expect(consecutive).toBeGreaterThan(gapped);
  });

  it("rewards word-boundary starts", () => {
    // 'tm' as the heads of task / manager beats 'tm' buried mid-word.
    const boundary = fuzzyScore("tm", "task-manager.md")!;
    const buried = fuzzyScore("tm", "atmosphere.md")!;
    expect(boundary).toBeGreaterThan(buried);
  });

  it("ranks a basename match above a scattered path match", () => {
    const basename = fuzzyScore("app", "src/App.tsx")!;
    const scattered = fuzzyScore("app", "a/p/p/other.md")!;
    expect(basename).toBeGreaterThan(scattered);
  });
});

describe("fuzzyFilter", () => {
  const files = ["src/App.tsx", "src/components/Toolbar.tsx", "README.md", "a/p/p/other.md"];

  it("returns items unchanged for an empty query", () => {
    const out = fuzzyFilter("", files, (f) => f);
    expect(out.map((o) => o.item)).toEqual(files);
  });

  it("drops non-matches and ranks the best match first", () => {
    const out = fuzzyFilter("app", files, (f) => f);
    expect(out.map((o) => o.item)).not.toContain("README.md");
    expect(out[0].item).toBe("src/App.tsx");
  });

  it("breaks score ties toward the shorter target", () => {
    const out = fuzzyFilter("ab", ["ab", "aXXXb", "ab/longer/path.md"], (f) => f);
    expect(out[0].item).toBe("ab");
  });
});
