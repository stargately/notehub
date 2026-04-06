# NoteHub Roadmap

> Markdown is the database. The file system is the server. The developer is the user.

## Vision

NoteHub is the task manager developers actually want — local-first, markdown-native, AI-friendly, zero cloud dependencies. Every `.md` file is readable by humans, editable in any text editor, and version-controllable with git. We don't compete with Jira. We replace the 15 browser tabs of Linear + Notion + terminal + notes app with one window.

---

## Tier 0: Ship-Ready Polish

_Before we tell anyone about this, these need to work._

- [x] **Auto-update mechanism** — Tauri updater plugin, check on launch, notify + one-click install
- [x] **Error toast system** — surface parse errors, file write failures, and watcher issues as dismissible toasts (not console.log)
- [x] **Crash recovery** — detect unclean shutdown, offer to restore last-known-good state from `.notehub/backups/`
- [ ] **Onboarding flow** — first launch creates a sample project that teaches the markdown format, keyboard shortcuts, and terminal
- [x] **App icon & branding** — proper macOS icon, DMG background, menu bar identity
- [ ] **Release pipeline** — GitHub Actions: build macOS (universal), sign + notarize, publish to GitHub Releases
- [ ] **Homebrew cask** — `brew install --cask notehub`
- [ ] **Landing page** — single page site: hero demo GIF, "download for macOS", feature bullets, GitHub link

---

## Tier 1: Developer Delight

_The features that make a developer say "finally, someone gets it."_

- [ ] **Git status indicators** — show modified/untracked/committed status per file tab (colored dot)
- [ ] **Git diff in markdown editor** — inline gutter diff against last commit
- [ ] **Quick commit from app** — `Cmd+Shift+S` to stage + commit the current file with a message
- [ ] **AI task generation** — paste a PRD or spec, AI extracts tasks into the table (local LLM or API key)
- [ ] **AI task breakdown** — select a task, "break down" generates subtasks in markdown
- [ ] **Smart paste** — paste a GitHub issue URL → auto-creates a task with title, link, and labels
- [ ] **Command palette** — `Cmd+K` opens fuzzy search across: files, tasks, actions, settings
- [ ] **Multiple sort** — sort by priority then due date (multi-column sort)
- [ ] **Saved views** — name and switch between filter/group/sort combinations (stored in frontmatter `views:`)
- [ ] **Column resize persistence** — save column widths back to frontmatter on drag
- [ ] **Relative dates** — show "tomorrow", "overdue 3d" instead of raw ISO dates
- [ ] **Overdue highlighting** — red badge on tasks past due date
- [ ] **Quick-add from anywhere** — global hotkey (e.g., `Ctrl+Space`) to capture a task to inbox file, even when app is in background

---

## Tier 2: Power Features

_For the developer who lives in NoteHub all day._

- [ ] **Subtasks** — nested task hierarchy via indentation in markdown table or sub-tables
- [ ] **Task dependencies** — `blocked_by: 003` field, visualize as simple DAG
- [ ] **Recurring tasks** — `recur: weekly` in frontmatter, auto-creates next instance on completion
- [ ] **Bulk operations** — multi-select rows → change status/priority/assignee for all
- [ ] **Bulk delete** — select multiple → delete with single confirmation
- [ ] **Kanban view** — drag cards between status columns, same markdown backend
- [ ] **Calendar view** — tasks plotted by due date on a month/week grid
- [ ] **Timeline / Gantt** — horizontal bars showing task duration (needs start + end dates)
- [ ] **Time tracking** — `estimated: 2h`, `actual: 3h` fields, simple start/stop timer in drawer
- [ ] **Task templates** — "New bug report", "New feature request" with pre-filled fields
- [ ] **Markdown preview pane** — side-by-side preview when in raw editor mode
- [ ] **Find & replace** — across current file's tasks (title, description)
- [ ] **Archiving** — move done tasks to `archive.md` to keep the main file lean
- [ ] **File bookmarks** — pin frequently used files to sidebar (beyond tab bar)

---

## Tier 3: Ecosystem & Growth

_Turning NoteHub from a tool into a platform._

- [ ] **Import from** — Linear, GitHub Issues, Todoist, Notion CSV → NoteHub markdown
- [ ] **Export to** — CSV, JSON, iCal (.ics for calendar apps), PDF (print-friendly)
- [ ] **Plugin system** — custom cell renderers, custom commands, custom views via JS plugins in `.notehub/plugins/`
- [ ] **Themes** — user-selectable color themes beyond light/dark (Catppuccin, Nord, Dracula, Solarized)
- [ ] **Custom keyboard shortcuts** — remap any shortcut in settings
- [ ] **Windows + Linux builds** — Tauri already supports these, just needs CI + testing
- [ ] **CLI companion** — `notehub add "Fix login bug" --priority=high --file=project.md` from terminal
- [ ] **Alfred / Raycast integration** — search tasks, quick-add from launcher
- [ ] **VS Code extension** — preview NoteHub grid inside VS Code panel
- [ ] **GitHub Action** — sync GitHub Issues ↔ NoteHub markdown in repo
- [ ] **Documentation site** — markdown format spec, plugin API, keyboard shortcuts reference

---

## Tier 4: Longer-Term Bets

_Things we believe in but aren't building yet._

- [ ] **Multi-device sync** — git-based sync (push/pull) or CRDT-based local-first sync (Automerge)
- [ ] **Shared projects** — real-time collaboration on the same markdown file (CRDT + WebSocket)
- [ ] **Mobile companion** — read-only iOS/Android app that renders the markdown, quick-add tasks
- [ ] **Notifications** — due date reminders via system notifications
- [ ] **Integrations marketplace** — community-built plugins (Slack, Calendar, Email)
- [ ] **Self-hosted sync server** — for teams that want sync without GitHub
- [ ] **Embedded AI agent** — "plan this sprint", "what should I work on next", "summarize progress this week"
- [ ] **Multi-language UI** — i18n support (English, Chinese, Japanese to start)

---

## Anti-Roadmap

_Things we will NOT build. These keep us focused._

- **Cloud-hosted version** — we are local-first, period. Sync yes, hosted no.
- **Proprietary file format** — markdown is the database forever. If we can't express it in `.md`, we don't build it.
- **Gantt chart editor** — view-only is fine, but we don't become a project management suite
- **Email/chat** — we integrate with these, we don't replace them
- **Mobile-first redesign** — desktop is the primary platform, mobile is a companion
- **User accounts / login** — no auth, no cloud, no tracking

---

## North Star Metrics

| Metric | Target | Why |
|--------|--------|-----|
| Time to first task | < 30 seconds | Open app → see tasks. No signup, no config. |
| Daily active files | 3+ per user | Measures real adoption, not just downloads |
| File round-trip fidelity | 100% | Open → edit → save must never corrupt or lose data |
| Keyboard-only usability | 100% of features | Every action reachable without mouse |
| Cold start time | < 1 second | Native app should feel instant |

---

## What's Next (This Month)

1. Error toast system (Tier 0)
2. Overdue highlighting + relative dates (Tier 1)
3. Command palette (Tier 1)
4. Release pipeline + Homebrew (Tier 0)
5. Landing page (Tier 0)
