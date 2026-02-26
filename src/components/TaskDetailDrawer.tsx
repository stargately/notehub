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

  return (
    <div className="w-[420px] flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-400 font-mono flex-shrink-0">
            #{task.id}
          </span>
          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
            {task.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 flex-shrink-0"
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
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Description
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>

      {/* Delete button */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onDelete(task.id)}
          className="w-full px-3 py-1.5 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
        >
          Delete task
        </button>
      </div>
    </div>
  );
}
