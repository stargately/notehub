/**
 * Pure helpers for the image paste / drag-drop-to-disk feature (see
 * `src/lib/milkdown-image-paste.ts` for the Tauri-bound glue). Kept dependency-free so they
 * unit-test without Tauri / a DOM.
 *
 * The display side (`resolveImageSrc`) decides how a markdown `![](src)` resolves for the WYSIWYG
 * view: an absolute URL passes through, a filesystem path is turned into an asset URL, and a
 * **relative** path resolves against the doc's own directory — which is what keeps saved markdown
 * portable (the src stays relative; only the rendered `src` is rewritten via Crepe's `proxyDomURL`).
 * The save side (`assetFileName`/`isImageFile`/`extForMime`) names a pasted/dropped image.
 */

// A leading URL scheme: http:, https:, data:, blob:, asset:, file:, mailto:, … (RFC 3986 shape).
const SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

/** The directory portion of a `/`-separated path (everything before the last `/`), or "" if none. */
export function dirOf(filePath: string): string {
  const i = filePath.lastIndexOf("/");
  return i < 0 ? "" : filePath.slice(0, i);
}

/**
 * Join `dir` + a relative path, resolving `.`/`..`/empty segments (POSIX-style, pure string math).
 * The result keeps a leading `/` when `dir` is absolute. `rel` is assumed relative (callers route
 * absolute srcs elsewhere).
 */
export function joinPath(dir: string, rel: string): string {
  const absolute = dir.startsWith("/");
  const out: string[] = [];
  for (const seg of `${dir}/${rel}`.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return (absolute ? "/" : "") + out.join("/");
}

/** How a markdown image `src` should be displayed: an as-is URL, or a filesystem path to proxy. */
export type ResolvedImage = { passthrough: string } | { filePath: string };

/**
 * Resolve a markdown image `src` for display in the WYSIWYG editor:
 * - a URL with a scheme (http/https/data/blob/asset/file) or protocol-relative `//…` → passthrough
 * - an absolute filesystem path (`/…`) → proxy that file
 * - a relative path → proxy it resolved against `docPath`'s directory
 * Returns `null` when a relative path can't be resolved (untitled doc with no directory).
 */
export function resolveImageSrc(src: string, docPath: string | null): ResolvedImage | null {
  const url = src.trim();
  if (!url) return null;
  if (SCHEME_RE.test(url) || url.startsWith("//")) return { passthrough: url };
  if (url.startsWith("/")) return { filePath: url };
  if (!docPath) return null; // relative src but no doc dir to resolve against
  return { filePath: joinPath(dirOf(docPath), url) };
}

// Image MIME type → file extension (no dot). Clipboard images carry a MIME type but often no name.
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/avif": "avif",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

/** Extension (no dot) for an image MIME type, or "" if unknown. */
export function extForMime(mime: string): string {
  return MIME_EXT[mime.toLowerCase()] ?? "";
}

/** Whether a File/clipboard item is an image (has an `image/*` MIME type). */
export function isImageFile(file: { type?: string }): boolean {
  return !!file.type && file.type.startsWith("image/");
}

/**
 * Pick a file name for a pasted/dropped image. A dragged file keeps its own name; a clipboard image
 * (usually nameless) gets a synthesized `pasted-image.<ext>` derived from its MIME type. The backend
 * de-duplicates on disk, so a repeated `pasted-image.png` becomes `pasted-image-1.png` etc.
 */
export function assetFileName(file: { name?: string; type?: string }): string {
  const name = (file.name ?? "").trim();
  if (name) return name;
  const ext = extForMime(file.type ?? "") || "png";
  return `pasted-image.${ext}`;
}
