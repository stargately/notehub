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
│   │   ├── Toolbar.tsx         # Filters, toggles, new task
│   │   ├── TabBar.tsx          # Multi-file tabs
│   │   ├── cell-renderers/     # AG Grid display components
│   │   └── cell-editors/       # AG Grid edit components
│   ├── hooks/
│   │   ├── useProjectFile.ts   # File load/parse/save logic
│   │   └── useFileWatcher.ts   # External change detection
│   ├── lib/
│   │   ├── types.ts            # TypeScript interfaces
│   │   ├── markdown-parser.ts  # YAML frontmatter + table parser
│   │   └── tauri-api.ts        # Tauri IPC bridge
│   └── styles/globals.css      # Tailwind + AG Grid theme
├── src-tauri/                  # Rust backend
│   └── src/
│       ├── main.rs             # Entry point
│       ├── lib.rs              # App init
│       ├── commands.rs         # IPC commands (read/write file)
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
| Styling | Tailwind CSS 3.4, `@tailwindcss/typography` |
| Parsing | gray-matter (YAML frontmatter) |
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

## Markdown File Format

Each `.md` file has three sections:

### 1. YAML Frontmatter

```yaml
---
project: "Project Name"
created: "2025-09-22T00:00:00.000Z"
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

## Architecture Notes

- **Data flow**: Markdown file → gray-matter parse → AG Grid/Tiptap → serialize back → atomic file write
- **Atomic writes**: Write to `.tmp` file, then rename (prevents corruption)
- **Write lock**: 1-second lock after writing prevents re-triggering own file change events
- **File watcher**: Rust `notify` crate watches `.md` files, filters out `.tmp`/`.git`/`.notehub`, emits `"file-changed"` events to React via Tauri
- **Save debounce**: 300ms debounce on React side
- **Browser fallback**: Runs without Tauri using `sample-project.md` for UI testing
- **Dark mode**: Class-based (`dark` class), AG Grid + Tailwind themed

## Keyboard Shortcuts

- `Cmd+R` — Reload file
- `Cmd+F` — Focus filter
- `Cmd+N` — New task
- `Cmd+1-9` — Switch tabs
- `Escape` — Close detail drawer

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
