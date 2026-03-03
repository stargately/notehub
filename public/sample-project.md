---
project: NoteHub Demo Project
created: 2026-01-15T00:00:00.000Z
views:
  default:
    group_by: status
    sort_by: priority
    sort_order: desc
columns:
  - field: id
    width: 60
  - field: title
    width: 300
  - field: status
    width: 110
  - field: priority
    width: 100
  - field: assignee
    width: 100
  - field: due
    width: 110
  - field: tags
    width: 180
  - field: link
    width: 200
    type: url
  - field: sprint
    width: 100
    type: select
  - field: created
    width: 110
  - field: done
    width: 110
status_options:
  - todo
  - in_progress
  - in_review
  - done
  - blocked
priority_options:
  - urgent
  - high
  - medium
  - low
assignee_options:
  - Alice
  - Bob
  - Charlie
sprint_options:
  - Sprint 1
  - Sprint 2
  - Sprint 3
  - Backlog
---

# NoteHub Demo Project

## Tasks

| Id | Title | Status | Priority | Assignee | Due | Tags | Link | Sprint | Created | Done |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 001 | Set up project scaffolding | done | high | Alice | 2026-01-20 | setup, infra | https://github.com/example/notehub/pull/1 | Sprint 1 | 2026-01-15 | 2026-01-19 |
| 002 | Design database schema | done | high | Bob | 2026-01-22 | backend, database | https://dbdiagram.io/d/notehub-schema | Sprint 1 | 2026-01-15 | 2026-01-21 |
| 003 | Implement user authentication | done | urgent | Alice | 2026-01-25 | backend, auth, security | https://github.com/example/notehub/pull/5 | Sprint 1 | 2026-01-16 | 2026-01-24 |
| 004 | Build task list UI component | done | high | Charlie | 2026-01-28 | frontend, ui | https://www.figma.com/file/abc123/task-list | Sprint 1 | 2026-01-17 | 2026-01-27 |
| 005 | Add markdown parser | in_review | high | Bob | 2026-02-05 | frontend, parsing | https://github.com/example/notehub/pull/12 | Sprint 2 | 2026-01-20 | |
| 006 | File watcher integration | in_progress | high | Alice | 2026-02-10 | backend, filesystem | https://docs.rs/notify/latest/notify/ | Sprint 2 | 2026-01-22 | |
| 007 | Keyboard shortcuts system | in_progress | medium | Charlie | 2026-02-12 | frontend, ux | | Sprint 2 | 2026-01-25 | |
| 008 | Dark mode support | todo | medium | Charlie | 2026-02-15 | frontend, ui, theming | | Sprint 2 | 2026-01-28 | |
| 009 | Export to PDF | todo | low | | 2026-02-20 | feature, export | | Sprint 3 | 2026-01-30 | |
| 010 | Real-time collaboration | todo | high | | 2026-03-01 | feature, networking | https://yjs.dev/ | Sprint 3 | 2026-02-01 | |
| 011 | Performance audit | blocked | urgent | Bob | 2026-02-08 | perf, testing | https://pagespeed.web.dev/ | Sprint 2 | 2026-01-23 | |
| 012 | Write API documentation | in_progress | medium | Bob | 2026-02-14 | docs, api | https://swagger.io/specification/ | Sprint 2 | 2026-02-01 | |
| 013 | Mobile responsive layout | todo | high | Charlie | 2026-02-18 | frontend, mobile, ui | | Sprint 3 | 2026-02-03 | |
| 014 | CI/CD pipeline setup | done | urgent | Alice | 2026-01-30 | infra, devops | https://github.com/example/notehub/actions | Sprint 1 | 2026-01-18 | 2026-01-29 |
| 015 | Add search functionality | in_review | medium | Alice | 2026-02-07 | feature, search | https://github.com/example/notehub/pull/18 | Sprint 2 | 2026-01-26 | |
| 016 | Drag and drop task reordering | todo | low | | 2026-03-05 | frontend, ux | https://dndkit.com/ | Backlog | 2026-02-05 | |
| 017 | Plugin system architecture | todo | medium | | 2026-03-15 | architecture, extensibility | | Backlog | 2026-02-10 | |
| 018 | Automated backup system | blocked | high | Bob | 2026-02-12 | backend, reliability | | Sprint 2 | 2026-02-02 | |

## Task Details

### tid-003
<p>Implement JWT-based authentication with refresh tokens. Must support:</p>
<ul>
<li>Email/password sign-up and login</li>
<li>OAuth2 integration (Google, GitHub)</li>
<li>Session management with secure httpOnly cookies</li>
<li>Rate limiting on auth endpoints</li>
</ul>
<p>Reference the <a href="https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html">OWASP Auth Cheat Sheet</a> for security best practices.</p>

### tid-006
<p>Integrate the Rust <code>notify</code> crate to watch for file system changes on open markdown files. Requirements:</p>
<ul>
<li>500ms debounce to avoid rapid re-renders</li>
<li>Write lock mechanism to prevent re-triggering on our own saves</li>
<li>Filter out <code>.tmp</code>, <code>.git</code>, and <code>.notehub</code> files</li>
<li>Emit events to the React frontend via Tauri IPC</li>
</ul>

### tid-011
<p>Performance is degrading on files with 500+ tasks. Investigate and fix:</p>
<ul>
<li>Profile AG Grid render cycles — possible unnecessary re-renders</li>
<li>Check markdown parser for O(n²) patterns</li>
<li>Measure file write latency with large documents</li>
<li>Consider virtual scrolling if not already enabled</li>
</ul>
<p><strong>Blocked by:</strong> Waiting for task #005 (markdown parser) to land so we have a stable baseline to benchmark against.</p>

## Notes
<p>NoteHub is a markdown-native desktop task manager. This sample project demonstrates all supported field types:</p>
<ul>
<li><strong>Text</strong> — id, title (plain text fields)</li>
<li><strong>Select</strong> — status, priority, assignee, sprint (dropdown with options)</li>
<li><strong>Date</strong> — due, created, done (date picker)</li>
<li><strong>Tags</strong> — tags (comma-separated colored pills)</li>
<li><strong>URL</strong> — link (clickable links with open arrow)</li>
</ul>
<p>Edit any cell to try it out. Changes are saved back to the markdown file automatically.</p>
