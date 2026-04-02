import Editor from "@monaco-editor/react";

interface ProjectNotesProps {
  notes: string;
  onUpdateNotes: (notes: string) => void;
  darkMode: boolean;
}

export function ProjectNotes({ notes, onUpdateNotes, darkMode }: ProjectNotesProps) {
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Project Notes
        </h2>
      </div>
      <div style={{ height: 256 }}>
        <Editor
          height="100%"
          language="markdown"
          theme={darkMode ? "vs-dark" : "light"}
          value={notes}
          onChange={(value) => onUpdateNotes(value ?? "")}
          options={{
            wordWrap: "on",
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "off",
            scrollBeyondLastLine: false,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
