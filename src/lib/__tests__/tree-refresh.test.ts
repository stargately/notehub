import { describe, it, expect } from "vitest";
import { parentDir } from "../tree-refresh";

describe("parentDir", () => {
  it("returns the directory portion of a file path", () => {
    expect(parentDir("/home/me/proj/notes.md")).toBe("/home/me/proj");
    expect(parentDir("/home/me/proj/src")).toBe("/home/me/proj");
  });

  it("returns the parent for a nested path", () => {
    expect(parentDir("/a/b/c/d.txt")).toBe("/a/b/c");
  });

  it("handles a top-level entry", () => {
    expect(parentDir("/file.md")).toBe("/file.md");
  });
});
