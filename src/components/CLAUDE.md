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

## Render performance — memoized editors

`DocumentView`, `MarkdownEditor` (Monaco), and `TaskTable` (AG Grid) are wrapped in `React.memo` so
unrelated `App` re-renders (sidebar-resize drag, terminal/quick-open toggles, theme) don't cascade
into the editor subtree. This relies on **stable props**: `App` passes `DocumentView` only
primitives + stable callbacks (the key one is `undoHistory`, which `useUndoHistory` now returns via
`useMemo`); `MarkdownEditor` hoists its static Monaco `options` to a module const and `useCallback`s
`onChange`; `TaskTable` hoists `getRowId` and gets a stable `onTaskSelected` from `DocumentView`. If
you add a prop to any of these, keep it referentially stable or the memo silently stops helping.
Tests: `hooks/__tests__/useUndoHistory` (stable identity) + the memo assertion in
`__tests__/DocumentView`.

### `layout: qa` cells (`QaLayout`)

A QA doc renders 2–3 Milkdown editors **per block**, so typing in one cell used to reconcile every
cell (each `QaLayout` re-render re-ran `doc.blocks.map` with a fresh inline `onChange` per editor).
Now each cell is a memoized **`QaCell`** bound to a single **stable `onEdit(field, value)`** handler
(keyed by the cell's `data-qa-field`), and `commit`/`commitRemount`/`onEdit` are `useCallback`s
(`commit` dep: the `onChange` prop). Because untouched blocks keep object + string identity through
`applyFieldReplace`'s map, only the edited cell's `value` changes → only it re-renders; Milkdown is
mount-once so even that is a cheap no-op. `applyFieldReplace` is hoisted to module scope (shared by
`onEdit` and find/replace). Cells remount only via the per-cell version in their key (see
*Live-reload* below), never on typing. Regression test: `__tests__/QaLayout.perf` (editing one cell
of a 5-editor doc bumps the render count by exactly 1).

`MarkdownWysiwyg` itself is `React.memo`'d with a **`value`-ignoring comparator**: it's mount-once
(Crepe reads `value` only as `defaultValue`, then owns its own DOM), so the edited cell's wrapper
skips re-rendering too — `onChange`/`darkMode`/`placeholder`/`className` are compared (onChange is
written into a ref during render), `value` is not. `IS_MAC` is a module const (computed once, not per
render).

**Live-reload cursor/scroll preservation.** Each cell carries a per-`data-qa-field` remount
**version** (`versionsRef`); its React `key` is `${field}-${dark}-v${version}`. A version bumps only
for the cells whose content changed — computed by `diffChangedFields(oldDoc, newDoc)` (qa-parser,
unit-tested) — on an external reload (the `[content]` effect) or a find/replace (`commitRemount`),
never on normal typing. So a live reload that touched a different cell remounts only that cell and
leaves the user's cell (cursor) + the scroll position intact. `mountKey` survives only as the
find-recollect signal. The companion Monaco view-state preservation lives in `MarkdownEditor`
(`saveViewState` in render → `restoreViewState` in a `[content]` effect). Tests:
`__tests__/QaLayout.reload` (only the changed cell remounts) + `qa-parser` `diffChangedFields`.

**Cmd+/ view-toggle scroll continuity.** Toggling between the WYSIWYG (`QaLayout`) and raw Monaco
(`MarkdownEditor`) unmounts one view and mounts the other, which would otherwise land at the top.
`DocumentView` owns a `viewScrollRef` (a `0..1` fraction, `lib/scroll-sync.ts` `toFraction`/
`fromFraction`) passed to both: the outgoing view writes its fraction on unmount, the incoming one
resumes it on mount — Monaco synchronously in `onMount` (its model lays out at once), `QaLayout`
across a few rAFs (re-applying while the mount-once editors create and the doc height settles). The
two views have very different heights, so a fraction (progress) is used rather than a line/pixel.
The Monaco path needs a live browser, so it's verified manually; the fraction math is unit-tested
(`__tests__/scroll-sync`).

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
