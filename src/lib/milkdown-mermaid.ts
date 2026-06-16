import { $view } from "@milkdown/kit/utils";
import { diagramSchema } from "@milkdown/plugin-diagram";
import mermaid from "mermaid";

// Unique id per render — mermaid.render injects a temp element keyed by this id.
let idCounter = 0;

/**
 * Remove the temporary DOM nodes `mermaid.render` appends to `document.body` for a given render id:
 * the svg (`#id`), its wrapper div (`#d{id}`), and the sandbox iframe (`#i{id}`). On success mermaid
 * removes these itself, but on a draw error it re-throws *before* the cleanup, leaving them behind —
 * which is how a bad diagram leaks its "Syntax error in text" graphic to the bottom of the page.
 */
export function removeMermaidArtifacts(renderId: string): void {
  for (const id of [renderId, `d${renderId}`, `i${renderId}`]) {
    document.getElementById(id)?.remove();
  }
}

/** The mermaid surface this module needs — narrowed so tests can inject a stub. */
type MermaidLike = Pick<typeof mermaid, "parse" | "render">;

/**
 * Render a mermaid diagram to an SVG string, or report failure — **without ever leaking mermaid's
 * error graphic into the document**. `mermaid.render()` draws a "Syntax error in text" bomb into a
 * `document.body` node and re-throws without cleaning it up, so calling it on an invalid diagram
 * (e.g. every keystroke while editing) piles those nodes at the bottom of the page. So we validate
 * with `mermaid.parse()` first — it only parses (touches no DOM) and returns `false` on bad syntax —
 * and only `render()` when valid. The rare "parses but draw throws" case is swept up by id.
 */
export async function renderMermaid(
  m: MermaidLike,
  renderId: string,
  src: string,
): Promise<{ ok: true; svg: string } | { ok: false }> {
  let valid = false;
  try {
    valid = (await m.parse(src, { suppressErrors: true })) === true;
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false };
  try {
    const { svg } = await m.render(renderId, src);
    return { ok: true, svg };
  } catch {
    removeMermaidArtifacts(renderId);
    return { ok: false };
  }
}

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
      // A fresh id per render keeps concurrent renders (fast typing) from clobbering each other's
      // temp nodes. renderMermaid validates before rendering, so an invalid diagram never injects
      // mermaid's error graphic into the page.
      const result = await renderMermaid(mermaid, `milkdown-mermaid-${idCounter++}`, trimmed);
      if (result.ok) {
        preview.innerHTML = result.svg;
      } else {
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
