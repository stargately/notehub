import { describe, it, expect } from "vitest";
import { parseMarkdownTable, serializeProjectMd, parseProjectMd } from "../markdown-parser";
import type { ColumnConfig, ProjectData } from "../types";

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { field: "id", width: 60 },
  { field: "title", width: 300 },
  { field: "status", width: 120 },
  { field: "priority", width: 100 },
  { field: "assignee", width: 120 },
  { field: "due", width: 120 },
  { field: "tags", width: 200 },
];

describe("parseMarkdownTable – tags handling", () => {
  it("parses comma-separated tags into arrays", () => {
    const table = `| Id | Title | Status | Priority | Assignee | Due | Tags |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | Fix bug | todo | high | Alice | 2026-03-01 | solar,hardware |`;

    const tasks = parseMarkdownTable(table, DEFAULT_COLUMNS);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].tags).toEqual(["solar", "hardware"]);
  });

  it("parses tags with spaces around commas", () => {
    const table = `| Id | Title | Status | Priority | Assignee | Due | Tags |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | Fix bug | todo | high | Alice | 2026-03-01 | solar , hardware , repair |`;

    const tasks = parseMarkdownTable(table, DEFAULT_COLUMNS);
    expect(tasks[0].tags).toEqual(["solar", "hardware", "repair"]);
  });

  it("parses empty tags as empty array", () => {
    const table = `| Id | Title | Status | Priority | Assignee | Due | Tags |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | Fix bug | todo | high | Alice | 2026-03-01 |  |`;

    const tasks = parseMarkdownTable(table, DEFAULT_COLUMNS);
    expect(tasks[0].tags).toEqual([]);
  });

  it("handles multiple rows with different tags", () => {
    const table = `| Id | Title | Status | Priority | Assignee | Due | Tags |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | Task A | todo | high | Alice | 2026-03-01 | a,b |
| 002 | Task B | done | low | Bob | 2026-03-02 | x |
| 003 | Task C | todo | medium | Carol | 2026-03-03 |  |`;

    const tasks = parseMarkdownTable(table, DEFAULT_COLUMNS);
    expect(tasks[0].tags).toEqual(["a", "b"]);
    expect(tasks[1].tags).toEqual(["x"]);
    expect(tasks[2].tags).toEqual([]);
  });
});

describe("serializeProjectMd – tags serialization", () => {
  it("serializes tags arrays as comma-separated values in the table", () => {
    const data: ProjectData = {
      meta: {
        project: "Test",
        created: "2026-01-01",
        views: { default: {} },
        columns: DEFAULT_COLUMNS,
        status_options: ["todo"],
        priority_options: ["high"],
        assignee_options: [],
      },
      tasks: [
        {
          id: "001",
          title: "Fix bug",
          status: "todo",
          priority: "high",
          assignee: "Alice",
          due: "2026-03-01",
          tags: ["solar", "hardware"],
        },
      ],
      notes: "",
      rawContent: "",
    };

    const md = serializeProjectMd(data);
    // The table row should contain "solar,hardware"
    expect(md).toContain("solar,hardware");
  });

  it("serializes empty tags as empty cell", () => {
    const data: ProjectData = {
      meta: {
        project: "Test",
        created: "2026-01-01",
        views: { default: {} },
        columns: DEFAULT_COLUMNS,
        status_options: ["todo"],
        priority_options: ["high"],
        assignee_options: [],
      },
      tasks: [
        {
          id: "001",
          title: "Fix bug",
          status: "todo",
          priority: "high",
          assignee: "Alice",
          due: "2026-03-01",
          tags: [],
        },
      ],
      notes: "",
      rawContent: "",
    };

    const md = serializeProjectMd(data);
    // Empty tags should produce an empty cell (just spaces between pipes)
    expect(md).toMatch(/\| +\|$/m);
  });
});

describe("round-trip: parse → serialize → parse preserves tags", () => {
  it("preserves tags through a full markdown round-trip", () => {
    const md = `---
project: Test
created: "2026-01-01"
views:
  default: {}
columns:
  - field: id
    width: 60
  - field: title
    width: 300
  - field: status
    width: 120
  - field: priority
    width: 100
  - field: assignee
    width: 120
  - field: due
    width: 120
  - field: tags
    width: 200
status_options: [todo, done]
priority_options: [high, low]
assignee_options: []
---

# Test

## Tasks

| Id | Title | Status | Priority | Assignee | Due | Tags |
| --- | --- | --- | --- | --- | --- | --- |
| 001 | Task A | todo | high | Alice | 2026-03-01 | solar,hardware |
| 002 | Task B | done | low | Bob | 2026-03-02 |  |
`;

    const data1 = parseProjectMd(md);
    expect(data1.tasks[0].tags).toEqual(["solar", "hardware"]);
    expect(data1.tasks[1].tags).toEqual([]);

    const serialized = serializeProjectMd(data1);
    const data2 = parseProjectMd(serialized);

    expect(data2.tasks[0].tags).toEqual(["solar", "hardware"]);
    expect(data2.tasks[1].tags).toEqual([]);
  });
});
