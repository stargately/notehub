export interface ViewConfig {
  group_by?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export interface ColumnConfig {
  field: string;
  width?: number;
}

export interface ProjectMeta {
  project: string;
  created: string;
  views: Record<string, ViewConfig>;
  columns: ColumnConfig[];
  status_options: string[];
  priority_options: string[];
  assignee_options: string[];
  [key: string]: unknown;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string;
  due: string;
  tags: string[];
  description?: string;
  [key: string]: unknown;
}

export interface ProjectData {
  meta: ProjectMeta;
  tasks: Task[];
  notes: string;
  rawContent: string;
}

export interface FileChangedPayload {
  path: string;
  kind: "created" | "modified" | "deleted";
}

export interface TabInfo {
  id: string;
  filePath: string | null;
  label: string;
}

export type WeekFilter = "this_week" | "last_week" | null;
