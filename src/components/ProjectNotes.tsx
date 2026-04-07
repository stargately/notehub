import Editor from "@monaco-editor/react";

interface ProjectNotesProps {
  notes: string;
  onUpdateNotes: (notes: string) => void;
  darkMode: boolean;
}

export function ProjectNotes({ notes, onUpdateNotes, darkMode }: ProjectNotesProps) {
  return (
    <div
      className="border-t nh-fade-in"
      style={{
        borderColor: "var(--nh-border)",
        background: "var(--nh-bg-elevated)",
      }}
    >
      <div
        className="px-4 py-2 border-b"
        style={{ borderColor: "var(--nh-border)" }}
      >
        <h2
          className="text-[10px] font-medium uppercase tracking-wider"
          style={{ color: "var(--nh-text-tertiary)" }}
        >
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
            fontSize: 13,
            fontFamily: '"DM Sans", sans-serif',
            lineNumbers: "off",
            scrollBeyondLastLine: false,
            padding: { top: 8 },
          }}
        />
      </div>
    </div>
  );
}
