import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

interface ProjectNotesProps {
  notes: string;
  onUpdateNotes: (notes: string) => void;
}

export function ProjectNotes({ notes, onUpdateNotes }: ProjectNotesProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Project notes..." }),
    ],
    content: notes,
    onUpdate: ({ editor }) => {
      onUpdateNotes(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "tiptap-editor min-h-[150px] p-4 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && notes && !editor.isFocused) {
      const currentContent = editor.getHTML();
      if (currentContent !== notes) {
        editor.commands.setContent(notes);
      }
    }
  }, [editor, notes]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Project Notes
        </h2>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
