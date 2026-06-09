import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Tauri bridge — these are the only two tauri-api fns the module touches.
const toAssetUrlMock = vi.fn(async (p: string) => `asset://localhost/${p}`);
const saveAssetMock = vi.fn(async (_doc: string, name: string, _bytes?: Uint8Array) => `assets/${name}`);
vi.mock("../tauri-api", () => ({
  toAssetUrl: (p: string) => toAssetUrlMock(p),
  saveAsset: (doc: string, name: string, bytes: Uint8Array) => saveAssetMock(doc, name, bytes),
}));

import { Schema } from "@milkdown/kit/prose/model";
import { EditorState } from "@milkdown/kit/prose/state";
import { EditorView } from "@milkdown/kit/prose/view";
import {
  proxyImageUrl,
  uploadImage,
  imageFilesFrom,
  imageGesture,
  makeImagePasteHandlers,
  insertImages,
} from "../milkdown-image-paste";

// A minimal File-like with the only method the code calls (`arrayBuffer`). Real `File` also works
// in jsdom, but this keeps the MIME type / name explicit and avoids Blob construction quirks.
function fakeFile(name: string, type: string): File {
  return {
    name,
    type,
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as unknown as File;
}

function fileList(...files: File[]): FileList {
  const indexed: Record<number, File> = {};
  files.forEach((f, i) => (indexed[i] = f));
  return { length: files.length, item: (i: number) => files[i] ?? null, ...indexed } as unknown as FileList;
}

beforeEach(() => {
  toAssetUrlMock.mockClear();
  saveAssetMock.mockClear();
});

describe("proxyImageUrl", () => {
  const doc = "/Users/me/notes/doc.md";

  it("passes a real URL through without touching the asset bridge", async () => {
    expect(await proxyImageUrl("https://x.com/a.png", doc)).toBe("https://x.com/a.png");
    expect(toAssetUrlMock).not.toHaveBeenCalled();
  });

  it("resolves a relative src against the doc dir and converts to an asset URL", async () => {
    const out = await proxyImageUrl("assets/a.png", doc);
    expect(toAssetUrlMock).toHaveBeenCalledWith("/Users/me/notes/assets/a.png");
    expect(out).toBe("asset://localhost//Users/me/notes/assets/a.png");
  });

  it("converts an absolute filesystem path to an asset URL", async () => {
    await proxyImageUrl("/var/img/a.png", null);
    expect(toAssetUrlMock).toHaveBeenCalledWith("/var/img/a.png");
  });

  it("returns the src unchanged when a relative path can't be resolved (untitled doc)", async () => {
    expect(await proxyImageUrl("assets/a.png", null)).toBe("assets/a.png");
    expect(toAssetUrlMock).not.toHaveBeenCalled();
  });
});

describe("uploadImage", () => {
  it("saves next to a real doc and returns the relative path", async () => {
    const out = await uploadImage(fakeFile("pic.png", "image/png"), "/Users/me/doc.md");
    expect(saveAssetMock).toHaveBeenCalledWith("/Users/me/doc.md", "pic.png", expect.any(Uint8Array));
    expect(out).toBe("assets/pic.png");
  });

  it("falls back to a transient blob URL for an untitled doc (no save)", async () => {
    const createObjectURL = vi.fn(() => "blob:fake");
    vi.stubGlobal("URL", { ...URL, createObjectURL });
    const out = await uploadImage(fakeFile("pic.png", "image/png"), null);
    expect(out).toBe("blob:fake");
    expect(saveAssetMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("imageFilesFrom", () => {
  it("keeps only image files", () => {
    const list = fileList(fakeFile("a.png", "image/png"), fakeFile("b.txt", "text/plain"));
    expect(imageFilesFrom(list).map((f) => f.name)).toEqual(["a.png"]);
  });

  it("returns [] for a null/empty list", () => {
    expect(imageFilesFrom(null)).toEqual([]);
    expect(imageFilesFrom(fileList())).toEqual([]);
  });
});

describe("imageGesture", () => {
  const list = fileList(fakeFile("a.png", "image/png"));

  it("returns the files + doc path for an image gesture on a saved doc", () => {
    expect(imageGesture(list, "/doc.md")).toEqual({
      files: [expect.objectContaining({ name: "a.png" })],
      docPath: "/doc.md",
    });
  });

  it("returns null when there are no image files", () => {
    expect(imageGesture(fileList(fakeFile("b.txt", "text/plain")), "/doc.md")).toBeNull();
    expect(imageGesture(null, "/doc.md")).toBeNull();
  });

  it("returns null for an untitled doc (no folder to anchor relative assets)", () => {
    expect(imageGesture(list, null)).toBeNull();
  });
});

describe("makeImagePasteHandlers", () => {
  // A view stub exposing only what the handlers read (selection.from + posAtCoords).
  const view = {
    state: { selection: { from: 7 } },
    posAtCoords: vi.fn(() => ({ pos: 12, inside: 11 })),
  } as never;

  it("handlePaste: intercepts an image paste — preventDefault, insert at the cursor, returns true", () => {
    const insert = vi.fn();
    const preventDefault = vi.fn();
    const { handlePaste } = makeImagePasteHandlers(() => "/doc.md", insert);
    const img = fakeFile("a.png", "image/png");
    const handled = handlePaste(view, { clipboardData: { files: fileList(img) }, preventDefault } as never);

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith(view, [img], "/doc.md", 7); // cursor position
  });

  it("handlePaste: ignores a non-image paste (returns false, no preventDefault) so text paste runs", () => {
    const insert = vi.fn();
    const preventDefault = vi.fn();
    const { handlePaste } = makeImagePasteHandlers(() => "/doc.md", insert);
    const handled = handlePaste(view, {
      clipboardData: { files: fileList(fakeFile("b.txt", "text/plain")) },
      preventDefault,
    } as never);

    expect(handled).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("handlePaste: ignores an image paste on an untitled doc (returns false)", () => {
    const insert = vi.fn();
    const { handlePaste } = makeImagePasteHandlers(() => null, insert);
    const handled = handlePaste(view, {
      clipboardData: { files: fileList(fakeFile("a.png", "image/png")) },
      preventDefault: vi.fn(),
    } as never);

    expect(handled).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("handleDrop: inserts at the drop coordinate (posAtCoords), returns true", () => {
    const insert = vi.fn();
    const preventDefault = vi.fn();
    const { handleDrop } = makeImagePasteHandlers(() => "/doc.md", insert);
    const img = fakeFile("a.png", "image/png");
    const handled = handleDrop(view, {
      dataTransfer: { files: fileList(img) },
      clientX: 100,
      clientY: 200,
      preventDefault,
    } as never);

    expect(handled).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(insert).toHaveBeenCalledWith(view, [img], "/doc.md", 12); // drop position from posAtCoords
  });

  it("handleDrop: falls back to the selection when posAtCoords yields nothing", () => {
    const insert = vi.fn();
    const noCoordView = { state: { selection: { from: 7 } }, posAtCoords: () => null } as never;
    const { handleDrop } = makeImagePasteHandlers(() => "/doc.md", insert);
    handleDrop(noCoordView, {
      dataTransfer: { files: fileList(fakeFile("a.png", "image/png")) },
      clientX: 0,
      clientY: 0,
      preventDefault: vi.fn(),
    } as never);

    expect(insert).toHaveBeenCalledWith(noCoordView, expect.any(Array), "/doc.md", 7);
  });

  it("handleDrop: ignores a non-image drop (returns false)", () => {
    const insert = vi.fn();
    const { handleDrop } = makeImagePasteHandlers(() => "/doc.md", insert);
    const handled = handleDrop(view, {
      dataTransfer: { files: fileList(fakeFile("doc.pdf", "application/pdf")) },
      preventDefault: vi.fn(),
    } as never);

    expect(handled).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });
});

describe("insertImages (integration — real ProseMirror schema/view)", () => {
  // A minimal commonmark-shaped schema with an inline `image` node (src/alt/title) like Crepe's.
  const schema = new Schema({
    nodes: {
      doc: { content: "block+" },
      paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
      text: { group: "inline" },
      image: {
        inline: true,
        group: "inline",
        attrs: { src: {}, alt: { default: "" }, title: { default: "" } },
        toDOM: (n) => ["img", { src: n.attrs.src as string }],
      },
    },
  });

  function makeView() {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, [schema.text("hello")])]);
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    return new EditorView(mount, { state: EditorState.create({ schema, doc }) });
  }

  function imageNodes(view: EditorView) {
    const out: { src: string; alt: string; title: string }[] = [];
    view.state.doc.descendants((n) => {
      if (n.type.name === "image") out.push(n.attrs as { src: string; alt: string; title: string });
    });
    return out;
  }

  it("writes the file and inserts an inline image node with the returned relative src", async () => {
    const view = makeView();
    await insertImages(view, [fakeFile("pic.png", "image/png")], "/Users/me/doc.md", 3);

    expect(saveAssetMock).toHaveBeenCalledWith("/Users/me/doc.md", "pic.png", expect.any(Uint8Array));
    expect(imageNodes(view)).toEqual([{ src: "assets/pic.png", alt: "", title: "" }]);
    // The busy cue is cleared once the write settles.
    expect(view.dom.classList.contains("nh-image-uploading")).toBe(false);
    view.destroy();
  });

  it("inserts multiple dropped images in order", async () => {
    const view = makeView();
    await insertImages(
      view,
      [fakeFile("a.png", "image/png"), fakeFile("b.png", "image/png")],
      "/Users/me/doc.md",
      3,
    );
    expect(imageNodes(view).map((n) => n.src)).toEqual(["assets/a.png", "assets/b.png"]);
    view.destroy();
  });

  it("clamps an out-of-range insertion position instead of throwing", async () => {
    const view = makeView();
    await expect(
      insertImages(view, [fakeFile("a.png", "image/png")], "/Users/me/doc.md", 9999),
    ).resolves.toBeUndefined();
    expect(imageNodes(view)).toHaveLength(1);
    view.destroy();
  });
});
