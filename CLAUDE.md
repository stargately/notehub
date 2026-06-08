# CLAUDE.md - NoteHub

## Overview

NoteHub is a markdown-native desktop task manager built with **Tauri v2 + React + AG Grid**. Markdown files are the single source of truth — humans and AI can both read/edit them directly, with changes auto-synced via a file watcher.

## Directory Structure

```
notehub/
├── src/                        # React frontend
│   ├── App.tsx                 # Window shell: tabs, sidebar, terminal, global keymap (no per-doc state)
│   ├── components/
│   │   ├── DocumentView.tsx    # One open document = buffer+view (own content/path/save); Zed-style
│   │   ├── TaskTable.tsx       # AG Grid task table
│   │   ├── TaskDetailDrawer.tsx # Side drawer with Tiptap editor
│   │   ├── ProjectNotes.tsx    # Project notes (Tiptap)
│   │   ├── QaLayout.tsx        # Two-column Q&A view (layout: qa) + plain markdown editor (no layout)
│   │   ├── MarkdownWysiwyg.tsx # Milkdown Crepe WYSIWYG editor wrapper
│   │   ├── Toolbar.tsx         # Filters, toggles, new task
│   │   ├── TabBar.tsx          # Multi-file tabs
│   │   ├── StatusBar.tsx       # Zed-style thin bottom bar: layout toggles (sidebar/terminal) + theme
│   │   ├── TerminalPanel.tsx    # Terminal manager: tabs + side-by-side split panes
│   │   ├── TerminalView.tsx     # A single terminal (one xterm + one PTY session)
│   │   ├── MarkdownEditor.tsx  # Raw markdown/code editor (Monaco; `language` prop)
│   │   ├── Sidebar.tsx         # Collapsible, resizable workspace file-tree panel (header = folder name)
│   │   ├── FileTree.tsx        # Lazy recursive tree + right-click ops & inline create/rename
│   │   ├── QuickOpen.tsx       # Cmd+P fuzzy file finder overlay (gitignore-aware index)
│   │   ├── ContextMenu.tsx     # Shared floating menu (FileTree right-click, TabBar)
│   │   ├── ConfirmModal.tsx    # Generic confirm dialog (e.g. move-to-Trash)
│   │   ├── KeybindingsHelp.tsx # Keyboard-shortcuts reference + user keymap JSON editor
│   │   ├── RawFileEditor.tsx   # Non-md files: raw Monaco / inline image / binary placeholder
│   │   ├── cell-renderers/     # AG Grid display components
│   │   └── cell-editors/       # AG Grid edit components
│   ├── hooks/
│   │   ├── useProjectFile.ts   # File load/parse/save logic
│   │   ├── useFileIndex.ts     # Lazy-cached recursive file index for Cmd+P (invalidate on change)
│   │   ├── useWorkspace.ts     # Workspace folder root + sidebar open/width state
│   │   ├── useRawFile.ts       # Load/autosave a non-md text file (own per-file FileSync)
│   │   ├── useNativeMenu.ts    # Bridge native File menu: menu:* events → handlers + enabled-state sync
│   │   └── useFileWatcher.ts   # External change detection
│   ├── lib/
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── markdown-parser.ts  # YAML frontmatter + table parser
│   │   ├── qa-parser.ts        # layout: qa marker parser (>>>/<<<)
│   │   ├── file-kind.ts        # path → FileKind (markdown/raw/image) + Monaco language
│   │   ├── tree.ts             # sortEntries (dirs first, case-insensitive)
│   │   ├── tree-refresh.ts     # file-changed → re-read tree dirs (subscribeDir/subscribeAll bus)
│   │   ├── fuzzy.ts            # fzy-style fuzzy matcher for Cmd+P (pure, unit-tested)
│   │   ├── recent-files.ts    # in-memory MRU for Cmd+P empty-query ordering
│   │   ├── tear-off.ts        # pure predicate: was a dragged tab released outside the window?
│   │   ├── keymap/            # Zed-style keymap: keystroke/context/matcher + provider & hooks
│   │   ├── milkdown-mermaid.ts # Mermaid SVG node view for Milkdown
│   │   ├── pm-plain-paste.ts   # Cmd+Shift+V "paste as plain text" for the ProseMirror editors
│   │   ├── print.ts            # Render layout: qa to a print cheatsheet HTML
│   │   └── tauri-api.ts        # Tauri IPC bridge
│   └── styles/globals.css      # Tailwind + AG Grid theme
├── src-tauri/                  # Rust backend
│   └── src/
│       ├── main.rs             # Entry point
│       ├── lib.rs              # App init
│       ├── commands.rs         # IPC commands (read/write file, terminal)
│       ├── menu.rs             # Native macOS app menu (File submenu) + click→focused-window routing
│       ├── terminal.rs         # PTY management (portable-pty)
│       └── watcher.rs          # File system watcher (notify crate)
├── docs/plan.md                # Technical spec
└── public/sample-project.md    # Demo file for browser mode
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri 2.2, Rust 2021 edition |
| Frontend | React 18, TypeScript 5.6, Vite 6 |
| Data Grid | AG Grid Community 33 |
| Rich Text | Tiptap 2.11 (StarterKit, Placeholder, TaskList) |
| WYSIWYG Markdown | Milkdown Crepe 7 (Typora-style editor for `layout: qa` and plain markdown files) |
| Diagrams | Mermaid 10 via `@milkdown/plugin-diagram` (custom node view) |
| Code Editor | Monaco (`@monaco-editor/react`) for raw markdown |
| Styling | Tailwind CSS 3.4, `@tailwindcss/typography` |
| Parsing | gray-matter (YAML frontmatter) |
| Terminal | portable-pty 0.8 (Rust), @xterm/xterm 5 (frontend) |
| File Watch | notify 7 + notify-debouncer-full 0.4 (Rust), 300ms coalescing (VS Code-style) |
| File Index / Trash | `ignore` 0.4 (gitignore-aware Cmd+P walk), `trash` 5 (move-to-Trash delete) |
| Fuzzy Search | `src/lib/fuzzy.ts` (dependency-free fzy-style matcher) |

## Commands

```bash
npm run dev           # Vite dev server (port 1420)
npm run dev:tauri     # Full Tauri dev environment
npm run build         # TypeScript + Vite production build
npm run build:tauri   # Build native app (creates installer)
npm run preview       # Preview production build
npm run kill          # Kill port 1420
npm test              # Run BOTH suites: vitest (JS) then cargo test (Rust)
npm run test:js       # Frontend unit tests only (vitest)
npm run test:rust     # Rust backend tests only (cd src-tauri && cargo test)
npm run test:watch    # Vitest in watch mode
npm run lint:rust     # cargo clippy -- -D warnings
npm run fmt:rust:check # cargo fmt -- --check
```

> `npm test` (a.k.a. `yarn test`) is the single command that validates the whole repo — it runs
> the frontend `vitest` suite first (fail-fast) and then the Rust `cargo test` suite. CI
> (`.github/workflows/ci.yml`) runs the same checks plus `clippy` and `fmt --check` on every push
> and PR.

## Testing

- **Frontend (`vitest`, jsdom)** — tests live in adjacent `__tests__/` dirs. Coverage spans pure
  `src/lib/` modules (`markdown-parser`, `qa-parser`, `print`, `tags`, `types`, `file-kind`, `tree`,
  `tree-refresh`, `fuzzy`, `tear-off`, `recent-files`, `pm-plain-paste` + the keymap engine `keymap/__tests__/`:
  `keystroke`/`context`/`keymap`/`user-keymap`/`provider`), the buffer/sync hooks (`useFileSync`,
  `useProjectFile`, `useViewMode`, `useRawFile`, `useTabManagement`, `useUndoHistory`, `useNativeMenu`),
  and components (`DocumentView`, `StatusBar`, `QaLayout`, `Toolbar`, `QaFindBar`). The load-bearing
  guarantees they lock in: the **loaded-path guard** (one tab's content is never written to another
  file, the editor is never seeded from a stale `projectData`), per-tab edit routing with **no
  cross-write**, the **`React.memo` guarantee** (a parent re-render with unchanged props doesn't
  re-render a tab's editor subtree), **unmount-cancels-autosave**, per-document header titling by
  **file name** (not the parser's `"Untitled Project"` default), find-bar **re-focus on a repeated
  `Cmd+F`**, and `useKeymapAction(enabled)` gating (only the active tab claims a binding).
- **Backend (`cargo test`)** — Rust unit tests live in `#[cfg(test)] mod tests` blocks inside each
  source file. The pattern is **"extract a pure helper, then test it"**: logic once buried in thread
  closures or `AppHandle`-bound IO is factored into pure functions tested headlessly (no PTY, Tauri
  runtime, or real watcher): `terminal.rs` → `drain_utf8` + the `write`/`resize`/`kill` error paths;
  `watcher.rs` → `should_skip_path`, `event_kind_label`; `lib.rs` → `reconcile_session`,
  `is_markdown_file`, `write_atomic` (vs a `tempfile` temp dir); `commands.rs` → `print_basename`,
  `sort_dir_entries`, `is_noise_dir`, `looks_binary`, `find_window_for_workspace`, tab-tear-off helpers
  (`drain_window_files`, `title_bar_anchor`), the gitignore index walker (`rel_path`, `walk_files`),
  `is_valid_filename`, plus the async file commands round-tripped through a temp dir (`#[tokio::test]`);
  `menu.rs` → `menu_event_name`. When adding backend logic, extract the testable core into a pure
  function with a test next to it — keep the IO/threading shell thin.
- **Coverage** — `npm run test:rust:coverage` (`cargo llvm-cov --summary-only`) reports line/region
  coverage; CI prints the same summary (informational, non-gating). The covered half is the pure
  logic above; the uncovered half is the deliberately-untested IO/runtime shell (`run()`, PTY
  `spawn`, the live watcher loop, macOS `recent_docs`, and the thin `#[tauri::command]` wrappers),
  which would need a real PTY / Tauri harness to exercise.

## Ports

- **1420** — Vite dev server (strict)
- **1421** — HMR websocket (Tauri mode only)

## Document layouts — the `layout` frontmatter routes the view

The `layout` field in a file's YAML frontmatter decides which view NoteHub renders. The rule is
**"raw unless `todo`"** — only `layout: todo` round-trips through the task serializer; everything
else is edited as raw markdown.

| `layout` | View |
|----------|------|
| `todo` | AG Grid task table (Toolbar + table + detail drawer + notes). **Required** for the table — see *Task Table Format* below. |
| `qa` | Two-column Typora-style Q&A view (`QaLayout`). |
| _none / anything else_ | **Plain markdown editor** — one full-width Milkdown Crepe WYSIWYG document, `Cmd+/` toggles to the raw Monaco editor. |

Both `qa` and plain docs use the same raw-string path (`QaLayout`, seeded from `rawContent`, written
via debounced `guardedWrite`, never `serializeProjectMd`). Plain docs are a marker-less `QaLayout`
(`parseQaBlocks` yields a single header editor), `variant="plain"` (only difference: the "Markdown"
badge). The predicate `isRawDoc = layout !== "todo"` gates this in `App.tsx`/`useViewMode.ts`.

> **Migration note**: a file with a `## Tasks` table but no `layout: todo` opens as a plain markdown
> doc (the table shows as literal text). No data is lost — `rawContent` is verbatim. Add `layout:
> todo` to restore the table.

## Task Table Format (`layout: todo`)

A task-table file sets `layout: todo` and has three sections:

### 1. YAML Frontmatter

```yaml
---
project: "Project Name"
created: "2025-09-22T00:00:00.000Z"
layout: todo
views:
  default:
    group_by: status
    sort_by: priority
    sort_order: desc
columns:
  - field: id
    width: 60
  - field: title
    width: 400
status_options: [todo, in_progress, done]
priority_options: [urgent, high, medium, low]
assignee_options: [Name1, Name2]
---
```

### 2. Tasks Table

```markdown
## Tasks

| Id | Title | Status | Priority | Assignee | Due | Tags |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | Task title | todo | high | Tian | 2025-10-13 | tag1, tag2 |
```

### 3. Task Details + Notes (optional)

```markdown
## Task Details

### tid-001
<p>Rich HTML description</p>

## Notes
<p>Project-wide notes in HTML</p>
```

## `layout: qa` — Q&A document layout

A file opts out of the task table by setting `layout: qa`. It's treated as **raw markdown** and
rendered in a Typora-style WYSIWYG editor (Milkdown Crepe); `Cmd+/` toggles to the raw Monaco editor.

The body is split by marker lines (each must be on its own line):

```markdown
---
layout: qa
---

Anything before the first **>>>** is a full-width header.

**>>>**
The question (left column)
**<<<**
The answer (right column)
**===**
An optional full-width note below the row (spans both columns).

**>>>**
A second question…
**<<<**
…and its answer. Multiple blocks stack down the page.
```

- Before the first `**>>>**` → full-width header. Between `**>>>**`/`**<<<**` → left column. After
  `**<<<**` (until the next `**>>>**`, `**===**`, or EOF) → right column.
- An optional `**===**` ends the answer early: text after it (until the next `**>>>**` or EOF) → the
  block's `after` field, a **full-width band below the row** (`QaBlock.after?`,
  `data-qa-field="block-<i>-after"`, searchable + printed full-width via `print.ts`'s `.p-after`).
  `**===**` only terminates inside an answer (like `**<<<**` inside a question); stray ones stay
  literal. A block without it serializes to `{ left, right }` (no round-trip change).
- A file with no markers renders as one full-width editor.

### Plain markdown files (no `layout`)

A `.md` file with no `layout` (or any value but `qa`/`todo`) is a **plain markdown document**,
reusing the `layout: qa` machinery: `QaLayout` with `variant="plain"`, and since the body has no
`**>>>**`/`**<<<**` markers, `parseQaBlocks` returns a single header editor — one full-width Milkdown
doc, `Cmd+/` toggling to raw Monaco. `assembleQa` round-trips a header-only doc to clean
`frontmatter + body`, so saving never injects a task table or touches frontmatter. The empty-doc case
is handled by the header guard `doc.header || doc.blocks.length === 0` in `QaLayout` (a brand-new
empty file still shows an editable editor, not a blank page).

**Mermaid diagrams**: ` ```mermaid ` fences render as diagrams in the WYSIWYG view.
`@milkdown/plugin-diagram` parses the fence into a `diagram` node (and serializes it back on save);
it ships no renderer, so `src/lib/milkdown-mermaid.ts` adds a ProseMirror node view drawing the SVG
via `mermaid.render`, themed light/dark. Clicking the diagram reveals an inline source editor; edits
live-preview and commit to the node's `value` on blur via `setNodeMarkup` (Esc cancels,
Cmd/Ctrl+Enter confirms). The raw fence is also editable via `Cmd+/`.

Parsing/serialization lives in `src/lib/qa-parser.ts` (`splitFrontmatter`, `parseQaBlocks`,
`assembleQa`). Frontmatter is preserved **verbatim** — QA files never round-trip through
`serializeProjectMd`, so the task serializer can't pollute frontmatter or drop the body. Edits are
written directly via the same debounced `writeFile` path (`useViewMode.handleEditorChange`).

**Find & replace** (`Cmd+F`): `src/lib/qa-find.ts` + `src/components/QaFindBar.tsx`, hosted by
`QaLayout`. Because the view is many mount-once Milkdown editors, find uses two representations:
**find/highlight on the rendered DOM** via the CSS Custom Highlight API (`CSS.highlights` + `Range` —
zero DOM mutation, safe with ProseMirror), while **replace edits the markdown source strings** in
`QaLayout`'s state. Each region carries a `data-qa-field` attr (`header` | `block-<i>-left` |
`block-<i>-right` | `block-<i>-after`) so a DOM match maps back to its source field; replace edits
that field and bumps `mountKey` to remount the editor (commit alone wouldn't refresh the mount-once
Crepe DOM). Plain prose aligns 1:1; a query overlapping markdown syntax (e.g. `**bold**`) can diverge
in count. Highlighting needs WKWebView/Safari 17.2+; navigation and replace work without it.

## Architecture Notes

- **Auto-generated IDs**: with no `id` column, the parser auto-assigns sequential IDs (`"001"`, …) so AG Grid has unique row keys; serialized back on save.
- **Data flow**: markdown → gray-matter parse → AG Grid/Tiptap → serialize → atomic write
- **Atomic writes**: write to `.tmp`, then rename (prevents corruption)
- **File watcher**: Rust `notify` + `notify-debouncer-full` watch a directory recursively, filter `.tmp` + noise dirs (`.git`/`node_modules`), coalesce bursts (300ms, never dropping distinct events — VS Code-style), and emit `"file-changed"` to React. All file types are surfaced (not just `.md`) so the tree and non-markdown editors stay in sync. Coverage is idempotent: `lib.rs` `ensure_watching` canonicalizes + dedups via `AppState.watched_dirs`, so the workspace root, restored-session dirs, and each opened file's dir get exactly one watcher. The frontend opens every file through `useTabManagement.openPath`, which canonicalizes the path (matching the watcher's realpath events) and `start_watching`s its dir unless already under the workspace root — this is what makes an open doc auto-reload (clean buffer) or raise a conflict (dirty buffer) however it was opened. `Cmd+R` is the manual reload (markdown via `loadFile`, raw/image via `useRawFile.reload`)
- **Save debounce**: 300ms debounce on React side
- **Disk reconciliation** (`src/hooks/useFileSync.ts`): NoteHub is co-edited with Claude Code writing the same `.md`. Per path it tracks a **baseline** (bytes last read/written = "what's on disk") and a **dirty** flag. Model mirrors VS Code/IntelliJ: disk is the source of truth.
  - **Echo suppression is content-based** (not a timer): on `file-changed`, `reconcile` re-reads disk; if it equals the baseline it's our own write → ignored. (The old 1s `writeLock` was removed — a timer could swallow a concurrent external write within the window.)
  - **Clean buffer + external change → live auto-reload** (VS Code style): `reconcile` calls `loadFile` and the editor updates instantly. **Cursor + scroll are preserved**: Monaco editors snapshot `saveViewState()` in render (before `@monaco-editor/react`'s value replace collapses the cursor) and `restoreViewState()` after; the `layout: qa` view remounts **only the cells whose content changed** (`QaLayout` keys each cell by a per-`data-qa-field` version bumped via `diffChangedFields`), so the cell the user is in survives a reload that touched a different cell.
  - **Dirty buffer + external change → conflict**: a blocking **`ConflictModal`** (Keep disk / Keep mine) — NoteHub never silently discards either side (IntelliJ "File Cache Conflict").
  - **Content-truthful conflict detection** (kills false positives that popped the modal "too often" while co-editing): two complementary changes. (1) `reconcile` adds a `mine === disk` short-circuit *before* the dirty-flag branch — if the buffer already equals the new disk content (Claude wrote what we had), adopt disk + clear dirty without conflicting (no data loss). (2) **`markDirty(path, content?)` is content-aware and returns whether the buffer is genuinely dirty**: an editor change that re-emits the baseline byte-for-byte (Milkdown fires `markdownUpdated` on its *own* post-mount normalization — e.g. the trailing-paragraph plugin — not just on user typing) is *not* a real edit, so it isn't flagged dirty; that's what stops the next external write from raising a spurious conflict. The editor paths (`useViewMode.handleEditorChange`, `useRawFile.onChange`) pass `content` **and cancel/skip the pending debounced write when `markDirty` returns false**; task-table edits (`useProjectFile.saveProject`) omit `content` and stay conservatively dirty. **Safety invariant**: a pending write exists only while `dirty` is true — so a clean live-reload never leaves a stale write behind to clobber the external change after the reload advances the baseline past `guardedWrite`'s guard.
  - **Single write chokepoint**: all watched-file writes go through `guardedWrite`, which re-reads disk first and raises a conflict instead of clobbering an external change — stopping the 300ms autosave from overwriting Claude when the debounce races the watcher. Every load/write updates the baseline.
  - **No cross-tab drift — per-document instances (`DocumentView`, Zed-style)**: the structural guarantee that one tab's content can never be written onto another file. Each open tab renders its own `DocumentView` bound to its **own fixed `filePath`** (Zed's "buffer + view" as one self-contained subtree), owning its content, file-sync baseline/dirty state, autosave, undo, and per-tab UI; every write target is captured from *that instance's* props, never a global "active file", so a stale-window save can't drift. All viewed tabs stay mounted (visibility via `display`, lazy after first activation; `App` keeps an `everActive` set + always renders the active tab), so background tabs keep editor state and pending debounced writes. Only the **active** tab registers keymap actions/contexts and publishes its **command bundle** (`DocCommands`: save/reload/toggleView/undo/redo); the window keymap and File-menu Save delegate to `App`'s `activeCmdsRef` (race-safe register-returns-unregister). `App` is a pure shell with **no per-document state**. Closing a tab unmounts its `DocumentView`, whose cleanup cancels pending autosaves (a just-deleted file isn't recreated). Hidden-tab editors re-measure on reveal — Monaco uses `automaticLayout: true`.
  - **Loaded-path guard (defense-in-depth)**: `guardedWrite` only protects against *external* changes — it writes whatever content it's handed, even to the wrong file. Independently, the buffer hooks gate on the path their state was loaded from: each records `loadedPath` (+ a monotonic generation token to drop out-of-order reads) and refuses to persist when `loadedPath !== <path being written>` (`useViewMode` derives `synced = loadedPath === activeFilePath` and won't *seed* an editor from a non-matching `projectData`). This catches the same drift class (incl. the **`getDefaultProjectContent()` "Untitled Project" `layout: todo` template** that loads whenever `filePath` is momentarily `null`). The untitled case (`filePath === null`) still edits in memory but can't reach disk. Tests: `useProjectFile`/`useViewMode`/`useRawFile`/`DocumentView`.
- **Render performance — memoized editor subtrees**: `App` re-renders frequently for reasons
  unrelated to any document (sidebar-resize drag, terminal/quick-open/keymap-help toggles, theme, tab
  switches). To stop those cascading into every mounted editor, `DocumentView` is wrapped in
  `React.memo` and `App` passes it only **stable** props (primitives + the stable `setTabs` setter,
  `publishCommands`/`undoHistory`). `useUndoHistory` returns a **`useMemo`-stabilized object** so its
  identity doesn't change and defeat the memo. The heavy leaf editors are memoized too: `MarkdownEditor`
  (Monaco) hoists static `options` to a module const + `useCallback`s `onChange` (a fresh object per
  keystroke would retrigger `updateOptions`); `TaskTable` (AG Grid) hoists `getRowId` and takes a stable
  `onTaskSelected`. Within `layout: qa`, each per-block Milkdown editor is a memoized **`QaCell`** bound
  to a stable `onEdit(field, value)`, so typing in one cell doesn't reconcile the others. Net effect: a
  tab's editor re-renders only when its own `active`/`filePath`/`darkMode`/content change. Tests:
  `useUndoHistory`, `DocumentView`, `QaLayout.perf`.
- **Paste as plain text** (`Cmd+Shift+V`, `src/lib/pm-plain-paste.ts`): a Typora-style plain paste
  for the ProseMirror-backed editors. Because the binding routes through the app keymap, the handler
  runs from a `keydown` where no native `ClipboardEvent` exists — so it reads `navigator.clipboard.
  readText()` (async; fails gracefully if the WKWebView rejects) and inserts via a **programmatic
  `tr.insertText`**. That path bypasses ProseMirror input rules, so the text is literal and
  uninterpreted — pasting `# foo` inserts the characters, never a heading (plain `Cmd+V` keeps the
  formatted, markdown-aware paste). A small module-level **registry** keys each mounted editor by its
  contenteditable; the single handler (`pasteAsPlainText`) captures the **focused** view *synchronously*
  (before the async read can move focus) and dispatches into it — this is how `QaLayout`'s many
  mount-once Milkdown cells route to the right cell from one registration. `MarkdownWysiwyg` registers
  its Crepe view (via `editorViewCtx`) and `TaskDetailDrawer` its Tiptap view (`editor.view`); both
  `useKeymapAction(…, active)` so only the active tab claims the binding. The edit flows through the
  editors' normal `markdownUpdated`/`onUpdate` → save path (no special-casing in `useFileSync`).
  Tests: `src/lib/__tests__/pm-plain-paste.test.ts` (focus routing, sync capture, empty/rejected clipboard).
- **Single blinking caret** (`MarkdownWysiwyg`): Crepe's `Cursor` feature is configured with
  `{ virtual: false }` so the Milkdown editors use the **browser-native caret**, not the
  `prosemirror-virtual-cursor` widget. The virtual cursor draws a decoration for *any* editor whose
  selection is empty (not just the focused one), so with `QaLayout`'s many mount-once cells every cell
  rendered its own static cursor — multiple cursors at once, only the focused one blinking. The native
  caret appears only in the focused `contenteditable` and blinks on its own, so exactly one blinking
  caret exists globally; `caret-color: var(--nh-accent)` (`globals.css`) tints it. Crepe's drop/gap
  cursors stay enabled (only the virtual *text* cursor is dropped).
- **Browser fallback**: runs without Tauri using `sample-project.md` for UI testing.
- **Dark mode**: class-based (`dark`), AG Grid + Tailwind themed. The **theme cycle** (light → dark →
  system) lives in the status bar.
- **Status bar**: Zed-style thin bottom bar with the window's layout toggles (sidebar/terminal) +
  theme cycle. See `src/components/CLAUDE.md`.

## Keyboard Shortcuts — the Zed-style keymap

Shortcuts are **data-driven**, not hard-coded. A keymap (`src/lib/keymap/`) maps keystrokes →
namespaced **actions** within **contexts**; the focused view registers a handler per action. Users
remap anything via **File → Keyboard Shortcuts…** (`KeybindingsHelp.tsx`). Default bindings (`Cmd+O`/
`Cmd+P`/`Cmd+S` are also native File-menu accelerators — OS-dispatched to the menu, same handlers):

- `Cmd+R` — Reload file
- `Cmd+N` — New task (Grid context)
- `Cmd+S` — Save (Save As for untitled)
- `Cmd+/` — Toggle raw markdown editor (formatted WYSIWYG ↔ raw for `layout: qa`)
- `Cmd+Shift+V` — Paste as plain text (`editor::PasteAsPlainText`), Typora-style: insert the
  clipboard's `text/plain` as **literal, uninterpreted** characters at the cursor in the
  ProseMirror-backed editors (Milkdown cells + the Tiptap task drawer). Bound in the `QA` and `Grid`
  contexts; Monaco views don't register it (their paste is already plain). See *Paste as plain text*
  under Architecture Notes.
- `Cmd+F` — Task view: focus the filter (Toolbar). `layout: qa` view: open the Find & replace bar
  (`Enter`/`Shift+Enter` navigate, `Esc` closes) — different action per context (`grid::FocusFilter`
  vs `editor::Find`). Pressing `Cmd+F` again while open re-focuses + selects its input (browser-like)
  via a `findFocusTick` `QaFindBar` keys on (`setFindOpen(true)` alone wouldn't re-focus).
- `Cmd+P` — Quick-open fuzzy file finder (`QuickOpen.tsx`). `mod-p` binds with `shift` off, so
  `Cmd+Shift+P` (print) is a distinct binding.
- `Cmd+O` — Open a file via the OS dialog (`file::Open` → `handleAddTab`).
- `Cmd+Shift+P` — Print the `layout: qa` doc (compact cheatsheet, letter, two columns + diagrams).
  WKWebView has no working `window.print()`, so `src/lib/print.ts` renders the markdown to
  self-contained HTML (via `marked` + light-theme mermaid) and the Rust `print_html` command writes it
  to a temp file opened in the default browser. The doc `<title>` and temp basename are both the source
  `.md` file name (no dir/ext), so "Save as PDF" defaults to a consistent name. Handler in `QaLayout.tsx`.
- `Cmd+B` — Toggle the workspace file-tree sidebar
- `Cmd+1-9` — Switch tabs (`workspace::ActivateTab` with the index as the action arg)
- `Cmd+W` — Close the active tab (`workspace::CloseTab`); with no tabs open (empty pane) it
  closes the window, Zed/VS Code-style. It's the native File → **Close** accelerator (routed to the
  focused window as `menu:close`, handled by `App.closeActiveTabOrWindow`); the window is closed via
  the Rust `close_window` command (no `core:window` capability needed).
- `Ctrl+`` `` — Toggle terminal
- `Cmd+D` — Split the active terminal pane side-by-side (Terminal context — only when focused)
- `Escape` — Close detail drawer / modals (component-local, not keymap-routed)

### Keymap system (`src/lib/keymap/`)

A small Zed-inspired engine, split into pure (unit-tested) modules + a React layer:

- **`keystroke.ts`** — parse `cmd-shift-p` / `ctrl-\`` / chord sequences (`mod-k mod-s`) and
  normalize a `KeyboardEvent` to the same canonical form. `mod` is the platform accelerator
  (matches **Meta OR Ctrl**, preserving the old `e.metaKey || e.ctrlKey` behavior). `formatSequence`
  renders `⌘⇧P` (mac) / `Ctrl+Shift+P` (else) for the UI. Strict modifier matching cleanly separates
  `mod-p` from `mod-shift-p`.
- **`context.ts`** — a tiny predicate parser/evaluator (`!`, `&&`, `||`, parens, identifiers) run
  against the set of active context names; empty predicate matches everywhere.
- **`keymap.ts`** — compile a keymap (ordered `{context?, bindings}` blocks) and `resolve(contexts,
  pressedKeystrokes)` → `action | pending | none`. Precedence: context-bearing beats context-less,
  then later-declared wins (so user overrides win); `null` unbinds; strict-prefix matches return
  `pending` (chords).
- **`actions.ts`** (`ACTIONS`, `CONTEXTS` constants), **`default-keymap.ts`** (the single source of
  truth for default bindings), **`user-keymap.ts`** (localStorage `nh-keymap` JSON, parsed +
  validated, layered after defaults).
- **`provider.tsx`** — `KeymapProvider` (wraps the app in `main.tsx`) hosts the one window `keydown`
  dispatcher: builds the active context set (+ always `Workspace`), buffers chords with a timeout,
  resolves, and calls the **most-recently-registered** handler (the focused view). Hooks:
  `useKeymapAction(name, handler, enabled = true)` (focused/last wins via a stack; `enabled = false`
  skips registration), `useKeymapContext(name, active)`, `useKeymapApi()`. Decoupling key→action
  (keymap) from action→handler (registry) is the Zed model — `App` owns workspace actions (quick-open,
  open, sidebar/terminal toggles, tab switching, close-tab) and delegates per-document actions
  (save/reload/toggle-raw/undo/redo) to the active tab's `DocCommands`. Since **every tab's
  `DocumentView` stays mounted**, views register only when active: `DocumentView` contributes the
  Grid/Editor/QA/RawFile contexts gated on `active`, and `Toolbar` (`focusFilter`/`newTask`) +
  `QaLayout` (`find`/`print`) take an `active` prop passed as `enabled`. `TerminalPanel` is global —
  registers `splitTerminal` and contributes `Terminal` when focus is inside the panel.
- **`KeybindingsHelp.tsx`** — File → Keyboard Shortcuts…: lists the effective merged keymap grouped
  by context (pretty keystrokes) and a JSON editor for user overrides (save → localStorage / reset).
- **Editor bridging**: Monaco re-dispatches `Cmd+/`, `Cmd+S`, `Cmd+B` as synthetic window `keydown`s
  (`MarkdownEditor.tsx`) that the dispatcher handles. Element-local keys (Enter/Esc/arrows in
  QuickOpen, find bar, inline rename, modals) stay component handlers; the keymap only routes
  modifier-accelerator actions, so it never steals typing.

## Integrated Terminal — tabs & split panes

Multiple terminals like Claude Code / Zed / iTerm2. The backend (`src-tauri/src/terminal.rs`) is
already multi-session — `TerminalState` keeps a `Mutex<HashMap<u32, TerminalSession>>` keyed by
`session_id`; the tab/split feature is purely frontend.

- **`TerminalView.tsx`** owns one xterm + one PTY session (spawn on mount, `terminal-output`/
  `terminal-exit` filtered by session id, `FitAddon` + `ResizeObserver` refit, kill + dispose on unmount).
- **`TerminalPanel.tsx`** is the manager. State is `tabs: TermTab[]` (`{ id, title, panes:
  TermPane[] }`, `TermPane = { id, weight }`), tracking `activeTabId`/`activePaneId`. Client-side
  string ids (`t1`, …) are React keys, independent of backend session ids.
  - **`+`** → `addTab()` (new tab, one pane); **split / `Cmd+D`** → `splitActivePane()` appends a
    pane in a `flex-row` with a draggable `col-resize` divider trading `weight` between neighbors.
  - **Every tab stays mounted** (visibility via `display`) so background terminals keep running.
  - Closing the last pane closes the tab; closing the last tab leaves one fresh tab. A pane whose
    shell exits auto-closes via `onExit`. `Cmd+D` is gated on `panelRootRef.contains(activeElement)`
    so it never hijacks the editor/grid.

## Workspace folders & the file-tree sidebar

NoteHub can open a **folder as a project**: a collapsible left sidebar (`Cmd+B`, shown by default)
shows a file tree; clicking a file opens it in a tab. **One workspace folder per window** — opening a
*different* folder spawns a new OS window (VS Code "Open Folder in New Window"); re-opening the same
folder focuses the window that owns it. Opening a folder never disturbs existing tabs.

**No auto-opened untitled doc**: NoteHub never creates an `untitled-todo.md` tab on its own. A main
window with no restored session, a freshly-spawned workspace window, and a window whose last tab was
just closed all settle into an **empty state** — `App` keeps the sidebar mounted and the document
area renders the **Zed-style empty pane** (`WelcomePane.tsx`): a clean, minimal list of the key
file/workspace actions (New File / Open File ⌘O / Quick Open ⌘P / Open Folder…) with their shortcuts
(rendered from the live keymap via `formatSequence`, so a user remap shows here too), on the blank
editor background — not a marketing card, and not editable. Workspace-only actions (New File / Quick
Open) appear only with a folder open; rows are clickable and delegate to the same handlers as the
sidebar/File menu. Files are still created/opened from the tree or the native **File** menu too.
Closing the last tab is allowed (`activeTabId` becomes `""`). New `.md` files are
created empty (plain Milkdown docs), so `getDefaultProjectContent()`'s task-board template is reached
only when restoring an in-memory buffer for a momentarily-`null` path, never on disk.

**Tab tear-off (drag a tab out → new window)**: dragging a tab out and releasing outside its bounds
moves that document into a fresh window (Zed-style, move semantics). Detection uses **native HTML5
drag** (each tab `draggable`; `onDragEnd` carries the release point as logical `screenX/screenY`) —
chosen over pointer capture because WKWebView doesn't reliably deliver `pointerup` once the cursor
leaves the window. `App.handleDetachTab` fetches the outer rect from Rust (`get_window_rect`) and, if
`isReleaseOutsideWindow` (`src/lib/tear-off.ts`, pure/tested) is true, calls
`useTabManagement.detachTab` → `detach_tab` spawns a `workspace-{n}` window near the cursor, stashing
the file in `AppState.window_files`; the source tab is closed. The new window drains its file(s) via
`get_window_files` on mount (adopts no workspace folder, so folder-dedup is untouched). Untitled /
`browser://` tabs aren't draggable; geometry lives in Rust so **no `core:window:*` capability** is needed.

Entry points: **File → Open Folder…** (or the sidebar's empty-state **Open Folder** button) → both
call `openFolderDialog` via `useWorkspace.openFolder`; **dragging a folder into the window**
(`useTabManagement` splits dirs from files via `is_directory`, routing dirs to `onOpenFolder`); and
**dropping a folder on the Dock icon** (`RunEvent::Opened` → emits `open-folder`). Dock drops need the
`CFBundleDocumentTypes` entry in `src-tauri/Info.plist` and only work in a packaged build. The root is
watched recursively so every tree file live-reloads on external edits.

- **Backend (`src-tauri/src/commands.rs`)**:
  - `read_dir(path)` → `Vec<DirEntryInfo { name, path, is_dir }>`, one level deep (tree lazy-loads on
    expand). Sorted dirs-first/case-insensitive (`sort_dir_entries`); noise dirs (`.git`,
    `node_modules`, `.DS_Store` via `is_noise_dir`) hidden, but dotfiles in general are *not*.
  - `list_workspace_files(root)` → `Vec<FileEntry { path, rel, name }>`, the **recursive** Cmd+P
    index. Walks via the `ignore` crate (`walk_files`, `.require_git(false)` so `.gitignore`/`.ignore`
    apply even outside a git repo, `.hidden(false)` to keep dotfiles), pruning `is_noise_dir`; files
    only, capped at `MAX_INDEX_FILES`. **The finder is the one place that's gitignore-aware** (the
    tree's `read_dir` is not).
  - **File mutations** (all `Result<_, String>`, basename re-validated via the pure `is_valid_filename`):
    `create_file` (empty, `create_new` so it never clobbers), `create_dir`, `rename_path` (errors if
    target exists), `delete_path` (→ OS Trash via the `trash` crate). Reveal-in-Finder has **no Rust
    command** — the frontend calls `@tauri-apps/plugin-opener`'s `revealItemInDir` (`opener:default`).
  - `read_text_file(path)` → file text, or `Err("binary")` for non-text files (NUL-byte heuristic,
    `looks_binary`). Distinct from `read_file` (the markdown editors' path).
  - `open_workspace_window(folder)` spawns a `workspace-{n}` window (or focuses an existing one via
    `find_window_for_workspace`), recording `label -> canonical(folder)` in
    `AppState.workspace_windows`; the new window fetches its root via `get_window_workspace`.
  - `set_workspace_root(path)` records an in-place folder (for dedup). `save_session` persists
    `workspaceRoot`; `reconcile_session` drops it if the dir is gone.
  - **Tab tear-off**: `detach_tab(path, x, y)` spawns a `workspace-{n}` window near the release point
    (pure `title_bar_anchor`) and stashes the file in `AppState.window_files`; `get_window_files()`
    drains it on mount (pure `drain_window_files`); `get_window_rect()` returns outer bounds in logical
    px (`outer_position`/`outer_size` ÷ `scale_factor`) for the outside-the-window test.
  - **Capabilities** (`capabilities/default.json`) apply to `["main", "workspace-*"]` (spawned windows
    would otherwise have zero permissions). Inline image preview needs the asset protocol
    (`tauri.conf.json` `app.security.assetProtocol` + the `protocol-asset` Cargo feature).
  - The **watcher** (`watcher.rs` `should_skip_path`) surfaces *all* file types so non-markdown editors
    reload too, still skipping `.tmp` and noise dirs.
- **Frontend**:
  - `useWorkspace.ts` owns `workspaceRoot` (from `get_window_workspace`, falling back to the persisted
    session) + sidebar open/width (localStorage `nh-sidebar-open`/`nh-sidebar-width`). `openFolder()`
    adopts the first folder or opens another window.
  - `Sidebar.tsx` + `FileTree.tsx`: resizable panel + lazy recursive tree; clicking a file calls
    `useTabManagement.openPath` (dedupes, focuses).
  - **File management** (`FileTree.tsx`): right-click → `ContextMenu` (New File/Folder on dirs,
    Rename, Delete, Reveal in Finder, Copy Path; empty space → New at root). Ops shared with rows via
    a `FileTreeContext` + a folder-handle registry so a create auto-expands/optimistically reloads its
    target (the watcher reloads too — both idempotent). New/rename use an inline `InlineInput`
    (basename pre-selected; stays open on a name-conflict toast). New `.md` is **empty** → plain
    Milkdown doc (never `getDefaultProjectContent`). Delete → `ConfirmModal` → OS Trash. Root-level
    creates go through a `useImperativeHandle` on `FileTree` (`newFileAtRoot`/`newFolderAtRoot`); the
    ref is **owned by `App`**, passed to `Sidebar` (`treeRef`) so the native File menu can drive it.
    Tab sync: `onRenamed`/`onDeleted` → `useTabManagement.renameTabPath` (repoints open tabs incl.
    folder descendants) / `closeTabByPath`. `useViewMode.cleanupTab` cancels the pending autosave so a
    delete isn't undone by a debounced write recreating the file.
  - **Native File menu** (`src-tauri/src/menu.rs` + `src/hooks/useNativeMenu.ts`): the macOS **File**
    submenu (New File/Folder, Open File… `⌘O`, Open Folder…, Quick Open… `⌘P`, Save `⌘S`, Refresh File
    Tree, Close `⌘W`, Keyboard Shortcuts…) — no in-window menu bar. `menu::build_app_menu` starts
    from `Menu::default` (keeping native App/**Edit**/Window menus) and swaps the stock File submenu (index
    1) for ours. The stock predefined Close Window is replaced by a custom **Close** item (`⌘W`) emitting
    `menu:close`, so a single accelerator closes the active tab and only closes the window once no tabs
    remain (Zed/VS Code-style — see `App.closeActiveTabOrWindow` + the `close_window` command).
    `handle_menu_event` emits `menu:<action>` to the **focused** window; `useNativeMenu`
    (in every window) listens and calls the matching handlers. `⌘O`/`⌘P`/`⌘S`/`⌘W` are real OS accelerators
    (supersede the keymap's `mod-o/p/s/w` but route to the same handlers). Enabled state is focus-synced:
    `useNativeMenu` pushes `(hasWorkspace, canSave)` via `update_file_menu` on focus/state change,
    toggling the `FileMenuItems` in `AppState.file_menu` (Save off with no doc; New File/Folder/Refresh
    off without a workspace).
  - **Quick open** (`Cmd+P`, `QuickOpen.tsx`): fuzzy finder over the workspace. `useFileIndex` lazily
    fetches `list_workspace_files` on open, caches it in a ref, and `invalidate()`s on `file-changed`
    (via `tree-refresh.subscribeAll`) or root change. `fuzzy.ts` (pure, fzy-style) ranks each file's
    `rel`; an empty query lists open tabs then the in-memory MRU (`recent-files.ts`). Enter → `openPath`.
  - **Tree auto-refresh** (`tree-refresh.ts`, VS Code model): each loaded directory subscribes by path
    to a shared `file-changed` listener and re-reads itself on a create/delete/rename inside it. The
    watcher coalesces bursts but never drops events, and the canonicalized root makes realpath events
    match tree paths — so the tree stays fresh from the watcher alone. A manual **Refresh**
    (`refreshAllDirs`) re-reads all loaded dirs on demand.
  - **File routing by extension** (`file-kind.ts` `fileKindForPath`): `.md/.mdx` → `markdown`; images
    → `image`; else → `raw`. Each `TabInfo` carries its `kind`; raw/image tabs render `RawFileEditor`
    (markdown pipeline gated off via `useProjectFile(isRawFile ? null : activeFilePath, …)`).
  - `RawFileEditor.tsx`: raw text files open in Monaco (editable, autosaved via `useRawFile`;
    self-contained — its own `useFileSync` + `ConflictModal`, one per tab; language from
    `languageForPath`); images render inline via `convertFileSrc`; other binaries show a placeholder.

## Development Guidelines

- **Document new features**: When adding a new feature, update both `README.md` (user-facing docs) and `CLAUDE.md` (architecture docs) in the same change.
- **Playwright MCP screenshots**: Always use the `.playwright-mcp/` prefix in screenshot filenames (e.g., `filename: ".playwright-mcp/my-screenshot.png"`) so all output stays in the `.playwright-mcp/` directory alongside console logs.

## Key Types

```typescript
interface ProjectData {
  meta: ProjectMeta    // YAML frontmatter config
  tasks: Task[]        // Parsed from markdown table
  notes: string        // HTML from ## Notes section
  rawContent: string
}

interface Task {
  id: string; title: string; status: string;
  priority: string; assignee: string; due: string;
  tags: string[]; description?: string; // HTML
  created?: string; done?: string;      // ISO dates
}
```
