import { describe, it, expect } from "vitest";
import { fileKindForPath, languageForPath } from "../file-kind";

describe("fileKindForPath", () => {
  it("treats markdown extensions as markdown", () => {
    expect(fileKindForPath("/notes/todo.md")).toBe("markdown");
    expect(fileKindForPath("/notes/doc.MDX")).toBe("markdown");
  });

  it("treats a null (untitled) path as markdown", () => {
    expect(fileKindForPath(null)).toBe("markdown");
  });

  it("detects images", () => {
    expect(fileKindForPath("/img/logo.png")).toBe("image");
    expect(fileKindForPath("/img/photo.JPEG")).toBe("image");
    expect(fileKindForPath("/img/icon.svg")).toBe("image");
  });

  it("falls back to raw for everything else", () => {
    expect(fileKindForPath("/src/main.rs")).toBe("raw");
    expect(fileKindForPath("/config.json")).toBe("raw");
    expect(fileKindForPath("/notes/plain")).toBe("raw");
  });
});

describe("languageForPath", () => {
  it("maps known extensions to Monaco language ids", () => {
    expect(languageForPath("/src/main.ts")).toBe("typescript");
    expect(languageForPath("/a/b.rs")).toBe("rust");
    expect(languageForPath("/c.json")).toBe("json");
    expect(languageForPath("/d.yaml")).toBe("yaml");
  });

  it("is case-insensitive on the extension", () => {
    expect(languageForPath("/X.PY")).toBe("python");
  });

  it("falls back to plaintext for unknown or extensionless paths", () => {
    expect(languageForPath("/notes/readme")).toBe("plaintext");
    expect(languageForPath("/notes/file.unknownext")).toBe("plaintext");
  });
});
