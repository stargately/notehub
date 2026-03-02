import matter from "gray-matter";
import type { ProjectData, ProjectMeta, Task, ColumnConfig } from "./types";
import { resolveFieldType } from "./types";

const DEFAULT_META: ProjectMeta = {
  project: "Untitled Project",
  created: new Date().toISOString().split("T")[0],
  views: { default: { group_by: "status", sort_by: "priority", sort_order: "desc" } },
  columns: [
    { field: "title", width: 300 },
    { field: "status", width: 120 },
    { field: "priority", width: 100 },
    { field: "assignee", width: 120 },
    { field: "due", width: 120 },
    { field: "tags", width: 200 },
  ],
  status_options: ["todo", "in_progress", "in_review", "done", "blocked"],
  priority_options: ["urgent", "high", "medium", "low"],
  assignee_options: [],
};

export function parseProjectMd(content: string): ProjectData {
  const { data, content: body } = matter(content);

  const meta: ProjectMeta = {
    ...DEFAULT_META,
    ...data,
    views: data.views || DEFAULT_META.views,
    columns: data.columns || DEFAULT_META.columns,
    status_options: data.status_options || DEFAULT_META.status_options,
    priority_options: data.priority_options || DEFAULT_META.priority_options,
    assignee_options: data.assignee_options || DEFAULT_META.assignee_options,
  };

  // Find ## Tasks section and extract table
  const tasksMatch = body.match(/## Tasks\s*\n([\s\S]*?)(?=\n## |\n*$)/);
  let tasks: Task[] = [];
  if (tasksMatch) {
    tasks = parseMarkdownTable(tasksMatch[1], meta.columns);
  }

  // Find ## Task Details section and attach descriptions to tasks
  const detailsMatch = body.match(/## Task Details\s*\n([\s\S]*?)(?=\n## |\n*$)/);
  if (detailsMatch) {
    const descriptions = parseTaskDetails(detailsMatch[1]);
    for (const task of tasks) {
      if (descriptions[task.id]) {
        task.description = descriptions[task.id];
      }
    }
  }

  // Find ## Notes section
  const notesMatch = body.match(/## Notes\s*\n([\s\S]*?)$/);
  const notes = notesMatch ? notesMatch[1].trim() : "";

  return { meta, tasks, notes, rawContent: content };
}

export function parseTaskDetails(detailsContent: string): Record<string, string> {
  const descriptions: Record<string, string> = {};
  const blocks = detailsContent.split(/^### tid-/m).filter(Boolean);
  for (const block of blocks) {
    const newlineIdx = block.indexOf("\n");
    if (newlineIdx === -1) continue;
    const id = block.slice(0, newlineIdx).trim();
    const content = block.slice(newlineIdx + 1).trim();
    if (id && content) {
      descriptions[id] = content;
    }
  }
  return descriptions;
}

export function parseMarkdownTable(tableString: string, columns: ColumnConfig[]): Task[] {
  const lines = tableString.trim().split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  // Build set of fields that should be parsed as tags (arrays)
  const tagsFields = new Set(
    columns.filter((c) => resolveFieldType(c) === "tags").map((c) => c.field)
  );

  // Parse header row to get column names
  const headers = lines[0]
    .split("|")
    .map((h) => h.trim())
    .filter(Boolean)
    .map((h) => h.toLowerCase());

  // Skip separator row (line index 1)
  const tasks: Task[] = [];

  for (let i = 2; i < lines.length; i++) {
    const cells = lines[i]
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length); // Remove empty first/last from | delimiters

    if (cells.length === 0) continue;

    const task: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      const value = cells[idx]?.trim() || "";
      if (tagsFields.has(header)) {
        task[header] = value
          ? value.split(",").map((t: string) => t.trim())
          : [];
      } else {
        task[header] = value;
      }
    });

    tasks.push({
      id: (task.id as string) || "",
      title: (task.title as string) || "",
      status: (task.status as string) || "todo",
      priority: (task.priority as string) || "medium",
      assignee: (task.assignee as string) || "",
      due: (task.due as string) || "",
      tags: (task.tags as string[]) || [],
      ...task,
    });
  }

  return tasks;
}

export function serializeProjectMd(data: ProjectData): string {
  const { meta, tasks, notes } = data;

  // Build frontmatter
  const frontmatter = matter.stringify("", meta).trim();

  // Build task table
  const columns = meta.columns.map((c) => c.field);
  const tableHeader =
    "| " + columns.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(" | ") + " |";
  const tableSeparator =
    "| " + columns.map(() => "---").join(" | ") + " |";

  const tableRows = tasks.map((task) => {
    const cells = columns.map((col) => {
      const val = task[col];
      if (Array.isArray(val)) return val.join(",");
      return String(val ?? "");
    });
    return "| " + cells.join(" | ") + " |";
  });

  const table = [tableHeader, tableSeparator, ...tableRows].join("\n");

  // Build task details section
  const detailBlocks = tasks
    .filter((t) => t.description)
    .map((t) => `### tid-${t.id}\n\n${t.description}`)
    .join("\n\n");

  // Build full document
  let doc = frontmatter + "\n\n";
  doc += `# ${meta.project}\n\n`;
  doc += `## Tasks\n\n${table}\n`;

  if (detailBlocks) {
    doc += `\n## Task Details\n\n${detailBlocks}\n`;
  }

  if (notes) {
    doc += `\n## Notes\n\n${notes}\n`;
  }

  return doc;
}
