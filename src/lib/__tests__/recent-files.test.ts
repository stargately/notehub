import { describe, it, expect, beforeEach } from "vitest";
import { noteOpened, recentPaths, clearRecents } from "../recent-files";

describe("recent-files MRU", () => {
  beforeEach(() => clearRecents());

  it("orders most-recent first", () => {
    noteOpened("/a.md");
    noteOpened("/b.md");
    noteOpened("/c.md");
    expect(recentPaths()).toEqual(["/c.md", "/b.md", "/a.md"]);
  });

  it("dedups and promotes a re-opened path to the front", () => {
    noteOpened("/a.md");
    noteOpened("/b.md");
    noteOpened("/a.md");
    expect(recentPaths()).toEqual(["/a.md", "/b.md"]);
  });

  it("ignores empty and browser paths", () => {
    noteOpened("");
    noteOpened("browser://sample-project.md");
    expect(recentPaths()).toEqual([]);
  });

  it("bounds the list to 100 entries", () => {
    for (let i = 0; i < 130; i++) noteOpened(`/f${i}.md`);
    const paths = recentPaths();
    expect(paths.length).toBe(100);
    expect(paths[0]).toBe("/f129.md");
  });
});
