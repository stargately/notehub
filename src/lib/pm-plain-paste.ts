/**
 * Cmd+Shift+V — "paste as plain text" (Typora-style) for the ProseMirror-based editors: the
 * Milkdown Crepe cells in `QaLayout` and the Tiptap task-description drawer. The app keymap
 * dispatches the action from a window `keydown`, where the native `ClipboardEvent` isn't
 * available — so we read the clipboard asynchronously and insert the text programmatically.
 *
 * "Plain" means a programmatic `tr.insertText`, which — unlike typing or `document.execCommand` —
 * does **not** run ProseMirror input rules. So pasting `# foo` inserts the literal characters
 * `# foo`, never a heading (matches Typora's "Paste as Plain Text"). Reading the clipboard's
 * `text/plain` also drops any rich marks/nodes from the source.
 *
 * Each mounted editor registers its live view here. The single keymap handler targets whichever
 * registered editor currently holds focus, so `QaLayout`'s many mount-once cells route correctly
 * (the handler is registered once per active view, not once per cell).
 */

/**
 * Minimal structural shape of a ProseMirror `EditorView`. Milkdown and Tiptap each bundle their
 * own copy of `prosemirror-view`, so a nominal import would type-mismatch one of them — but both
 * satisfy this. Only the members we touch are declared.
 */
export interface PmInsertView {
  readonly dom: HTMLElement;
  readonly state: { readonly tr: PmInsertTr };
  dispatch(tr: PmInsertTr): void;
}
interface PmInsertTr {
  insertText(text: string): PmInsertTr;
  scrollIntoView(): PmInsertTr;
}

const registered = new Set<PmInsertView>();

/** Register a mounted editor view; returns an unregister fn (call on unmount/destroy). */
export function registerPmView(view: PmInsertView): () => void {
  registered.add(view);
  return () => {
    registered.delete(view);
  };
}

/** The registered view whose contenteditable currently holds focus, or null. */
export function findFocusedView(): PmInsertView | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!active) return null;
  for (const view of registered) {
    if (view.dom === active || view.dom.contains(active)) return view;
  }
  return null;
}

/**
 * Insert `text` as literal plain text at the view's cursor (replacing any selection). Uses a
 * programmatic transaction, so input rules don't fire and the text stays uninterpreted.
 */
export function insertPlainTextIntoView(view: PmInsertView, text: string): void {
  view.dispatch(view.state.tr.insertText(text).scrollIntoView());
}

/** Default clipboard reader — `navigator.clipboard.readText()`, or "" when unavailable. */
async function defaultReadText(): Promise<string> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.readText) return "";
  return navigator.clipboard.readText();
}

/**
 * Handle the Cmd+Shift+V gesture: capture the focused editor **synchronously** (before the async
 * clipboard read can move focus), read the clipboard's plain text, and insert it. Returns the
 * inserted text, or null when there was no focused editor / nothing to paste / the read failed.
 * The clipboard reader is injectable for tests.
 */
export async function pasteAsPlainText(
  readText: () => Promise<string> = defaultReadText,
): Promise<string | null> {
  const view = findFocusedView(); // capture now — the await below mustn't pick a different view
  if (!view) return null;
  let text = "";
  try {
    text = await readText();
  } catch {
    return null; // clipboard permission denied / unavailable — fail gracefully
  }
  if (!text) return null;
  insertPlainTextIntoView(view, text);
  return text;
}
