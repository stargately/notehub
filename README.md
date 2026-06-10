# NoteHub

Markdown-native desktop task manager built with **Tauri v2 + React + AG Grid**. Markdown files are the single source of truth.

## Quick Start

```bash
npm install
npm run dev           # Browser-only (Vite on port 1420)
npm run dev:tauri     # Full desktop app
npm run build:tauri   # Build native installer
```

## Testing

```bash
npm test              # Run everything: vitest (frontend) + cargo test (Rust backend)
npm run test:js       # Frontend unit tests only
npm run test:rust     # Rust backend tests only
```

`npm test` runs the frontend `vitest` suite and the Rust `cargo test` suite. The same checks —
plus `cargo clippy` and `cargo fmt --check` — run in CI (`.github/workflows/ci.yml`) on every
push and pull request.

## Document Layouts

The `layout` field in a file's frontmatter chooses the view:

| `layout` | View |
|----------|------|
| `todo` | The AG Grid **task table** (see *Task Layout* below). |
| `qa` | A two-column **Q&A document** (see *Q&A Layout* below). |
| _omitted / other_ | A **plain markdown** document — one formatted WYSIWYG editor, `Cmd+/` for raw. |

> **Heads up:** the task table now requires `layout: todo`. A file without it (even one with a
> `## Tasks` table) opens as a plain markdown document — add `layout: todo` to get the grid back.
> Your content is never lost either way.

## Task Layout (`layout: todo`)

A task-table file sets `layout: todo` and has three sections:

### 1. YAML Frontmatter (configuration)

```yaml
---
project: "My Project"
created: "2025-09-22"
layout: todo
columns:
  - field: title
    width: 400
  - field: status
    width: 120
  - field: milestone
    width: 180
    type: select
  - field: deadline
    width: 120
    type: date
  - field: labels
    width: 200
    type: tags
status_options: [todo, in_progress, done]
milestone_options: [v1.0, v1.1, v2.0]
---
```

### 2. Tasks Table

The `id` column is optional. If omitted, NoteHub auto-generates sequential IDs (`001`, `002`, ...) on first load and saves them back to the file.

```markdown
## Tasks

| Id | Title | Status | Milestone | Deadline | Labels |
| --- | --- | --- | --- | --- | --- |
| 001 | Build feature | todo | v1.0 | 2025-12-01 | frontend, ui |
```

### 3. Task Details & Notes (optional)

```markdown
## Task Details

### tid-001
<p>Rich HTML description for task 001</p>

## Notes
<p>Project-wide notes</p>
```

## Q&A Layout (`layout: qa`)

Set `layout: qa` in a file's frontmatter to turn it into a document instead of a task
table. The content is shown in a **Typora-style WYSIWYG editor** (formatted as you type),
and you can split it into two columns using marker lines:

```markdown
---
layout: qa
---

Intro text before the first marker spans the full width.

**>>>**
What's the question? (shows on the left)
**<<<**
The answer, notes, tables, and ```mermaid diagrams — shows on the right.
**===**
Optional full-width note after the answer (spans both columns).
```

` ```mermaid ` code blocks render as live diagrams in the formatted view. **Click a
diagram** to edit its source inline (Esc cancels, Cmd/Ctrl+Enter confirms); you can also
edit the raw fence via the raw editor. Tables render inline too.

- Everything before the first `**>>>**` becomes a full-width header.
- Text between `**>>>**` and `**<<<**` is the **left** column.
- Text after `**<<<**` (until the next `**>>>**`) is the **right** column.
- Optionally end an answer early with `**===**`: text after it (until the next `**>>>**` or end
  of file) becomes a full-width band below the row — handy for a note or divider between topics.
- Stack multiple `**>>>**`/`**<<<**` blocks for multiple Q&A rows.
- A file with no markers is just one full-width editor.

Press `Cmd+/` to switch between the formatted editor and the raw markdown code editor.
Press `Cmd+Shift+V` to **paste as plain text** — the clipboard is inserted as literal,
unformatted characters with no markdown interpretation (`# foo` stays `# foo`, never a heading),
just like Typora's "Paste as Plain Text". Plain `Cmd+V` keeps its formatted, markdown-aware paste.
Press `Cmd+F` to open the find & replace bar — it searches the whole document (header
plus every question/answer column), highlights matches, navigates with `Enter` /
`Shift+Enter`, and can replace the current match or all of them. `Esc` closes it.
Press `Cmd+Shift+P` (or the **Print** button) to print the document as a compact, cheatsheet-style
handout on letter-size pages — the two-column layout and mermaid diagrams are preserved. When
you "Save as PDF", the default file name matches the source markdown file.

## Plain Markdown

Open any ordinary `.md` file — one with **no `layout` field** — and NoteHub shows it as a single
**full-width WYSIWYG editor** (the same Typora-style editor used by the Q&A layout). Mermaid
diagrams and tables render inline, and `Cmd+/` toggles to the raw markdown code editor. Edits are
auto-saved to the file; the frontmatter (if any) is preserved verbatim. This makes NoteHub a
comfortable editor for notes, READMEs, and docs — not just task lists.

### What the WYSIWYG editor can do

The formatted editor (used by both the Q&A and plain-markdown views) is a full Typora-style
rich-text surface — not just bold/italic. Everything below works as you type and round-trips to
plain markdown on save:

- **Slash menu** — type `/` on an empty line for a block picker (headings, lists, quote, code, table,
  divider, image, math).
- **Selection toolbar** — select text to get a floating toolbar (bold, italic, strikethrough, code,
  link).
- **Block drag handle** — hover the left gutter for a `⠿` handle to drag a block or open its menu.
- **Math (KaTeX)** — inline `$x^2$` and block `$$…$$` render as typeset math.
- **Task lists** — `- [ ]` / `- [x]` become clickable checkboxes.
- **Tables** — full editing with row/column add-remove and per-column alignment.
- **Code blocks** — fenced code with syntax highlighting and a language picker.
- **Links** — a tooltip to open, edit, copy, or remove a link.
- **Mermaid diagrams** — ` ```mermaid ` fences render live (click to edit the source inline).
- **Images** — paste an image from the clipboard (`Cmd+V`) or drag-drop an image file into the
  editor and NoteHub saves it to disk and inserts it (see below). Existing `![](…)` links render
  inline, including **relative** links that point inside your workspace.

### Images — paste & drag-drop to disk

Paste a screenshot (`Cmd+V`) or drag an image file into the WYSIWYG editor and NoteHub:

1. writes the image into a sibling **`assets/`** folder next to the document (a non-clobbering name
   is chosen, e.g. `pasted-image.png`, then `pasted-image-1.png`, …), and
2. inserts a **relative** `![](assets/pasted-image.png)` link at the cursor / drop point.

Because the link is relative, the markdown stays **portable** — move the document and its `assets/`
folder together and the image still resolves. The editor renders relative/local image links inline
(they resolve against the document's directory); the saved markdown keeps the original relative path.
The image upload button and "paste link" flow write to the same `assets/` folder.

> An **untitled** (never-saved) document has no folder to anchor relative assets to, so save the file
> first — until then a pasted image shows from a temporary in-memory URL that won't survive a reload.

All of this chrome follows the app theme — slash menu, toolbars, and tooltips are themed for both
light and dark mode. The same rich editing (including task-list checkboxes) is available in the task
detail drawer's description field.

## Custom Fields

Any field added to `columns` in frontmatter automatically appears as a column. By default, custom fields render as plain text. Use the `type` property to get richer rendering:

| Type | Renders as | Editor | Notes |
|------|-----------|--------|-------|
| `text` | Plain text | Text input | Default for unknown fields |
| `select` | Colored pill/badge | Dropdown | Requires `*_options` list in frontmatter |
| `date` | Formatted date | Text input | e.g. `2025-12-01` |
| `tags` | Colored tag pills | Comma-separated input | Stored as `tag1, tag2` in table |
| `url` | Clickable link | Text input | Opens in default browser |

### The `*_options` Convention

For any select-type field, define its options with `<fieldname>_options` in frontmatter:

```yaml
milestone_options: [v1.0, v1.1, v2.0]
priority_options: [urgent, high, medium, low]
```

This automatically creates a dropdown editor for that field. Works for both built-in fields (`status`, `priority`, `assignee`) and custom fields.

### Type Inference

Built-in fields have their types inferred automatically — you only need `type` for custom fields:

- `status`, `priority`, `assignee` infer as `select`
- `due`, `created`, `done` infer as `date`
- `tags` infers as `tags`

## Workspace Folders & File Tree

Open a whole folder as a project, shown in a VS Code-style **file-tree sidebar** (`Cmd+B` toggles
it; drag its right edge to resize). Toggling it is smooth — the panel collapses in place without
flashing the window, your tree scroll + expanded folders survive the toggle, and the editor keeps
its vertical scroll position even though the document reflows to the new width. Three ways to open a
folder:

- Click **Open Folder** in the sidebar (the folder button in its header, or the big button when no
  folder is open yet — the sidebar is shown by default).
- **Drag a folder into the window.**
- **Drag a folder onto the Dock icon** (packaged app).

Click any file in the tree to open it in a tab:

- **Markdown** (`.md`/`.mdx`) opens in its usual view (task grid, Q&A, or plain WYSIWYG).
- **Other text files** (code, config, `.txt`, …) open in an editable code editor and autosave just
  like markdown, with the same conflict-safe disk reconciliation.
- **Images** (png, jpg, gif, svg, webp, …) render inline; other binaries show a placeholder.

The tree shows everything except noise directories (`.git`, `node_modules`, `.DS_Store`). It's
**one folder per window** — opening a *different* folder opens a new window (your current tabs stay
put), and re-opening a folder already open just focuses its window. The last folder is remembered
and reopened on launch. Requires the desktop app (Tauri).

**Tear a tab into its own window:** drag a tab out of the window and drop it anywhere outside — the
document moves into a new window (just like Zed or a browser). Drop it back inside to cancel.

## Status Bar

A thin **status bar** runs along the bottom of the window (Zed-style), gathering the window's
layout-level toggles in one place:

- **Sidebar** — show/hide the file-tree sidebar (same as `Cmd+B`).
- **Terminal** — show/hide the integrated terminal (same as `` Ctrl+` ``).
- **Theme** (right edge) — cycle Light → Dark → System; the label shows the current mode.

Active panels are tinted with the accent color. The current workspace folder name sits next to the
panel toggles as a quick reminder of where you are.

### The File menu

NoteHub uses the **native OS menu bar** (the macOS top-of-screen menu, Zed-style). Its **File** menu
collects the common file actions: **New File**, **New Folder**, **Open File…** (`⌘O`), **Open
Folder…**, **Quick Open…** (`⌘P`), **Save** (`⌘S`), and **Refresh File Tree** — plus **Close**
(`⌘W`), which closes the active tab and only closes the window once no tabs remain (Zed/VS Code-style),
and the standard **Edit** menu (Copy/Paste/Undo/Redo). Items grey out when they don't
apply (Save with no open document; New File / New Folder / Refresh until a folder is open), tracking
whichever window is focused.

### Managing files in the tree

Right-click any file or folder (or use the **File** menu above) to manage files like in Zed/VS Code:

- **New File / New Folder** — type the name inline in the tree; a new `.md` opens immediately as a
  plain markdown document.
- **Rename** — inline edit with the basename pre-selected (the extension is left untouched). Any
  open tab for the file (or files inside a renamed folder) follows the new path automatically.
- **Delete** — moves the item to the **OS Trash** (recoverable from Finder), after a confirmation.
  Any open tab for it closes.
- **Reveal in Finder** / **Copy Path** — locate the file in the OS file manager, or copy its path.

### Quick open (`Cmd+P`)

Press `Cmd+P` for a fuzzy **quick-open** finder over every file in the workspace — start typing to
filter by name or path (matched characters are highlighted), use `↑`/`↓` to move and `Enter` to
open, `Esc` to dismiss. With an empty query it lists your open and recently-opened files. The index
is **gitignore-aware** (like Zed): files matched by `.gitignore`/`.ignore` are excluded.

## Integrated Terminal

Press `Ctrl+`` `` to toggle a VS Code-style terminal panel at the bottom of the app. The terminal opens in the active file's directory and persists its session when hidden. Requires the desktop app (Tauri).

Run several terminals at once, like Claude Code / Zed / iTerm2:

- **`+` (new tab)** — opens a completely separate terminal in its own tab; click a tab to
  switch. Each tab keeps running (and keeps its scrollback) while hidden.
- **Split icon / `Cmd+D`** — splits the current tab into side-by-side panes, each its own
  shell. Drag the divider between panes to resize them.

Close a tab or pane with its `×`. A pane whose shell exits (`exit`) closes itself; the last
remaining tab is always kept.

## Live Sync with External Edits

Markdown files are the single source of truth, so NoteHub is built to be edited at the
same time as another tool — for example Claude Code writing the same `.md` file. The disk
is always authoritative:

- **You're not editing → the file updates live.** When something else writes the file,
  NoteHub reloads it instantly so you can watch the changes appear.
- **You have genuinely diverging unsaved edits when the file also changes on disk →
  NoteHub asks.** A *"File changed on disk"* dialog lets you **Keep disk** (take the
  external version) or **Keep mine** (overwrite it with your version). Your work is never
  silently discarded, and NoteHub never silently overwrites an external change.

The prompt is **content-truthful**: it only appears when your in-memory version actually
differs from *both* the last-synced version *and* the new version on disk. If you're just
viewing a file (not actively editing it) when the other tool rewrites it, NoteHub reloads
the latest disk version silently — no dialog — for **every** document type, task tables
included. Likewise if the other tool just wrote the same content you already have, or your
editor re-saved the file unchanged. Your own edits autosave (300ms debounce) and never
trigger a false "changed on disk" prompt.

## Keyboard Shortcuts

Shortcuts are driven by a **Zed-style keymap** — keystrokes map to actions within contexts (the
same key can do different things in the task grid vs. the markdown editor). Open **File → Keyboard
Shortcuts…** to see the full list and **remap anything**: add a JSON block of overrides (layered
over the defaults; chords like `mod-k mod-s` and `null`-to-unbind are supported), saved locally.

The defaults:

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New task |
| `Cmd+O` | Open file (OS dialog) |
| `Cmd+F` | Focus filter (task view) · Find & replace (`layout: qa` / plain markdown view) |
| `Cmd+R` | Reload file |
| `Cmd+S` | Save (or Save As for untitled) |
| `Cmd+/` | Toggle raw markdown editor (formatted ↔ raw for `layout: qa` and plain markdown files) |
| `Cmd+Shift+V` | Paste as plain text — insert the clipboard as literal, unformatted text (Typora-style) in the WYSIWYG editors |
| `Cmd+P` | Quick-open: fuzzy file finder over the workspace |
| `Cmd+Shift+P` | Print the QA doc (compact cheatsheet, letter size) |
| `Cmd+B` | Toggle the workspace file-tree sidebar |
| `Cmd+1-9` | Switch tabs |
| `Cmd+W` | Close the active tab (closes the window when no tabs remain, Zed/VS Code-style) |
| `Ctrl+`` `` | Toggle terminal |
| `Cmd+D` | Split the active terminal pane side-by-side |
| `Escape` | Close detail drawer |

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation.
