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

