import { describe, it, expect } from "vitest";
import { deriveBaseName, buildHtml } from "../print";

describe("deriveBaseName", () => {
  it("strips the directory and the .md extension", () => {
    expect(deriveBaseName("/Users/me/notes/study-guide.md")).toBe("study-guide");
    expect(deriveBaseName("study-guide.md")).toBe("study-guide");
  });

  it("strips the extension case-insensitively", () => {
    expect(deriveBaseName("/a/b/Readme.MD")).toBe("Readme");
  });

  it("keeps non-.md names and only drops the directory", () => {
    expect(deriveBaseName("/a/b/notes.txt")).toBe("notes.txt");
    expect(deriveBaseName("/a/b/plain")).toBe("plain");
  });

  it("preserves dots inside the name (only the trailing .md goes)", () => {
    expect(deriveBaseName("/x/v1.2.notes.md")).toBe("v1.2.notes");
  });

  it("returns undefined for null/undefined/empty so callers can fall back", () => {
    expect(deriveBaseName(null)).toBeUndefined();
    expect(deriveBaseName(undefined)).toBeUndefined();
    expect(deriveBaseName("")).toBeUndefined();
  });

  it("returns undefined when the path is only a directory with a bare .md", () => {
    expect(deriveBaseName("/a/b/.md")).toBeUndefined();
  });
});

describe("buildHtml", () => {
  it("uses the given title as the document <title> (the PDF default name)", () => {
    const html = buildHtml("study-guide", "<p>hi</p>");
    expect(html).toContain("<title>study-guide</title>");
    expect(html).toContain("<p>hi</p>");
  });

  it("HTML-escapes the title", () => {
    const html = buildHtml("a<b>&c", "");
    expect(html).toContain("<title>a&lt;b&gt;&amp;c</title>");
  });
});
