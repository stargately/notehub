import { $view } from "@milkdown/kit/utils";
import { diagramSchema } from "@milkdown/plugin-diagram";
import mermaid from "mermaid";

// Unique id per render — mermaid.render injects a temp element keyed by this id.
let idCounter = 0;

/**
 * A ProseMirror node view for the `diagram` node added by @milkdown/plugin-diagram.
 * The plugin parses ```mermaid fences into a `diagram` node (and serializes them back),
 * but ships no renderer — this view draws the mermaid SVG.
 *
 * Clicking the diagram reveals a source editor above it; edits live-preview and, on blur,
 * commit back to the node's `value` attribute (which round-trips to the ```mermaid fence).
 */
export function mermaidNodeView(darkMode: boolean) {
  return $view(diagramSchema.node, () => (initialNode, view, getPos) => {
    const dom = document.createElement("div");
    dom.className = "milkdown-mermaid";
    dom.setAttribute("contenteditable", "false");

    // Source editor (hidden until the diagram is clicked).
    const editorWrap = document.createElement("div");
    editorWrap.className = "milkdown-mermaid-editor";
    const textarea = document.createElement("textarea");
    textarea.className = "milkdown-mermaid-source";
    textarea.spellcheck = false;
    editorWrap.appendChild(textarea);

    // Rendered diagram.
    const preview = document.createElement("div");
    preview.className = "milkdown-mermaid-preview";

    dom.appendChild(editorWrap);
    dom.appendChild(preview);

    let code = (initialNode.attrs.value as string) ?? "";
    let editing = false;

    const renderPreview = async (src: string) => {
      const trimmed = src.trim();
      if (!trimmed) {
        preview.innerHTML = `<span class="milkdown-mermaid-empty">Empty diagram — click to edit</span>`;
        return;
      }
      // Re-init each render so the theme tracks light/dark mode (mermaid is a singleton).
      mermaid.initialize({
        startOnLoad: false,
        theme: darkMode ? "dark" : "default",
        securityLevel: "loose",
      });
      try {
        const { svg } = await mermaid.render(`milkdown-mermaid-${idCounter++}`, trimmed);
        preview.innerHTML = svg;
      } catch {
        // Invalid mermaid — show the raw source so nothing is lost.
        const pre = document.createElement("pre");
        pre.className = "milkdown-mermaid-error";
        pre.textContent = trimmed;
        preview.replaceChildren(pre);
      }
    };

    // Grow the textarea to fit all of its content (no inner scrollbar).
    const autosize = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    const setEditing = (on: boolean) => {
      editing = on;
      dom.classList.toggle("is-editing", on);
      if (on) {
        textarea.value = code;
        // Size + focus after the element is visible and laid out.
        requestAnimationFrame(() => {
          autosize();
          textarea.focus();
        });
      }
    };

    const commit = (next: string) => {
      if (next === code || typeof getPos !== "function") return;
      const pos = getPos();
      if (pos == null) return;
      const node = view.state.doc.nodeAt(pos);
      if (!node) return;
      view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, value: next }));
    };

    preview.addEventListener("click", () => {
      if (!editing) setEditing(true);
    });
    textarea.addEventListener("input", () => {
      autosize();
      void renderPreview(textarea.value);
    });
    textarea.addEventListener("blur", () => {
      commit(textarea.value);
      setEditing(false);
    });
    textarea.addEventListener("keydown", (e) => {
      // Esc cancels (reverts to the committed source); Cmd/Ctrl+Enter confirms.
      if (e.key === "Escape" || ((e.metaKey || e.ctrlKey) && e.key === "Enter")) {
        e.preventDefault();
        if (e.key === "Escape") textarea.value = code;
        textarea.blur();
      }
    });

    void renderPreview(code);

    return {
      dom,
      ignoreMutation: () => true,
      // Let the textarea handle its own events; ProseMirror handles everything else.
      stopEvent: (e: Event) => editorWrap.contains(e.target as Node),
      update: (updatedNode) => {
        if (updatedNode.type.name !== "diagram") return false;
        const next = (updatedNode.attrs.value as string) ?? "";
        if (next !== code) {
          code = next;
          if (!editing) void renderPreview(next);
        }
        return true;
      },
      destroy: () => preview.replaceChildren(),
    };
  });
}
