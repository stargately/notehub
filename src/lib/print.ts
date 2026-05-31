import { marked } from "marked";
import mermaid from "mermaid";
import { isTauri, printHtml } from "./tauri-api";
import { splitFrontmatter, parseQaBlocks } from "./qa-parser";

// WKWebView (Tauri's webview on macOS) does not implement window.print(), so we can't
// print the live view there. Instead we render the QA markdown to a clean, self-contained
// HTML document (compact cheatsheet layout, light-theme mermaid) and open it in the default
// browser, which prints with full fidelity. In plain-browser mode we open a print window.

let printMermaidId = 0;

function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => (c === "&" ? "&amp;" : c === "<" ? "&lt;" : "&gt;"));
}

/** Render one markdown segment to HTML, replacing ```mermaid fences with rendered SVG. */
async function segmentToHtml(md: string): Promise<string> {
  const fenceRe = /```mermaid[^\n]*\n([\s\S]*?)```/g;
  let html = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(md)) !== null) {
    if (m.index > last) html += await marked.parse(md.slice(last, m.index));
    const code = m[1].trim();
    try {
      const { svg } = await mermaid.render(`print-mmd-${printMermaidId++}`, code);
      html += `<div class="diagram">${svg}</div>`;
    } catch {
      html += `<pre class="diagram-error">${escapeHtml(code)}</pre>`;
    }
    last = fenceRe.lastIndex;
  }
  if (last < md.length) html += await marked.parse(md.slice(last));
  return html;
}

const PRINT_CSS = `
  @page { size: letter; margin: 0.4in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 8.5px;
    line-height: 1.25;
  }
  .p-header { padding: 6px 8px; border-bottom: 2px solid #000; }
  .p-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr);
    border-bottom: 1px solid #999;
  }
  .p-col { padding: 6px 8px; min-width: 0; }
  .p-left { background: #f2f2f2; border-right: 1px solid #999; }
  h1 { font-size: 13px; }
  h2 { font-size: 11px; }
  h3 { font-size: 9.5px; }
  h4, h5, h6 { font-size: 9px; }
  h1, h2, h3, h4, h5, h6 { margin: 0.3em 0 0.12em; line-height: 1.15; }
  p, li { margin: 0.1em 0; }
  ul, ol { margin: 0.12em 0; padding-left: 1.1em; }
  pre, code { font-family: "SF Mono", ui-monospace, Menlo, monospace; font-size: 7.5px; }
  pre { background: #f4f4f4; padding: 4px 6px; border-radius: 3px; overflow-x: auto; white-space: pre-wrap; }
  code { background: #f0f0f0; padding: 0 2px; border-radius: 2px; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; font-size: 7.5px; margin: 0.2em 0; }
  th, td { border: 1px solid #bbb; padding: 1px 4px; text-align: left; }
  th { background: #eaeaea; }
  blockquote { margin: 0.2em 0; padding-left: 6px; border-left: 2px solid #ccc; color: #333; }
  .diagram { margin: 6px 0; text-align: center; }
  .diagram svg { max-width: 100%; height: auto; }
  .diagram-error { color: #555; }
  /* Keep diagrams, tables, code, and quotes from splitting across pages. */
  .diagram, table, pre, blockquote { break-inside: avoid; }
  img { max-width: 100%; }
`;

function buildHtml(title: string, inner: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${PRINT_CSS}</style>
</head>
<body>
${inner}
<script>window.addEventListener("load",function(){setTimeout(function(){window.focus();window.print();},300);});</script>
</body>
</html>`;
}

/**
 * Print a `layout: qa` document: render it to a standalone cheatsheet HTML and open it for
 * printing (default browser under Tauri, a new window in plain-browser mode).
 */
export async function printQaDocument(content: string, title: string): Promise<void> {
  mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });

  const { body } = splitFrontmatter(content);
  const { header, blocks } = parseQaBlocks(body);

  let inner = "";
  if (header.trim()) inner += `<section class="p-header">${await segmentToHtml(header)}</section>`;
  for (const b of blocks) {
    inner +=
      `<section class="p-row">` +
      `<div class="p-col p-left">${await segmentToHtml(b.left)}</div>` +
      `<div class="p-col p-right">${await segmentToHtml(b.right)}</div>` +
      `</section>`;
  }

  const doc = buildHtml(title, inner);

  if (isTauri) {
    // WKWebView can't print the live view; hand the HTML to Rust, which writes a temp
    // file and opens it in the default browser (bypassing the JS opener scope).
    await printHtml(doc);
  } else {
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(doc);
      w.document.close();
    } else {
      window.print();
    }
  }
}
