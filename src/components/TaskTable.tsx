import { useMemo, useCallback, useRef } from "react";
import { AgGridReact } from "ag-grid-react";
import type {
  ColDef,
  CellValueChangedEvent,
  RowDragEndEvent,
  GridReadyEvent,
} from "ag-grid-community";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type { Task, ProjectMeta } from "../lib/types";
import { StatusCellRenderer } from "./cell-renderers/StatusCellRenderer";
import { PriorityCellRenderer } from "./cell-renderers/PriorityCellRenderer";
import { AssigneeCellRenderer } from "./cell-renderers/AssigneeCellRenderer";
import { DateCellRenderer } from "./cell-renderers/DateCellRenderer";
import { TagsCellRenderer } from "./cell-renderers/TagsCellRenderer";
import { TitleCellRenderer } from "./cell-renderers/TitleCellRenderer";
import { ActionCellRenderer } from "./cell-renderers/ActionCellRenderer";

import { TagsEditor } from "./cell-editors/TagsEditor";

ModuleRegistry.registerModules([AllCommunityModule]);

interface TaskTableProps {
  tasks: Task[];
  meta: ProjectMeta;
  filterText: string;
  onTasksChanged: (tasks: Task[]) => void;
  onTaskSelected?: (task: Task) => void;
}

export function TaskTable({
  tasks,
  meta,
  filterText,
  onTasksChanged,
  onTaskSelected,
}: TaskTableProps) {
  const gridRef = useRef<AgGridReact>(null);

  const effectiveColumnDefs = useMemo<ColDef[]>(() => {
    const renderers: Record<string, unknown> = {
      status: StatusCellRenderer,
      priority: PriorityCellRenderer,
      assignee: AssigneeCellRenderer,
      created: DateCellRenderer,
      due: DateCellRenderer,
      done: DateCellRenderer,
      tags: TagsCellRenderer,
    };

    const editors: Record<string, { editor: string | unknown; params?: Record<string, unknown> }> = {
      tags: { editor: TagsEditor },
    };

    // Auto-detect *_options fields → dropdown editors
    for (const [key, value] of Object.entries(meta)) {
      if (key.endsWith("_options") && Array.isArray(value)) {
        const field = key.replace(/_options$/, "");
        editors[field] = {
          editor: "agSelectCellEditor",
          params: { values: ["", ...value] },
        };
      }
    }

    const actionCol: ColDef = {
      headerName: "",
      width: 40,
      maxWidth: 40,
      cellRenderer: ActionCellRenderer,
      editable: false,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
    };

    return [actionCol, ...meta.columns.map((col) => {
      const def: ColDef = {
        field: col.field,
        headerName: col.field.charAt(0).toUpperCase() + col.field.slice(1),
        width: col.width,
        editable: col.field !== "id",
        resizable: true,
        sortable: true,
        filter: true,
      };

      if (col.field === "title") {
        def.cellRenderer = TitleCellRenderer;
        def.rowDrag = true;
      } else if (renderers[col.field]) {
        def.cellRenderer = renderers[col.field];
      }

      if (editors[col.field]) {
        def.cellEditor = editors[col.field].editor;
        if (editors[col.field].params) {
          def.cellEditorParams = editors[col.field].params;
        }
      }

      if (col.field === "id") {
        def.width = 70;
        def.editable = false;
        def.sortable = true;
      }

      return def;
    })];
  }, [meta]);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      flex: 0,
      minWidth: 60,
    }),
    []
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      const updatedTasks = [...tasks];
      const rowIndex = tasks.findIndex((t) => t.id === event.data.id);
      if (rowIndex >= 0) {
        const task = { ...event.data };
        if (event.column.getColId() === "status") {
          if (task.status === "done" && !task.done) {
            task.done = new Date().toISOString().slice(0, 10);
          } else if (task.status === "" && task.done) {
            task.done = "";
          }
        }
        updatedTasks[rowIndex] = task;
        onTasksChanged(updatedTasks);
        event.api.applyTransaction({ update: [task] });
      }
    },
    [tasks, onTasksChanged]
  );

  const onRowDragEnd = useCallback(
    (event: RowDragEndEvent) => {
      const movedData = event.node.data;
      const overIndex = event.overIndex;
      if (overIndex < 0) return;

      const newTasks = tasks.filter((t) => t.id !== movedData.id);
      newTasks.splice(overIndex, 0, movedData);
      onTasksChanged(newTasks);
    },
    [tasks, onTasksChanged]
  );

  const onGridReady = useCallback((_params: GridReadyEvent) => {
    // Grid is ready
  }, []);

  const gridContext = useMemo(
    () => ({ onTaskSelected }),
    [onTaskSelected]
  );

  return (
    <div className="ag-theme-alpine w-full h-full">
      <AgGridReact
        ref={gridRef}
        rowData={tasks}
        columnDefs={effectiveColumnDefs}
        defaultColDef={defaultColDef}
        getRowId={(params) => params.data.id}
        onGridReady={onGridReady}
        onCellValueChanged={onCellValueChanged}
        onRowDragEnd={onRowDragEnd}
        context={gridContext}
        rowDragManaged={true}
        animateRows={true}
        singleClickEdit={true}
        stopEditingWhenCellsLoseFocus={true}
        quickFilterText={filterText}
        rowSelection="single"
      />
    </div>
  );
}
