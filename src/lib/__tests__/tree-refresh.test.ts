import { describe, it, expect } from "vitest";
import { parentDir, isUnderRoot } from "../tree-refresh";

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

describe("isUnderRoot", () => {
  it("is true for a file inside the root subtree", () => {
    expect(isUnderRoot("/home/me/proj/notes.md", "/home/me/proj")).toBe(true);
    expect(isUnderRoot("/home/me/proj/src/main.rs", "/home/me/proj")).toBe(true);
  });

  it("is false when there is no workspace root", () => {
    expect(isUnderRoot("/home/me/proj/notes.md", null)).toBe(false);
  });

  it("does not match a sibling directory with a shared prefix", () => {
    // /a/bc must not be considered under /a/b.
    expect(isUnderRoot("/a/bc/file.md", "/a/b")).toBe(false);
  });

  it("tolerates a trailing slash on the root", () => {
    expect(isUnderRoot("/home/me/proj/notes.md", "/home/me/proj/")).toBe(true);
  });

  it("is false for a path outside the root", () => {
    expect(isUnderRoot("/tmp/other/notes.md", "/home/me/proj")).toBe(false);
  });
});
