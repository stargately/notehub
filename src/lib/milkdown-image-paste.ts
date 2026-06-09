/**
 * Image paste / drag-drop → save-to-disk for the Milkdown Crepe editors.
 *
 * Crepe's built-in `ImageBlock` only handles the upload-button + "paste link" URL flow — it does
 * NOT intercept a real `Cmd+V`/drag-drop of an image file (verified: no `handlePaste`/`handleDrop`
 * in `@milkdown/crepe`/`@milkdown/components`). So this module supplies:
 *
 * - `proxyImageUrl` — Crepe's `proxyDomURL`: rewrites a relative/absolute markdown `src` into an
 *   asset URL the webview can load, **for display only** (the serialized `node.attrs.src` stays
 *   relative → portable markdown). See `image-assets.resolveImageSrc`.
 * - `uploadImage` — Crepe's `onUpload` (upload-button / paste-link image): writes the file to disk
 *   via `save_asset` and returns the **relative** path Crepe stores as the image `src`.
 * - `imagePastePlugin` — a ProseMirror plugin (registered onto the Crepe editor like the mermaid
 *   node view) whose `handlePaste`/`handleDrop` write pasted/dropped image files to disk and insert
 *   a relative `![](assets/…)` image node at the cursor / drop point.
 *
 * The doc path is read **lazily** (`getDocPath()`/passed per call) so a tab rename doesn't strand a
 * stale closure — the editor is mount-once and reads its config at creation.
 */
import { $prose } from "@milkdown/kit/utils";
import { Plugin, Selection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { resolveImageSrc, isImageFile, assetFileName } from "./image-assets";
import { toAssetUrl, saveAsset } from "./tauri-api";

/** A class toggled on the editor DOM while an image write is in flight (CSS shows a busy cue). */
const UPLOADING_CLASS = "nh-image-uploading";

/**
 * Resolve a markdown image `src` to a URL the webview can render. Relative/absolute filesystem
 * paths become asset URLs; real URLs pass through unchanged. Async because `convertFileSrc` lives
 * behind a lazy import — Crepe's `proxyDomURL` accepts a Promise.
 */
export async function proxyImageUrl(src: string, docPath: string | null): Promise<string> {
  const resolved = resolveImageSrc(src, docPath);
  if (!resolved) return src; // can't resolve (untitled doc + relative src) — render as-is
  if ("passthrough" in resolved) return resolved.passthrough;
  return toAssetUrl(resolved.filePath);
}

/**
 * Crepe `onUpload` handler (upload button / paste-link image): persist the file next to the doc and
 * return the **relative** path Crepe will store as the image `src`. For an untitled doc (no
 * directory) there's nowhere portable to write, so fall back to a transient `blob:` URL (Crepe's
 * default behavior) rather than failing the upload.
 */
export async function uploadImage(file: File, docPath: string | null): Promise<string> {
  if (!docPath) return URL.createObjectURL(file);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return saveAsset(docPath, assetFileName(file), bytes);
}

/** The image files in a FileList (paste/drop payload), or [] when there are none. */
export function imageFilesFrom(list: FileList | null | undefined): File[] {
  return list ? Array.from(list).filter(isImageFile) : [];
}

/**
 * Decide whether a paste/drop gesture is an image-insertion we should intercept. Returns the image
 * files + the (non-null) doc path to anchor them when we should handle it (the caller then
 * `preventDefault`s and inserts), or `null` to let default handling run — when there are no image
 * files, or the doc is untitled (no folder to place relative assets in). Pure → unit-tested.
 */
export function imageGesture(
  list: FileList | null | undefined,
  docPath: string | null,
): { files: File[]; docPath: string } | null {
  const files = imageFilesFrom(list);
  if (!files.length || !docPath) return null;
  return { files, docPath };
}

/**
 * Write each image file to disk and insert a relative `![](assets/…)` inline image node, starting
 * at `at`. Sequential (await per file) so two same-named files de-dup on disk instead of racing.
 * Exported for the integration test (real PM schema/view); production callers go via the plugin.
 */
export async function insertImages(
  view: EditorView,
  files: File[],
  docPath: string,
  at: number,
): Promise<void> {
  const imageType = view.state.schema.nodes.image;
  if (!imageType) return;

  // Move the cursor to the insertion point (drop position, or the original selection for paste).
  // `Selection.near` snaps to the nearest valid selection, so an arbitrary drop coordinate that
  // resolves to a non-text position (e.g. between blocks) is handled safely.
  const docSize = view.state.doc.content.size;
  const $pos = view.state.doc.resolve(Math.min(Math.max(at, 0), docSize));
  view.dispatch(view.state.tr.setSelection(Selection.near($pos)));

  view.dom.classList.add(UPLOADING_CLASS);
  try {
    for (const file of files) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const rel = await saveAsset(docPath, assetFileName(file), bytes);
        const node = imageType.create({ src: rel, alt: "", title: "" });
        // replaceSelectionWith inserts the inline image at the cursor and leaves the selection
        // after it, so multiple files stack in order.
        view.dispatch(view.state.tr.replaceSelectionWith(node, false).scrollIntoView());
      } catch (err) {
        console.error("NoteHub: failed to save pasted image", err);
      }
    }
  } finally {
    view.dom.classList.remove(UPLOADING_CLASS);
  }
}

/** How images get written + inserted; injectable so the handlers test without a real PM view. */
type InsertFn = (view: EditorView, files: File[], docPath: string, at: number) => void;

const defaultInsert: InsertFn = (view, files, docPath, at) => {
  void insertImages(view, files, docPath, at);
};

/**
 * The `handlePaste`/`handleDrop` props for the image plugin. Returns `false` (default handling runs)
 * unless the gesture carries image files and the doc is saved — then it `preventDefault`s and
 * inserts at the cursor (paste) / drop coordinate (drop). Returning `false` for non-image pastes is
 * what lets it compose with the `Cmd+Shift+V` plain-paste handler (which reads clipboard *text*).
 * `getDocPath` is read per gesture so a rename never strands a stale path; `insert` is injectable.
 */
export function makeImagePasteHandlers(getDocPath: () => string | null, insert: InsertFn = defaultInsert) {
  return {
    handlePaste: (view: EditorView, event: ClipboardEvent): boolean => {
      const gesture = imageGesture(event.clipboardData?.files, getDocPath());
      if (!gesture) return false;
      event.preventDefault();
      insert(view, gesture.files, gesture.docPath, view.state.selection.from);
      return true;
    },
    handleDrop: (view: EditorView, event: DragEvent): boolean => {
      const gesture = imageGesture(event.dataTransfer?.files, getDocPath());
      if (!gesture) return false;
      event.preventDefault();
      const at =
        view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos ??
        view.state.selection.from;
      insert(view, gesture.files, gesture.docPath, at);
      return true;
    },
  };
}

/**
 * A Milkdown plugin (wrap via `crepe.editor.use(imagePastePlugin(...))`) that intercepts paste &
 * drop of image files: it writes them to disk and inserts relative `![](assets/…)` links. See
 * `makeImagePasteHandlers` for the decision logic. Untitled docs (null path) fall through to
 * default handling (relative assets need a doc dir).
 */
export function imagePastePlugin(getDocPath: () => string | null) {
  return $prose(() => new Plugin({ props: makeImagePasteHandlers(getDocPath) }));
}
