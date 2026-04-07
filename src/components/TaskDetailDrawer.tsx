import { useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { Task } from "../lib/types";

interface TaskDetailDrawerProps {
  task: Task;
  onDescriptionChange: (taskId: string, description: string) => void;
  onDelete: (taskId: string) => void;
  onClose: () => void;
}

export function TaskDetailDrawer({
  task,
  onDescriptionChange,
  onDelete,
  onClose,
}: TaskDetailDrawerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Add a description..." }),
    ],
    content: task.description || "",
    onUpdate: ({ editor }) => {
      onDescriptionChange(task.id, editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor min-h-[200px] p-4 focus:outline-none",
      },
    },
  });

  // Sync editor content when switching tasks
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      const current = editor.getHTML();
      const incoming = task.description || "";
      if (current !== incoming && !editor.isFocused) {
        editor.commands.setContent(incoming);
      }
    }
  }, [editor, task.id, task.description]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const statusColor = task.status === "done"
    ? "var(--nh-accent)"
    : task.status === "in_progress"
    ? "#3b82f6"
    : "var(--nh-border)";

  return (
    <div
      className="flex-shrink-0 border-l flex flex-col overflow-hidden nh-drawer-enter"
      style={{
        width: "clamp(300px, 30vw, 460px)",
        borderColor: "var(--nh-border)",
        background: "var(--nh-bg-elevated)",
        boxShadow: "var(--nh-shadow-lg)",
      }}
    >
      {/* Accent bar */}
      <div
        className="h-0.5 w-full shrink-0 transition-colors"
        style={{ background: statusColor }}
      />

      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between gap-2"
        style={{ borderColor: "var(--nh-border)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-xs font-mono flex-shrink-0 px-1.5 py-0.5 rounded"
            style={{
              color: "var(--nh-text-tertiary)",
              background: "var(--nh-bg-sunken)",
            }}
          >
            #{task.id}
          </span>
          <h3
            className="text-sm font-medium truncate"
            style={{ color: "var(--nh-text)" }}
          >
            {task.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md flex-shrink-0 transition-colors"
          style={{ color: "var(--nh-text-tertiary)" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--nh-bg-sunken)";
            e.currentTarget.style.color = "var(--nh-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--nh-text-tertiary)";
          }}
          title="Close (Esc)"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Description label */}
      <div className="px-4 pt-3 pb-1">
        <span
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: "var(--nh-text-tertiary)" }}
        >
          Description
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Delete button */}
      <div
        className="px-4 py-3 border-t"
        style={{ borderColor: "var(--nh-border)" }}
      >
        <button
          onClick={() => onDelete(task.id)}
          className="w-full px-3 py-1.5 text-xs font-medium rounded-md border transition-all hover:bg-red-50 dark:hover:bg-red-900/20"
          style={{
            color: "#ef4444",
            borderColor: "rgba(239, 68, 68, 0.2)",
          }}
        >
          Delete task
        </button>
      </div>
    </div>
  );
}
