import { describe, it, expect, beforeEach } from "vitest";

import { Schema } from "@milkdown/kit/prose/model";
import { EditorState } from "@milkdown/kit/prose/state";
import { EditorView } from "@milkdown/kit/prose/view";
import type { NodeViewConstructor } from "@milkdown/kit/prose/view";

import {
  codeBlockLanguages,
  pickerCommit,
  findCodeBlockPos,
  commitCodeLanguage,
  installPickerKeydown,
} from "../milkdown-code-language";

describe("codeBlockLanguages", () => {
  it("includes the mermaid diagram suffix (front of the list, for discoverability)", () => {
    const names = codeBlockLanguages.map((l) => l.name.toLowerCase());
    expect(names).toContain("mermaid");
  });

  it("includes the known-language catalogue (so the picker isn't empty)", () => {
    const names = codeBlockLanguages.map((l) => l.name.toLowerCase());
    // A few staples from @codemirror/language-data.
    expect(names).toEqual(expect.arrayContaining(["javascript", "python", "rust", "json"]));
    expect(codeBlockLanguages.length).toBeGreaterThan(50);
  });

  it("loads the no-op grammar for mermaid without throwing (it has no real CodeMirror mode)", async () => {
    const mermaid = codeBlockLanguages.find((l) => l.name.toLowerCase() === "mermaid");
    expect(mermaid).toBeDefined();
    await expect(mermaid!.load()).resolves.toBeDefined();
  });
});

describe("pickerCommit", () => {
  function pickerDom(value: string): HTMLInputElement {
    const block = document.createElement("div");
    block.className = "milkdown-code-block";
    const picker = document.createElement("div");
    picker.className = "language-picker";
    const input = document.createElement("input");
    input.className = "search-input";
    input.value = value;
    picker.appendChild(input);
    block.appendChild(picker);
    document.body.appendChild(block);
    return input;
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("returns the enclosing block and the trimmed typed value on Enter in the search input", () => {
    const input = pickerDom("  mermaid  ");
    const hit = pickerCommit({ key: "Enter", isComposing: false, target: input });
    expect(hit?.blockEl).toBe(input.closest(".milkdown-code-block"));
    expect(hit?.value).toBe("mermaid");
  });

  it("ignores non-Enter keys", () => {
    const input = pickerDom("rust");
    expect(pickerCommit({ key: "a", isComposing: false, target: input })).toBeNull();
  });

  it("ignores Enter while composing an IME sequence", () => {
    const input = pickerDom("中文");
    expect(pickerCommit({ key: "Enter", isComposing: true, target: input })).toBeNull();
  });

  it("ignores targets that aren't the picker search input", () => {
    const div = document.createElement("div");
    document.body.appendChild(div);
    expect(pickerCommit({ key: "Enter", isComposing: false, target: div })).toBeNull();
  });

  it("ignores a .search-input that isn't inside a .language-picker", () => {
    const input = document.createElement("input");
    input.className = "search-input"; // bare input, no picker ancestor
    document.body.appendChild(input);
    expect(pickerCommit({ key: "Enter", isComposing: false, target: input })).toBeNull();
  });

  it("returns null when the picker isn't inside a code block", () => {
    const picker = document.createElement("div");
    picker.className = "language-picker";
    const input = document.createElement("input");
    input.className = "search-input";
    input.value = "go";
    picker.appendChild(input);
    document.body.appendChild(picker); // no .milkdown-code-block wrapper
    expect(pickerCommit({ key: "Enter", isComposing: false, target: input })).toBeNull();
  });
});

// A commonmark-shaped schema with a `code_block` node whose node view mimics Crepe's DOM
// (`.milkdown-code-block` wrapper holding the language button + picker search input).
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    text: { group: "inline" },
    code_block: {
      group: "block",
      content: "text*",
      marks: "",
      code: true,
      defining: true,
      attrs: { language: { default: "" } },
      toDOM: () => ["pre", ["code", 0]],
    },
  },
});

const codeBlockNodeView: NodeViewConstructor = () => {
  const dom = document.createElement("div");
  dom.className = "milkdown-code-block";
  const button = document.createElement("button");
  button.className = "language-button";
  const picker = document.createElement("div");
  picker.className = "language-picker";
  const input = document.createElement("input");
  input.className = "search-input";
  picker.appendChild(input);
  dom.append(button, picker);
  // No contentDOM → a self-managed node view (like Crepe's CodeMirror block); ignore inner mutations.
  return { dom, ignoreMutation: () => true, stopEvent: () => true };
};

function makeView(language = "") {
  const doc = schema.node("doc", null, [
    schema.node("code_block", { language }, [schema.text("graph TD;A-->B")]),
  ]);
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  return new EditorView(mount, {
    state: EditorState.create({ schema, doc }),
    nodeViews: { code_block: codeBlockNodeView },
  });
}

function searchInput(view: EditorView): HTMLInputElement {
  return view.dom.querySelector<HTMLInputElement>(".language-picker .search-input")!;
}

function codeBlockLanguageAttr(view: EditorView): string {
  return view.state.doc.firstChild!.attrs.language as string;
}

describe("findCodeBlockPos / commitCodeLanguage (real ProseMirror view)", () => {
  it("maps the picker DOM back to its code-block node position", () => {
    const view = makeView();
    const blockEl = view.dom.querySelector<HTMLElement>(".milkdown-code-block")!;
    const pos = findCodeBlockPos(view, blockEl);
    expect(pos).not.toBeNull();
    expect(view.nodeDOM(pos!)).toBe(blockEl);
    view.destroy();
  });

  it("sets the code block's language attribute to a custom suffix", () => {
    const view = makeView();
    const blockEl = view.dom.querySelector<HTMLElement>(".milkdown-code-block")!;
    expect(commitCodeLanguage(view, blockEl, "mermaid")).toBe(true);
    expect(codeBlockLanguageAttr(view)).toBe("mermaid");
    view.destroy();
  });

  it("returns false (and dispatches nothing) for an element that isn't a known code block", () => {
    const view = makeView("rust");
    const detached = document.createElement("div");
    detached.className = "milkdown-code-block";
    expect(commitCodeLanguage(view, detached, "go")).toBe(false);
    expect(codeBlockLanguageAttr(view)).toBe("rust"); // unchanged
    view.destroy();
  });
});

describe("installPickerKeydown (capture-phase Enter → commit)", () => {
  it("commits the typed language on Enter and closes the picker", () => {
    const view = makeView();
    const dispose = installPickerKeydown(view);

    const input = searchInput(view);
    let pickerClosed = false;
    view.dom.querySelector(".language-button")!.addEventListener("click", () => (pickerClosed = true));

    input.value = "mermaid";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    expect(codeBlockLanguageAttr(view)).toBe("mermaid");
    expect(pickerClosed).toBe(true); // closed via its own toggle button
    dispose();
    view.destroy();
  });

  it("leaves an empty search box alone (Enter doesn't clear the language)", () => {
    const view = makeView("rust");
    const dispose = installPickerKeydown(view);

    const input = searchInput(view);
    input.value = "   ";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    expect(codeBlockLanguageAttr(view)).toBe("rust"); // unchanged
    dispose();
    view.destroy();
  });

  it("stops firing once disposed", () => {
    const view = makeView("rust");
    const dispose = installPickerKeydown(view);
    dispose();

    const input = searchInput(view);
    input.value = "go";
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));

    expect(codeBlockLanguageAttr(view)).toBe("rust"); // listener removed → no commit
    view.destroy();
  });
});
