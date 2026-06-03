# NoteHub

Markdown-native desktop task manager built with **Tauri v2 + React + AG Grid**. Markdown files are the single source of truth.

## Quick Start

```bash
npm install
npm run dev           # Browser-only (Vite on port 1420)
npm run dev:tauri     # Full desktop app
npm run build:tauri   # Build native installer
```

## Markdown File Format

Each `.md` project file has three sections:

### 1. YAML Frontmatter (configuration)

```yaml
---
project: "My Project"
created: "2025-09-22"
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
```

` ```mermaid ` code blocks render as live diagrams in the formatted view. **Click a
diagram** to edit its source inline (Esc cancels, Cmd/Ctrl+Enter confirms); you can also
edit the raw fence via the raw editor. Tables render inline too.

- Everything before the first `**>>>**` becomes a full-width header.
- Text between `**>>>**` and `**<<<**` is the **left** column.
- Text after `**<<<**` (until the next `**>>>**`) is the **right** column.
- Stack multiple `**>>>**`/`**<<<**` blocks for multiple Q&A rows.
- A file with no markers is just one full-width editor.

Press `Cmd+/` to switch between the formatted editor and the raw markdown code editor.
Press `Cmd+F` to open the find & replace bar — it searches the whole document (header
plus every question/answer column), highlights matches, navigates with `Enter` /
`Shift+Enter`, and can replace the current match or all of them. `Esc` closes it.
Press `Cmd+P` (or the **Print** button) to print the document as a compact, cheatsheet-style
handout on letter-size pages — the two-column layout and mermaid diagrams are preserved. When
you "Save as PDF", the default file name matches the source markdown file.

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
- **You're mid-edit when the file also changes on disk → NoteHub asks.** A
  *"File changed on disk"* dialog lets you **Keep disk** (take the external version) or
  **Keep mine** (overwrite it with your version). Your work is never silently discarded,
  and NoteHub never silently overwrites an external change.

Your own edits autosave (300ms debounce) and never trigger a false "changed on disk"
prompt.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New task |
| `Cmd+F` | Focus filter (task view) · Find & replace (`layout: qa` view) |
| `Cmd+R` | Reload file |
| `Cmd+S` | Save (or Save As for untitled) |
| `Cmd+/` | Toggle raw markdown editor (formatted ↔ raw for `layout: qa`) |
| `Cmd+P` | Print the QA doc (compact cheatsheet, letter size) |
| `Cmd+1-9` | Switch tabs |
| `Ctrl+`` `` | Toggle terminal |
| `Cmd+D` | Split the active terminal pane side-by-side |
| `Escape` | Close detail drawer |

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation.
