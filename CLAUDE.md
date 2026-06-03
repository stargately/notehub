# CLAUDE.md - NoteHub

## Overview

NoteHub is a markdown-native desktop task manager built with **Tauri v2 + React + AG Grid**. Markdown files are the single source of truth — humans and AI can both read/edit them directly, with changes auto-synced via a file watcher.

## Directory Structure

```
notehub/
├── src/                        # React frontend
│   ├── App.tsx                 # Main app (tabs, state, keyboard shortcuts)
│   ├── components/
│   │   ├── TaskTable.tsx       # AG Grid task table
│   │   ├── TaskDetailDrawer.tsx # Side drawer with Tiptap editor
│   │   ├── ProjectNotes.tsx    # Project notes (Tiptap)
│   │   ├── QaLayout.tsx        # Two-column Q&A view (layout: qa) + plain markdown editor (no layout)
│   │   ├── MarkdownWysiwyg.tsx # Milkdown Crepe WYSIWYG editor wrapper
│   │   ├── Toolbar.tsx         # Filters, toggles, new task
│   │   ├── TabBar.tsx          # Multi-file tabs
│   │   ├── TerminalPanel.tsx    # Terminal manager: tabs + side-by-side split panes
│   │   ├── TerminalView.tsx     # A single terminal (one xterm + one PTY session)
│   │   ├── MarkdownEditor.tsx  # Raw markdown/code editor (Monaco; `language` prop)
│   │   ├── Sidebar.tsx         # Collapsible, resizable workspace file-tree panel
│   │   ├── FileTree.tsx        # Lazy recursive file/folder tree
│   │   ├── RawFileEditor.tsx   # Non-md files: raw Monaco / inline image / binary placeholder
│   │   ├── cell-renderers/     # AG Grid display components
│   │   └── cell-editors/       # AG Grid edit components
│   ├── hooks/
│   │   ├── useProjectFile.ts   # File load/parse/save logic
│   │   ├── useWorkspace.ts     # Workspace folder root + sidebar open/width state
│   │   ├── useRawFile.ts       # Load/autosave a non-md text file (shared FileSync)
│   │   └── useFileWatcher.ts   # External change detection
│   ├── lib/
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── markdown-parser.ts  # YAML frontmatter + table parser
│   │   ├── qa-parser.ts        # layout: qa marker parser (>>>/<<<)
│   │   ├── file-kind.ts        # path → FileKind (markdown/raw/image) + Monaco language
│   │   ├── tree.ts             # sortEntries (dirs first, case-insensitive)
│   │   ├── tree-refresh.ts     # file-changed → re-read affected tree dirs (subscribeDir bus)
│   │   ├── milkdown-mermaid.ts # Mermaid SVG node view for Milkdown
│   │   ├── print.ts            # Render layout: qa to a print cheatsheet HTML
│   │   └── tauri-api.ts        # Tauri IPC bridge
│   └── styles/globals.css      # Tailwind + AG Grid theme
├── src-tauri/                  # Rust backend
│   └── src/
│       ├── main.rs             # Entry point
│       ├── lib.rs              # App init
│       ├── commands.rs         # IPC commands (read/write file, terminal)
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

- **Frontend (`vitest`, jsdom)** — pure modules under `src/lib/` and hooks under `src/hooks/`
  have unit tests in adjacent `__tests__/` dirs (`markdown-parser`, `qa-parser`, `print`, `tags`,
  `types`, `file-kind`, `tree`, `tree-refresh`, `useFileSync`).
- **Backend (`cargo test`)** — Rust unit tests live in `#[cfg(test)] mod tests` blocks inside each
  source file. The pattern is **"extract a pure helper, then test it"**: logic that used to be
  buried in thread closures or `AppHandle`-bound IO was factored into pure functions so it can be
  tested headlessly (no PTY, no Tauri runtime, no real filesystem watcher):
  - `terminal.rs` → `drain_utf8` (the streaming UTF-8 chunk decoder for PTY output)
  - `watcher.rs` → `should_skip_path`, `event_kind_label` (file-watch filtering; event
    coalescing/debounce is now delegated to `notify-debouncer-full`)
  - `lib.rs` → `reconcile_session` (session-restore reconciliation, incl. dropping a missing
    `workspace_root`), plus `is_markdown_file` and `write_atomic` (tested against a `tempfile` temp
    dir; `tempfile` is a dev-dependency)
  - `commands.rs` → `print_basename` (PDF filename sanitization), `sort_dir_entries`,
    `is_noise_dir`, `looks_binary`, `find_window_for_workspace`, plus the async `read_file` /
    `write_file` / `read_dir` / `read_text_file` commands round-tripped through a temp dir
    (`#[tokio::test]`)
  - `terminal.rs` → the `write` / `resize` / `kill` error paths against an empty `TerminalState`
    (unknown `session_id` → error; `kill` is a no-op `Ok`) — exercised without spawning a real PTY
  When adding backend logic, prefer extracting the testable core into a pure function and add a
  test next to it — keep the IO/threading shell thin.
- **Coverage** — `npm run test:rust:coverage` (`cargo llvm-cov --summary-only`) reports line/region
  coverage; CI prints the same summary (informational, non-gating). The covered half is the pure
  logic above; the uncovered half is the deliberately-untested IO/runtime shell (`run()`, PTY
  `spawn`, the live watcher loop, macOS `recent_docs`, and the thin `#[tauri::command]` wrappers),
  which would need a real PTY / Tauri harness to exercise.

## Ports

- **1420** — Vite dev server (strict)
- **1421** — HMR websocket (Tauri mode only)

## Document layouts — the `layout` frontmatter routes the view

The `layout` field in a file's YAML frontmatter decides which view NoteHub renders. The
governing rule is **"raw unless `todo`"** — only `layout: todo` round-trips through the task
serializer; everything else is edited as raw markdown.

| `layout` | View |
|----------|------|
| `todo` | AG Grid task table (Toolbar + table + detail drawer + notes). **Required** for the table — see *Task Table Format* below. |
| `qa` | Two-column Typora-style Q&A view (`QaLayout`). |
| _none / anything else_ | **Plain markdown editor** — one full-width Milkdown Crepe WYSIWYG document, `Cmd+/` toggles to the raw Monaco editor. |

Both `qa` and plain docs are edited through the same raw-string path (`QaLayout`, seeded from
`rawContent`, written via the debounced `guardedWrite`, never through `serializeProjectMd`). Plain
docs are just a marker-less `QaLayout` (`parseQaBlocks` yields a single header editor, no `**>>>**`
blocks), rendered with `variant="plain"` (the only difference is the "Markdown" badge). The single
predicate `isRawDoc = layout !== "todo"` gates this in `App.tsx` and `useViewMode.ts`.

> **Migration note**: a file that has a `## Tasks` table but no `layout: todo` now opens as a plain
> markdown document (the table shows as literal markdown text, not an interactive grid). No data is
> lost — `rawContent` is preserved verbatim. Add `layout: todo` to restore the table.

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

A file can opt out of the task-table UI and into a document layout by setting
`layout: qa` in its frontmatter. Such a file is treated as **raw markdown** (no task
table) and rendered in a Typora-style WYSIWYG editor (Milkdown Crepe). `Cmd+/` toggles
to the raw Monaco code editor and back.

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

**>>>**
A second question…
**<<<**
…and its answer. Multiple blocks stack down the page.
```

- Content before the first `**>>>**` → full-width header editor.
- Text between `**>>>**` and `**<<<**` → left column.
- Text after `**<<<**` (until the next `**>>>**` or EOF) → right column.
- A file with no markers renders as one full-width editor.

### Plain markdown files (no `layout`)

A `.md` file with no `layout` (or any value other than `qa`/`todo`) is a **plain markdown
document**. It reuses the exact `layout: qa` machinery: `QaLayout` is rendered with
`variant="plain"`, and since the body has no `**>>>**`/`**<<<**` markers, `parseQaBlocks`
returns a single header editor — i.e. one full-width Milkdown WYSIWYG document, with `Cmd+/`
toggling to the raw Monaco editor. `assembleQa` round-trips a header-only doc to clean
`frontmatter + body`, so saving never injects a task table or touches the frontmatter. The
empty-doc case is handled by the header guard `doc.header || doc.blocks.length === 0` in
`QaLayout` (so a brand-new empty file still shows an editable editor instead of a blank page).

**Mermaid diagrams**: ` ```mermaid ` fenced blocks render as diagrams inside the
WYSIWYG view. `@milkdown/plugin-diagram` parses the fence into a `diagram` node (and
serializes it back to a fence on save); it ships no renderer, so `src/lib/milkdown-mermaid.ts`
adds a ProseMirror node view that draws the SVG via `mermaid.render`, themed to light/dark.
Clicking the diagram reveals an inline source editor above it; edits live-preview and, on
blur, commit to the node's `value` attr via `setNodeMarkup` (Esc cancels, Cmd/Ctrl+Enter
confirms). You can also edit the raw fence via the raw editor (`Cmd+/`).

Parsing/serialization lives in `src/lib/qa-parser.ts` (`splitFrontmatter`,
`parseQaBlocks`, `assembleQa`). Frontmatter is preserved **verbatim** — QA files never
round-trip through `serializeProjectMd`, so the task-format serializer can't pollute
the frontmatter or drop the document body. Edits are written directly to disk via the
same debounced `writeFile` path used by the Monaco editor (`useViewMode.handleEditorChange`).

**Find & replace** (`Cmd+F`): `src/lib/qa-find.ts` + `src/components/QaFindBar.tsx`, hosted
by `QaLayout`. Because the view is many independent mount-once Milkdown editors, find runs
in two representations: **find/highlight operates on the rendered DOM** via the CSS Custom
Highlight API (`CSS.highlights` + `Range` — zero DOM mutation, safe with ProseMirror), while
**replace operates on the markdown source strings** in `QaLayout`'s parsed state. Each editor
region carries a `data-qa-field` attribute (`header` | `block-<i>-left` | `block-<i>-right`) so
a DOM match maps back to its source field; replace edits that field and bumps `mountKey` to
remount the affected editor (commit alone wouldn't refresh the mount-once Crepe DOM). For plain
prose the two representations align 1:1; a query overlapping markdown syntax (e.g. inside
`**bold**`) can diverge in count. Highlighting needs WKWebView/Safari 17.2+; navigation and
replace still work without it.

## Architecture Notes

- **Auto-generated IDs**: When a markdown file has no `id` column, the parser auto-assigns sequential IDs (`"001"`, `"002"`, ...) so AG Grid always has unique row keys. These IDs get serialized back on save.
- **Data flow**: Markdown file → gray-matter parse → AG Grid/Tiptap → serialize back → atomic file write
- **Atomic writes**: Write to `.tmp` file, then rename (prevents corruption)
- **File watcher**: Rust `notify` + `notify-debouncer-full` watch a directory recursively, filter out `.tmp` and noise dirs (`.git`/`node_modules`), coalesce event bursts (300ms, never dropping distinct events — VS Code-style), and emit `"file-changed"` events to React via Tauri. All file types are surfaced (not just `.md`) so the workspace tree and non-markdown editors stay in sync. Coverage is idempotent: `lib.rs` `ensure_watching` canonicalizes a dir and dedups via `AppState.watched_dirs`, so the workspace root (recursive), restored-session dirs, and each opened file's directory each get exactly one watcher. The frontend opens every file through `useTabManagement.openPath`, which canonicalizes the path (so it matches the watcher's realpath events) and calls `start_watching` on its dir unless it's already under the workspace root — this is what makes an open doc reliably auto-reload (clean buffer) or raise a conflict (dirty buffer) regardless of how it was opened. `Cmd+R` is the manual reload (markdown via `loadFile`, raw/image via `useRawFile.reload`)
- **Save debounce**: 300ms debounce on React side
- **Disk reconciliation** (`src/hooks/useFileSync.ts`): NoteHub is meant to be co-edited with Claude Code writing the same `.md`. Per path it tracks a **baseline** (the exact bytes last read/written = "what's on disk") and a **dirty** flag. The model mirrors VS Code/IntelliJ: disk is the source of truth.
  - **Echo suppression is content-based** (not a timer): on a `file-changed` event, `reconcile` re-reads disk; if it equals the baseline it's our own write → ignored. (The old 1-second `writeLock` was removed — a timer could swallow a concurrent external write that landed within the window.)
  - **Clean buffer + external change → live auto-reload** (VS Code style): `reconcile` calls `loadFile` and the editor updates instantly.
  - **Dirty buffer + external change → conflict**: a blocking **`ConflictModal`** (Keep disk / Keep mine) — NoteHub never silently discards either side (IntelliJ "File Cache Conflict").
  - **Single write chokepoint**: all watched-file writes go through `guardedWrite`, which re-reads disk first and raises a conflict instead of clobbering an external change — this is what stops the 300ms autosave from overwriting Claude when the debounce races the watcher. Every load/write updates the baseline.
- **Browser fallback**: Runs without Tauri using `sample-project.md` for UI testing
- **Dark mode**: Class-based (`dark` class), AG Grid + Tailwind themed

## Keyboard Shortcuts

- `Cmd+R` — Reload file
- `Cmd+F` — Focus filter
- `Cmd+N` — New task
- `Cmd+S` — Save (Save As for untitled)
- `Cmd+/` — Toggle raw markdown editor (formatted WYSIWYG ↔ raw for `layout: qa`)
- `Cmd+F` — In the task view, focus the filter (Toolbar). In the `layout: qa` view, open the
  Find & replace bar (whole-document search; `Enter`/`Shift+Enter` navigate, `Esc` closes).
- `Cmd+P` — Print the `layout: qa` doc (compact cheatsheet, letter size, two columns + diagrams).
  WKWebView has no working `window.print()`, so `src/lib/print.ts` renders the markdown to a
  self-contained HTML (via `marked` + light-theme mermaid) and the Rust `print_html` command
  writes it to a temp file and opens it in the default browser to print. The doc `<title>` and
  the temp file's basename are both set to the source `.md` file name (no dir/extension), so
  the browser's "Save as PDF" defaults to a name consistent with the file on disk.
- `Cmd+B` — Toggle the workspace file-tree sidebar
- `Cmd+1-9` — Switch tabs
- `Ctrl+`` `` — Toggle terminal
- `Cmd+D` — Split the active terminal pane side-by-side (only when terminal focused)
- `Escape` — Close detail drawer

## Integrated Terminal — tabs & split panes

The terminal panel supports multiple terminals, like Claude Code / Zed / iTerm2. The
backend (`src-tauri/src/terminal.rs`) is already multi-session — `TerminalState` keeps a
`Mutex<HashMap<u32, TerminalSession>>` and every command/event is keyed by `session_id`;
the tab/split feature is purely frontend.

- **`src/components/TerminalView.tsx`** owns exactly one xterm instance + one PTY session
  (spawn on mount, `terminal-output`/`terminal-exit` listeners filtered by its session id,
  `FitAddon` + `ResizeObserver` refit, `killTerminal` + dispose on unmount).
- **`src/components/TerminalPanel.tsx`** is the manager. State is `tabs: TermTab[]`, where
  `TermTab = { id, title, panes: TermPane[] }` and `TermPane = { id, weight }`. It tracks
  `activeTabId` and `activePaneId`. Client-side string ids (`t1`, `t2`, …) are the React
  `key`s and are independent of backend session ids.
  - **`+` icon** → `addTab()`: a new tab ("Terminal N") with one pane.
  - **split icon / `Cmd+D`** → `splitActivePane()`: appends a pane to the active tab; panes
    render in a `flex-direction: row` with a draggable `col-resize` divider that trades
    `weight` between the two flanking panes.
  - **Every tab stays mounted** (visibility via `display`, never unmounted) so background
    terminals keep running and retain scrollback.
  - Closing the last pane closes the tab; closing the last tab leaves one fresh tab. A
    pane whose shell exits (`terminal-exit`) auto-closes via `onExit`.
  - `Cmd+D` is handled by a local listener gated on `panelRootRef.contains(activeElement)`
    so it never hijacks Cmd+D from the editor/grid.

## Workspace folders & the file-tree sidebar

NoteHub can open a **folder as a project**: a collapsible left sidebar (`Cmd+B`, shown by default
for discoverability) shows a file tree, and clicking any file opens it in a tab. **One workspace
folder per window** — opening a *different* folder spawns a new OS window (VS Code "Open Folder in
New Window"); re-opening the same folder focuses the window that already owns it. Opening a folder
never disturbs existing tabs.

Three entry points: the sidebar **Open Folder** button (`openFolderDialog`), **dragging a folder
into the window** (`useTabManagement` drag-drop splits dirs from files via the `is_directory`
command, routing dirs to `onOpenFolder`), and **dropping a folder on the Dock icon**
(`RunEvent::Opened` → emits `open-folder`, which `useWorkspace` listens for). Dock folder drops
need the `CFBundleDocumentTypes` entry in `src-tauri/Info.plist` (merged into the bundle) and only
work in a packaged build. The workspace root is watched recursively (`startWatching`) so every
tree file live-reloads on external edits.

- **Backend (`src-tauri/src/commands.rs`)**:
  - `read_dir(path)` → `Vec<DirEntryInfo { name, path, is_dir }>`, one level deep (the tree
    lazy-loads children on expand). Sorted dirs-first/case-insensitive (`sort_dir_entries`);
    noise dirs (`.git`, `node_modules`, `.DS_Store` via `is_noise_dir`) are hidden. Dotfiles in
    general are *not* hidden.
  - `read_text_file(path)` → file text, or `Err("binary")` for non-text files (NUL-byte
    heuristic, `looks_binary`). Distinct from `read_file` (the markdown editors' path, unchanged).
  - `open_workspace_window(folder)` spawns a `workspace-{n}` window (or focuses an existing one
    via `find_window_for_workspace`), recording `label -> canonical(folder)` in
    `AppState.workspace_windows`. The new window fetches its root via `get_window_workspace`.
  - `set_workspace_root(path)` records a folder adopted in-place (so dedup works). `save_session`
    persists `workspaceRoot` in `session.json`; `reconcile_session` drops it if the dir is gone.
  - **Capabilities** (`capabilities/default.json`) apply to `["main", "workspace-*"]` — spawned
    windows would otherwise have zero permissions. Inline image preview needs the asset protocol
    (`tauri.conf.json` `app.security.assetProtocol` + the `protocol-asset` Cargo feature).
  - The **watcher** (`watcher.rs` `should_skip_path`) now surfaces *all* file types (not just
    `.md`) so non-markdown editors reload too, still skipping `.tmp` and noise dirs.
- **Frontend**:
  - `useWorkspace.ts` owns the window's `workspaceRoot` (from `get_window_workspace`, falling
    back to the persisted session) plus sidebar open/width (localStorage `nh-sidebar-open` /
    `nh-sidebar-width`). `openFolder()` adopts the first folder or opens another window.
  - `Sidebar.tsx` + `FileTree.tsx`: resizable panel (drag handle mirrors `TerminalPanel`'s) and a
    lazy recursive tree; clicking a file calls `useTabManagement.openPath` (dedupes, focuses).
  - **Tree auto-refresh** (`tree-refresh.ts`, VS Code model): each loaded directory subscribes by
    its path to a shared `file-changed` listener and re-reads itself when something is
    created/deleted/renamed inside it. The Rust watcher uses `notify-debouncer-full` to *coalesce*
    bursts and emit every distinct event (it never drops events), and the workspace root is
    canonicalized so realpath events match tree paths — so the tree stays fresh from the watcher
    alone. A manual **Refresh** button (`refreshAllDirs`) re-reads all loaded dirs on demand.
  - **File routing by extension** (`file-kind.ts` `fileKindForPath`): `.md/.mdx` → `markdown`
    (existing grid/qa/plain views); images → `image`; everything else → `raw`. Each `TabInfo`
    carries its `kind`. In `App.tsx`, raw/image tabs render `RawFileEditor` (the markdown pipeline
    is gated off with `useProjectFile(isRawFile ? null : activeFilePath, …)`).
  - `RawFileEditor.tsx`: raw text files open in Monaco (editable, autosaved via `useRawFile` +
    the shared `FileSync` conflict machinery; language from `languageForPath`); images render
    inline via `convertFileSrc`; other binaries show an "is binary" placeholder.

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
