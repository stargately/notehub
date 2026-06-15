/**
 * Custom code-fence language suffixes for the Milkdown Crepe code blocks.
 *
 * Out of the box Crepe's `CodeMirror` feature ships an **empty** `languages` list, so the code
 * block's language picker is a dead dropdown ("No result" for everything) with no way to type a
 * custom suffix. This module supplies two things:
 *
 * - `codeBlockLanguages` — the list fed to the feature's `languages` config: the full
 *   `@codemirror/language-data` catalogue (≈150 languages, lazily loaded for highlighting) plus
 *   diagram pseudo-languages (`mermaid`) that have no CodeMirror grammar but are valid fence
 *   suffixes NoteHub understands (a `mermaid` fence renders as a diagram after save/reload).
 * - `codeLanguageFreeTextPlugin` — a ProseMirror plugin (registered onto the Crepe editor like the
 *   image-paste plugin) that lets the user **type any suffix** into the picker's search box and
 *   commit it with Enter, so the language isn't limited to the listed choices.
 *
 * Together they turn the frozen dropdown into "search the known languages, or type your own".
 */
import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
} from "@codemirror/language";
import { languages as cmLanguages } from "@codemirror/language-data";
import { $prose } from "@milkdown/kit/utils";
import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";

/** A no-op CodeMirror grammar (one token spanning the line, unstyled) for suffixes we don't highlight. */
const plainTextMode = StreamLanguage.define({
  token: (stream) => {
    stream.skipToEnd();
    return null;
  },
});

/**
 * Diagram / non-code fence suffixes that have no CodeMirror grammar but are meaningful in NoteHub.
 * Listed so they're discoverable in the picker; the `load` resolves a no-op language so the loader
 * never throws and the source shows as plain text until it round-trips to a rendered diagram.
 */
const DIAGRAM_LANGUAGES: LanguageDescription[] = [
  LanguageDescription.of({
    name: "mermaid",
    alias: ["mermaid", "mmd"],
    load: async () => new LanguageSupport(plainTextMode),
  }),
];

/** The `languages` list for Crepe's `CodeMirror` feature config — known languages + diagram suffixes. */
export const codeBlockLanguages: LanguageDescription[] = [
  ...DIAGRAM_LANGUAGES,
  ...cmLanguages,
];

/**
 * Decide whether an Enter keypress is a "commit a custom language" gesture in a code block's
 * language picker. Returns the enclosing `.milkdown-code-block` element and the trimmed text typed
 * in the picker's search box, or `null` when the event isn't Enter in a picker search input (so the
 * caller leaves the keypress alone). Pure over the DOM → jsdom-testable; the caller maps `blockEl`
 * to a ProseMirror position and dispatches.
 */
export function pickerCommit(
  e: Pick<KeyboardEvent, "key" | "isComposing" | "target">,
): { blockEl: HTMLElement; value: string } | null {
  if (e.key !== "Enter" || e.isComposing) return null;
  const target = e.target;
  if (!(target instanceof HTMLInputElement)) return null;
  if (!target.matches(".language-picker .search-input")) return null;
  const blockEl = target.closest<HTMLElement>(".milkdown-code-block");
  if (!blockEl) return null;
  return { blockEl, value: target.value.trim() };
}

/**
 * Find the document position of the `code_block` node whose node-view DOM is `blockEl`. The picker
 * lives inside the node view, so this maps a picker DOM element back to its node by comparing
 * `view.nodeDOM(pos)` (the node view's outer element) — robust regardless of where the block sits.
 */
export function findCodeBlockPos(view: EditorView, blockEl: HTMLElement): number | null {
  let result: number | null = null;
  view.state.doc.descendants((node, pos) => {
    if (result != null) return false;
    if (node.type.name === "code_block" && view.nodeDOM(pos) === blockEl) {
      result = pos;
      return false;
    }
    return undefined;
  });
  return result;
}

/**
 * Set the `language` attribute of the code block whose node-view DOM is `blockEl` to `value`.
 * Returns false (and dispatches nothing) when the block can't be located. Exported for the
 * integration test; production goes through the plugin below.
 */
export function commitCodeLanguage(view: EditorView, blockEl: HTMLElement, value: string): boolean {
  const pos = findCodeBlockPos(view, blockEl);
  if (pos == null) return false;
  view.dispatch(view.state.tr.setNodeAttribute(pos, "language", value));
  return true;
}

/** Close an open language picker via its own toggle button (no fighting Vue's internal open state). */
function closePicker(blockEl: HTMLElement): void {
  blockEl.querySelector<HTMLElement>(".language-button")?.click();
}

/**
 * Attach the picker Enter-to-commit handler to an editor view, returning a disposer. The listener
 * runs in the **capture phase** on the editor DOM: the code-block node view's `stopEvent` keeps
 * events that originate inside it out of ProseMirror's own keydown handling, so a bubble-phase /
 * `handleDOMEvents` hook would never see the search input's Enter. Exported for the integration test.
 */
export function installPickerKeydown(editorView: EditorView): () => void {
  const onKeydown = (e: KeyboardEvent) => {
    const hit = pickerCommit(e);
    if (!hit || !hit.value) return;
    if (!commitCodeLanguage(editorView, hit.blockEl, hit.value)) return;
    e.preventDefault();
    e.stopPropagation();
    closePicker(hit.blockEl);
  };
  editorView.dom.addEventListener("keydown", onKeydown, true);
  return () => editorView.dom.removeEventListener("keydown", onKeydown, true);
}

/**
 * A Milkdown plugin (wrap via `crepe.editor.use(codeLanguageFreeTextPlugin())`) that lets the user
 * type a custom language suffix into a code block's picker and commit it with Enter — covering
 * `mermaid` and any suffix not in `codeBlockLanguages`. The picker only ever lets you *pick* from
 * the list; this adds the free-text path. See `installPickerKeydown` for the event wiring.
 */
export function codeLanguageFreeTextPlugin() {
  return $prose(
    () =>
      new Plugin({
        view: (editorView) => ({ destroy: installPickerKeydown(editorView) }),
      }),
  );
}
