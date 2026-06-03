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
│   │   ├── MarkdownEditor.tsx  # Raw markdown textarea editor
│   │   ├── cell-renderers/     # AG Grid display components
│   │   └── cell-editors/       # AG Grid edit components
│   ├── hooks/
│   │   ├── useProjectFile.ts   # File load/parse/save logic
│   │   └── useFileWatcher.ts   # External change detection
│   ├── lib/
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── markdown-parser.ts  # YAML frontmatter + table parser
│   │   ├── qa-parser.ts        # layout: qa marker parser (>>>/<<<)
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
| File Watch | notify 7 (Rust), 500ms debounce |

## Commands

```bash
npm run dev           # Vite dev server (port 1420)
npm run dev:tauri     # Full Tauri dev environment
npm run build         # TypeScript + Vite production build
npm run build:tauri   # Build native app (creates installer)
npm run preview       # Preview production build
npm run kill          # Kill port 1420
```

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
- **File watcher**: Rust `notify` crate watches `.md` files, filters out `.tmp`/`.git`, emits `"file-changed"` events to React via Tauri
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
