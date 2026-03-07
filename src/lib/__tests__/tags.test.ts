import { describe, it, expect } from "vitest";
import { formatTags, parseTags } from "../tags";

describe("formatTags", () => {
  it("joins an array into a comma-separated string", () => {
    expect(formatTags(["solar", "hardware"])).toBe("solar, hardware");
  });

  it("returns empty string for an empty array", () => {
    expect(formatTags([])).toBe("");
  });

  it("handles a single-element array", () => {
    expect(formatTags(["only"])).toBe("only");
  });

  it("converts non-array values to string", () => {
    expect(formatTags("already a string")).toBe("already a string");
    expect(formatTags(123)).toBe("123");
  });

  it("returns empty string for null/undefined", () => {
    expect(formatTags(null)).toBe("");
    expect(formatTags(undefined)).toBe("");
  });
});

describe("parseTags", () => {
  it("splits a comma-separated string into trimmed tags", () => {
    expect(parseTags("solar, hardware")).toEqual(["solar", "hardware"]);
  });

  it("trims whitespace around each tag", () => {
    expect(parseTags("  a , b , c  ")).toEqual(["a", "b", "c"]);
  });

  it("filters out empty segments", () => {
    expect(parseTags("a,,b, ,c")).toEqual(["a", "b", "c"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseTags("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseTags("  ,  , ")).toEqual([]);
  });

  it("passes through an existing array unchanged", () => {
    expect(parseTags(["x", "y"])).toEqual(["x", "y"]);
  });

  it("returns empty array for non-string, non-array values", () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags(42)).toEqual([]);
  });
});

describe("formatTags ↔ parseTags round-trip", () => {
  it("round-trips tags through format then parse", () => {
    const original = ["energy", "panels", "repair"];
    expect(parseTags(formatTags(original))).toEqual(original);
  });

  it("round-trips empty tags", () => {
    expect(parseTags(formatTags([]))).toEqual([]);
  });
});
