export const isTauri = !!(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;

// Lazy-load invoke to avoid top-level await
let _invoke: (<T>(cmd: string, args?: Record<string, unknown>) => Promise<T>) | null = null;

async function getInvoke() {
  if (_invoke) return _invoke;
  if (isTauri) {
    const mod = await import("@tauri-apps/api/core");
    _invoke = mod.invoke;
  } else {
    _invoke = async () => {
      throw new Error("Not in Tauri");
    };
  }
  return _invoke;
}

// In-memory store for browser mode
let browserFileContent: string | null = null;

export function getDefaultProjectContent(): string {
  const today = new Date().toISOString().split("T")[0];
  return `---
project: "Untitled Project"
created: "${today}"
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
status_options: [todo, in_progress, in_review, done, blocked]
priority_options: [urgent, high, medium, low]
assignee_options: []
---

## Tasks

| Id | Title | Status | Priority | Assignee | Due | Tags |
| --- | --- | --- | --- | --- | --- | --- |

## Task Details

## Notes
`;
}

export async function saveFileDialog(): Promise<string | null> {
  if (!isTauri) return null;
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const selected = await save({
      filters: [{ name: "Markdown", extensions: ["md"] }],
      defaultPath: "untitled-todo.md",
    });
    return selected || null;
  } catch {
    return null;
  }
}

export async function openFileDialog(): Promise<string | null> {
  if (!isTauri) return null;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    return (selected as string) || null;
  } catch {
    return null;
  }
}

export async function getProjectFilePaths(): Promise<string[]> {
  if (!isTauri) return ["browser://sample-project.md"];
  const invoke = await getInvoke();
  return invoke<string[]>("get_project_file_paths");
}

export async function readFile(path: string): Promise<string> {
  if (!isTauri) {
    // Only serve sample-project.md for the main project file
    if (path === "browser://sample-project.md") {
      if (browserFileContent !== null) return browserFileContent;
      const resp = await fetch("/sample-project.md");
      browserFileContent = await resp.text();
      return browserFileContent;
    }
    // For any other path (e.g. task detail files), throw to trigger creation
    throw new Error("File not found in browser mode");
  }
  const invoke = await getInvoke();
  return invoke<string>("read_file", { path });
}

const writeLock = new Set<string>();

export function isWriteLocked(path: string): boolean {
  return writeLock.has(path);
}

export async function openUrl(url: string): Promise<void> {
  if (isTauri) {
    try {
      const { openUrl: tauriOpenUrl } = await import("@tauri-apps/plugin-opener");
      await tauriOpenUrl(url);
    } catch {
      window.open(url, "_blank");
    }
  } else {
    window.open(url, "_blank");
  }
}

export async function writeFile(path: string, content: string): Promise<void> {
  if (!isTauri) {
    browserFileContent = content;
    return;
  }
  const invoke = await getInvoke();
  writeLock.add(path);
  try {
    await invoke<void>("write_file", { path, content });
  } finally {
    setTimeout(() => writeLock.delete(path), 1000);
  }
}

// Terminal API

export async function spawnTerminal(cwd?: string): Promise<number> {
  const invoke = await getInvoke();
  return invoke<number>("spawn_terminal", { cwd: cwd ?? null });
}

export async function writeTerminal(sessionId: number, data: string): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("write_terminal", { sessionId, data });
}

export async function resizeTerminal(sessionId: number, cols: number, rows: number): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("resize_terminal", { sessionId, cols: cols, rows: rows });
}

export async function killTerminal(sessionId: number): Promise<void> {
  const invoke = await getInvoke();
  await invoke<void>("kill_terminal", { sessionId });
}

