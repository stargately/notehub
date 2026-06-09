import { describe, it, expect } from "vitest";
import {
  dirOf,
  joinPath,
  resolveImageSrc,
  extForMime,
  isImageFile,
  assetFileName,
} from "../image-assets";

describe("dirOf", () => {
  it("returns the directory portion of a path", () => {
    expect(dirOf("/Users/me/notes/doc.md")).toBe("/Users/me/notes");
    expect(dirOf("doc.md")).toBe("");
    expect(dirOf("/doc.md")).toBe("");
  });
});

describe("joinPath", () => {
  it("joins a dir and a relative path", () => {
    expect(joinPath("/Users/me/notes", "assets/x.png")).toBe("/Users/me/notes/assets/x.png");
  });

  it("resolves `.` and `..` segments", () => {
    expect(joinPath("/a/b/c", "../img.png")).toBe("/a/b/img.png");
    expect(joinPath("/a/b", "./sub/./y.png")).toBe("/a/b/sub/y.png");
    expect(joinPath("/a/b/c", "../../z.png")).toBe("/a/z.png");
  });

  it("keeps a relative result when the dir is relative", () => {
    expect(joinPath("notes", "assets/x.png")).toBe("notes/assets/x.png");
  });
});

describe("resolveImageSrc", () => {
  const doc = "/Users/me/notes/doc.md";

  it("passes through URLs with a scheme", () => {
    expect(resolveImageSrc("https://x.com/a.png", doc)).toEqual({ passthrough: "https://x.com/a.png" });
    expect(resolveImageSrc("http://x/a.png", null)).toEqual({ passthrough: "http://x/a.png" });
    expect(resolveImageSrc("data:image/png;base64,AAAA", doc)).toEqual({
      passthrough: "data:image/png;base64,AAAA",
    });
    expect(resolveImageSrc("blob:abc", doc)).toEqual({ passthrough: "blob:abc" });
    expect(resolveImageSrc("asset://localhost/x.png", doc)).toEqual({
      passthrough: "asset://localhost/x.png",
    });
  });

  it("passes through protocol-relative URLs", () => {
    expect(resolveImageSrc("//cdn/x.png", doc)).toEqual({ passthrough: "//cdn/x.png" });
  });

  it("treats an absolute filesystem path as a file to proxy", () => {
    expect(resolveImageSrc("/var/img/a.png", null)).toEqual({ filePath: "/var/img/a.png" });
  });

  it("resolves a relative path against the doc directory", () => {
    expect(resolveImageSrc("assets/a.png", doc)).toEqual({
      filePath: "/Users/me/notes/assets/a.png",
    });
    expect(resolveImageSrc("../shared/b.png", doc)).toEqual({
      filePath: "/Users/me/shared/b.png",
    });
  });

  it("returns null for a relative path with no doc directory (untitled)", () => {
    expect(resolveImageSrc("assets/a.png", null)).toBeNull();
  });

  it("returns null for empty/whitespace src", () => {
    expect(resolveImageSrc("   ", doc)).toBeNull();
    expect(resolveImageSrc("", doc)).toBeNull();
  });
});

describe("extForMime", () => {
  it("maps known image MIME types to extensions", () => {
    expect(extForMime("image/png")).toBe("png");
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("IMAGE/SVG+XML")).toBe("svg");
  });

  it("returns empty for unknown MIME types", () => {
    expect(extForMime("application/pdf")).toBe("");
    expect(extForMime("")).toBe("");
  });
});

describe("isImageFile", () => {
  it("recognizes image MIME types", () => {
    expect(isImageFile({ type: "image/png" })).toBe(true);
    expect(isImageFile({ type: "image/svg+xml" })).toBe(true);
  });

  it("rejects non-images and missing types", () => {
    expect(isImageFile({ type: "text/plain" })).toBe(false);
    expect(isImageFile({})).toBe(false);
  });
});

describe("assetFileName", () => {
  it("keeps a dragged file's own name", () => {
    expect(assetFileName({ name: "diagram.png", type: "image/png" })).toBe("diagram.png");
  });

  it("synthesizes a name from the MIME type for a nameless clipboard image", () => {
    expect(assetFileName({ type: "image/png" })).toBe("pasted-image.png");
    expect(assetFileName({ name: "", type: "image/jpeg" })).toBe("pasted-image.jpg");
  });

  it("falls back to png when the MIME type is unknown", () => {
    expect(assetFileName({ type: "image/unknown" })).toBe("pasted-image.png");
  });
});
