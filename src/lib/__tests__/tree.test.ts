import { describe, it, expect } from "vitest";
import { sortEntries } from "../tree";
import type { DirEntry } from "../types";

const entry = (name: string, is_dir: boolean): DirEntry => ({
  name,
  path: `/root/${name}`,
  is_dir,
});

describe("sortEntries", () => {
  it("puts directories before files", () => {
    const sorted = sortEntries([
      entry("zebra.md", false),
      entry("src", true),
      entry("apple.md", false),
      entry("docs", true),
    ]);
    expect(sorted.map((e) => e.name)).toEqual([
      "docs",
      "src",
      "apple.md",
      "zebra.md",
    ]);
  });

  it("sorts case-insensitively within a group", () => {
    const sorted = sortEntries([
      entry("Banana.md", false),
      entry("apple.md", false),
      entry("Cherry.md", false),
    ]);
    expect(sorted.map((e) => e.name)).toEqual([
      "apple.md",
      "Banana.md",
      "Cherry.md",
    ]);
  });

  it("does not mutate the input array", () => {
    const input = [entry("b", false), entry("a", true)];
    const copy = [...input];
    sortEntries(input);
    expect(input).toEqual(copy);
  });

  it("handles empty input", () => {
    expect(sortEntries([])).toEqual([]);
  });
});
