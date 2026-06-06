# src/components — CLAUDE.md

## StatusBar.tsx — Zed-style bottom status bar

A thin (26px) footer rendered by `App` as the **last flex child** of the window shell, so it spans
the full width below the sidebar + document area (the terminal panel sits *within* the document
column, above it). It's the single home for the window's **layout-level toggles**:

- **Left** (gated on `isTauri`, since these panels are desktop-only): sidebar (file-tree) + terminal
  toggles — active panels tint with the accent color — plus the workspace folder basename as muted
  context.
- **Right**: the global **theme cycle** (light → dark → system), label shows the current mode.

State is owned by `App` and passed down: `toggleSidebar` (`useWorkspace`), a shared `toggleTerminal`
(also bound to the `` Ctrl+` `` keymap action), and `themeMode`/`cycleThemeMode` (`useDarkMode`).
Styles: `.nh-statusbar` / `.nh-status-btn` in `styles/globals.css`.

This is the **only** theme toggle — the duplicate that used to live in `Toolbar`, `QaLayout`, and the
editor header was removed (those no longer take `themeMode`/`onCycleTheme`).

Tests: `__tests__/StatusBar.test.tsx` (toggle handler wiring, active tint + `aria-pressed`, and the
`isTauri` gate that hides the panel toggles in browser mode).

## Per-document header (thin Zed-style title bar)

Every document view renders a thin (~30px) header titled by the **file name**
(`deriveBaseName(filePath)` from `lib/print.ts`), **not** the `project:` frontmatter field — that
field defaults to `"Untitled Project"` in the parser (`lib/markdown-parser.ts`) and is meaningless
for plain/Q&A files, so showing it was inaccurate on most files. Three headers share this:
`QaLayout` (plain/Q&A), the raw-editor header in `DocumentView` (`viewMode === "editor"`), and
`Toolbar` (the `layout: todo` grid — `Toolbar` now takes a `fileName` prop and dropped its unused
`meta`/title). Style: `.nh-doc-header` container + `.nh-icon-btn` icon-only actions (shortcuts in
the `title` tooltip), in `styles/globals.css`. Regression tests: `__tests__/QaLayout.test.tsx` (real
header — file-name title, `Untitled` fallback, variant badge, icon actions) and
`__tests__/Toolbar.test.tsx` (grid header titles by file name, never "Untitled Project").
