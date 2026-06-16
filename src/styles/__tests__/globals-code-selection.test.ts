import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Source-level regression guard for the WYSIWYG code-block **text-selection** fix (CSS-only).
 *
 * The fix can't be exercised in jsdom: the functional half is a WKWebView quirk (it propagates
 * `-webkit-user-select: none` from the non-editable ProseMirror leaf node-view into the nested
 * CodeMirror, blocking range selection — Chromium/jsdom don't), and jsdom's `getComputedStyle`
 * doesn't resolve stylesheet cascade/`!important` for `<style>`-injected rules. So instead we assert
 * the load-bearing declarations survive in `globals.css`; if a refactor drops them, code-snippet
 * selection silently breaks again in the desktop app. See CLAUDE.md "Code-block text selection".
 */
// vitest runs from the project root; resolve the stylesheet from there (import.meta.url is not a
// file URL under vite's transform).
const css = readFileSync(resolve(process.cwd(), "src/styles/globals.css"), "utf8");
// Whitespace-insensitive view so assertions don't depend on formatting.
const flat = css.replace(/\s+/g, " ");

describe("globals.css — code-block text selection", () => {
  it("defines the --nh-code-selection token in both themes", () => {
    expect(css).toMatch(/:root\s*\{[^}]*--nh-code-selection:\s*rgba\([^)]*\)/);
    expect(css).toMatch(/\.dark\s*\{[^}]*--nh-code-selection:\s*rgba\([^)]*\)/);
  });

  it("forces text selection back on for the CodeMirror editor (the WKWebView fix)", () => {
    // A rule whose selector list targets `.cm-editor` and sets both the prefixed and unprefixed
    // properties to `text` — without these, drag/shift-select does nothing in the packaged app.
    expect(flat).toMatch(/\.cm-editor[^{}]*\{ -webkit-user-select: text; user-select: text; \}/);
  });

  it("scopes the selection rules to .cm-content and .cm-line, not just the editor root", () => {
    // The block above must also reach the actual editable layers (the wrapper alone isn't enough).
    expect(flat).toContain(".cm-editor .cm-content");
    expect(flat).toContain(".cm-editor .cm-line");
  });

  it("themes the drawn selection layer with the token, beating CodeMirror's base rule", () => {
    // CodeMirror's `.cm-selectionBackground` defaults (#d7d4f0 / #d9d9d9) are invisible on our
    // surfaces; this must override it with the token and `!important` (higher base-theme specificity).
    expect(flat).toMatch(
      /\.cm-selectionBackground[^{}]*\{ background: var\(--nh-code-selection\) !important; \}/,
    );
  });
});
