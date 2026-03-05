import { useMemo, useCallback, useEffect } from "react";
import type { ProjectData, Task, WeekFilter } from "../lib/types";

interface UseTaskFiltersOptions {
  projectData: ProjectData | null;
  hideDone: boolean;
  weekFilter: WeekFilter;
  selectedTaskId: string | null;
  updateTasks: (tasks: Task[]) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  setSelectedTaskId: (id: string | null) => void;
  setGroupBy: (groupBy: string | null) => void;
}

export function useTaskFilters({
  projectData, hideDone, weekFilter, selectedTaskId,
  updateTasks, updateTask, setSelectedTaskId, setGroupBy,
}: UseTaskFiltersOptions) {
  const filteredTasks = useMemo(() => {
    if (!projectData) return [];
    let tasks = projectData.tasks;
    if (hideDone) {
      tasks = tasks.filter((t) => t.status !== "done");
    }
    if (weekFilter) {
      const now = new Date();
      const thisSunday = new Date(now);
      thisSunday.setDate(now.getDate() - now.getDay());
      thisSunday.setHours(0, 0, 0, 0);
      let start: Date, end: Date;
      if (weekFilter === "this_week") {
        start = thisSunday;
        end = new Date(thisSunday);
        end.setDate(end.getDate() + 7);
      } else {
        start = new Date(thisSunday);
        start.setDate(start.getDate() - 7);
        end = thisSunday;
      }
      const inRange = (d: string | undefined) => {
        if (!d) return false;
        const date = new Date(d + "T00:00:00");
        return date >= start && date < end;
      };
      tasks = tasks.filter((t) => inRange(t.created as string) || inRange(t.done as string));
    }
    return tasks;
  }, [projectData, hideDone, weekFilter]);

  // Merge visible (possibly filtered) tasks back into the full task list,
  // preserving any tasks hidden by filters (hideDone, weekFilter, etc.)
  // and respecting reordering (drag-and-drop) within visible tasks.
  const handleTasksChanged = useCallback(
    (visibleTasks: Task[]) => {
      if (!projectData) return;

      const isFiltered = hideDone || !!weekFilter;
      if (!isFiltered) {
        updateTasks(visibleTasks);
        return;
      }

      // IDs that were visible before the edit
      const visibleIds = new Set(filteredTasks.map((t) => t.id));

      // Walk the full list. Hidden tasks keep their position.
      // Each "visible slot" is filled with the next task from visibleTasks
      // (which may have been reordered by drag-and-drop or edited).
      const merged: Task[] = [];
      let vi = 0;
      for (const task of projectData.tasks) {
        if (!visibleIds.has(task.id)) {
          merged.push(task);
        } else {
          if (vi < visibleTasks.length) {
            merged.push(visibleTasks[vi]);
            vi++;
          }
        }
      }
      // Append any extra tasks (e.g. newly added while filtered)
      while (vi < visibleTasks.length) {
        merged.push(visibleTasks[vi]);
        vi++;
      }

      updateTasks(merged);
    },
    [projectData, filteredTasks, hideDone, weekFilter, updateTasks]
  );

  const selectedTask = useMemo(
    () =>
      selectedTaskId
        ? projectData?.tasks.find((t) => t.id === selectedTaskId) ?? null
        : null,
    [selectedTaskId, projectData?.tasks]
  );

  const handleDescriptionChange = useCallback(
    (taskId: string, description: string) => {
      updateTask(taskId, { description });
    },
    [updateTask]
  );

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      if (!projectData) return;
      updateTasks(projectData.tasks.filter((t) => t.id !== taskId));
      setSelectedTaskId(null);
    },
    [projectData, updateTasks, setSelectedTaskId]
  );

  // Apply initial group from view config
  useEffect(() => {
    if (projectData?.meta.views.default?.group_by) {
      setGroupBy(projectData.meta.views.default.group_by);
    }
  }, [projectData?.meta.views.default?.group_by, setGroupBy]);

  return {
    filteredTasks, selectedTask,
    handleTasksChanged, handleDescriptionChange, handleDeleteTask,
  };
}
