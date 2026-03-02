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

## Custom Fields

Any field added to `columns` in frontmatter automatically appears as a column. By default, custom fields render as plain text. Use the `type` property to get richer rendering:

| Type | Renders as | Editor | Notes |
|------|-----------|--------|-------|
| `text` | Plain text | Text input | Default for unknown fields |
| `select` | Colored pill/badge | Dropdown | Requires `*_options` list in frontmatter |
| `date` | Formatted date | Text input | e.g. `2025-12-01` |
| `tags` | Colored tag pills | Comma-separated input | Stored as `tag1, tag2` in table |

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

## Architecture

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation.
