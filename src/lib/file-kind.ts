import type { FileKind } from "./types";

const MARKDOWN_EXT = /\.mdx?$/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|svg|webp|bmp|ico|avif)$/i;

/**
 * Decide how a path should be rendered. Markdown (`.md`/`.mdx`) routes through the existing
 * task/qa/plain views; known image extensions render inline; everything else opens as raw text
 * in Monaco. A `null` path is a brand-new untitled doc — treated as markdown.
 */
export function fileKindForPath(path: string | null): FileKind {
  if (!path) return "markdown";
  if (MARKDOWN_EXT.test(path)) return "markdown";
  if (IMAGE_EXT.test(path)) return "image";
  return "raw";
}

/**
 * Map a file path to a Monaco language id for syntax highlighting in the raw editor.
 * Falls back to `plaintext` for unknown extensions.
 */
export function languageForPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    md: "markdown",
    mdx: "markdown",
    rs: "rust",
    py: "python",
    go: "go",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    cc: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    sh: "shell",
    bash: "shell",
    zsh: "shell",
    yml: "yaml",
    yaml: "yaml",
    toml: "ini",
    ini: "ini",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    less: "less",
    sql: "sql",
    xml: "xml",
    svg: "xml",
    txt: "plaintext",
    log: "plaintext",
  };
  return map[ext] ?? "plaintext";
}
