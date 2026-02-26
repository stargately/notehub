import { useState, useEffect, useCallback, useRef } from "react";
import type { ProjectData, Task } from "../lib/types";
import { parseProjectMd, serializeProjectMd } from "../lib/markdown-parser";
import { getProjectFilePaths, readFile, writeFile, openFileDialog } from "../lib/tauri-api";

export async function resolveInitialFilePaths(): Promise<string[]> {
  try {
    const paths = await getProjectFilePaths();
    if (paths.length > 0) return paths;
    const selected = await openFileDialog();
    return selected ? [selected] : [];
  } catch {
    return [];
  }
}

export function useProjectFile(filePath: string | null) {
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get the project directory from file path
  const projectDir = filePath ? filePath.replace(/\/[^/]+$/, "") : null;

  // Load and parse the file
  const loadFile = useCallback(async () => {
    if (!filePath) return;
    try {
      setLoading(true);
      const content = await readFile(filePath);
      const data = parseProjectMd(content);
      setProjectData(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    if (filePath) {
      loadFile();
    } else {
      setProjectData(null);
      setLoading(false);
    }
  }, [loadFile, filePath]);

  // Save project data back to file (debounced)
  const saveProject = useCallback(
    (data: ProjectData) => {
      if (!filePath) return;
      setProjectData(data);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          const content = serializeProjectMd(data);
          await writeFile(filePath, content);
        } catch (e) {
          setError(String(e));
        }
      }, 300);
    },
    [filePath]
  );

  // Update tasks
  const updateTasks = useCallback(
    (tasks: Task[]) => {
      if (!projectData) return;
      saveProject({ ...projectData, tasks });
    },
    [projectData, saveProject]
  );

  // Update a single task
  const updateTask = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      if (!projectData) return;
      const tasks = projectData.tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      );
      saveProject({ ...projectData, tasks });
    },
    [projectData, saveProject]
  );

  // Add a new task
  const addTask = useCallback(() => {
    if (!projectData) return;
    const maxId = projectData.tasks.reduce((max, t) => {
      const num = parseInt(t.id, 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const newId = String(maxId + 1).padStart(3, "0");
    const newTask: Task = {
      id: newId,
      title: "New Task",
      status: projectData.meta.status_options[0] || "todo",
      priority: "medium",
      assignee: "",
      created: new Date().toISOString().slice(0, 10),
      due: "",
      tags: [],
    };
    saveProject({ ...projectData, tasks: [...projectData.tasks, newTask] });
  }, [projectData, saveProject]);

  // Delete a task
  const deleteTask = useCallback(
    (taskId: string) => {
      if (!projectData) return;
      const tasks = projectData.tasks.filter((t) => t.id !== taskId);
      saveProject({ ...projectData, tasks });
    },
    [projectData, saveProject]
  );

  // Update notes
  const updateNotes = useCallback(
    (notes: string) => {
      if (!projectData) return;
      saveProject({ ...projectData, notes });
    },
    [projectData, saveProject]
  );

  return {
    filePath,
    projectDir,
    projectData,
    loading,
    error,
    loadFile,
    updateTasks,
    updateTask,
    addTask,
    deleteTask,
    updateNotes,
    saveProject,
  };
}
