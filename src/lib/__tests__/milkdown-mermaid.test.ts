import { describe, it, expect, vi, beforeEach } from "vitest";

import { removeMermaidArtifacts, renderMermaid } from "../milkdown-mermaid";

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("removeMermaidArtifacts", () => {
  function addNode(id: string) {
    const el = document.createElement("div");
    el.id = id;
    document.body.appendChild(el);
  }

  it("removes mermaid's temp nodes for a render id (svg #id, div #d{id}, iframe #i{id})", () => {
    addNode("mmd-7");
    addNode("dmmd-7");
    addNode("immd-7");
    addNode("unrelated");

    removeMermaidArtifacts("mmd-7");

    expect(document.getElementById("mmd-7")).toBeNull();
    expect(document.getElementById("dmmd-7")).toBeNull();
    expect(document.getElementById("immd-7")).toBeNull();
    // Leaves other nodes (and other render ids) untouched.
    expect(document.getElementById("unrelated")).not.toBeNull();
  });

  it("is a no-op when the nodes are absent", () => {
    expect(() => removeMermaidArtifacts("missing")).not.toThrow();
    expect(document.body.children).toHaveLength(0);
  });
});

describe("renderMermaid", () => {
  it("renders valid syntax and returns the svg", async () => {
    const m = {
      parse: vi.fn(async () => true),
      render: vi.fn(async () => ({ svg: "<svg>ok</svg>" })),
    } as never;

    const result = await renderMermaid(m, "mmd-1", "graph TD; A-->B");

    expect(result).toEqual({ ok: true, svg: "<svg>ok</svg>" });
    expect((m as { parse: ReturnType<typeof vi.fn> }).parse).toHaveBeenCalledWith("graph TD; A-->B", {
      suppressErrors: true,
    });
  });

  it("does NOT call render when parse reports invalid syntax (no error graphic gets injected)", async () => {
    const render = vi.fn();
    const m = { parse: vi.fn(async () => false), render } as never;

    const result = await renderMermaid(m, "mmd-2", "not a diagram {{{");

    expect(result).toEqual({ ok: false });
    expect(render).not.toHaveBeenCalled();
  });

  it("treats a throwing parse as invalid and skips render", async () => {
    const render = vi.fn();
    const m = {
      parse: vi.fn(async () => {
        throw new Error("boom");
      }),
      render,
    } as never;

    const result = await renderMermaid(m, "mmd-3", "???");

    expect(result).toEqual({ ok: false });
    expect(render).not.toHaveBeenCalled();
  });

  it("cleans up the temp node when parse passes but render throws", async () => {
    // Simulate mermaid leaving its wrapper div behind on a draw error.
    const leftover = document.createElement("div");
    leftover.id = "dmmd-4";
    document.body.appendChild(leftover);

    const m = {
      parse: vi.fn(async () => true),
      render: vi.fn(async () => {
        throw new Error("draw failed");
      }),
    } as never;

    const result = await renderMermaid(m, "mmd-4", "graph TD; A-->B");

    expect(result).toEqual({ ok: false });
    expect(document.getElementById("dmmd-4")).toBeNull(); // swept up, not left at page bottom
  });
});
