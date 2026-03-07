import Editor, { type OnMount } from "@monaco-editor/react";
import { useRef } from "react";

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  darkMode: boolean;
  onUndoExhausted?: () => string | null;
  onRedoExhausted?: () => string | null;
}

export function MarkdownEditor({ content, onChange, darkMode, onUndoExhausted, onRedoExhausted }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialVersionRef = useRef<number>(0);

  const handleMount: OnMount = (editor, monaco) => {
    editor.focus();

    // Record the initial version to detect when native undo is exhausted
    const model = editor.getModel();
    if (model) {
      initialVersionRef.current = model.getAlternativeVersionId();
    }

    // Override Cmd+Z to detect undo exhaustion
    editor.addCommand(
      // eslint-disable-next-line no-bitwise
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ,
      () => {
        const m = editor.getModel();
        if (!m) return;
        const versionBefore = m.getAlternativeVersionId();
        if (versionBefore <= initialVersionRef.current && onUndoExhausted) {
          // Native undo exhausted — fall back to snapshot stack
          const snapshot = onUndoExhausted();
          if (snapshot) {
            editor.setValue(snapshot);
            initialVersionRef.current = m.getAlternativeVersionId();
          }
        } else {
          editor.trigger("keyboard", "undo", null);
        }
      }
    );

    // Override Cmd+Shift+Z for redo exhaustion
    editor.addCommand(
      // eslint-disable-next-line no-bitwise
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
      () => {
        const m = editor.getModel();
        if (!m) return;
        const versionBefore = m.getAlternativeVersionId();
        editor.trigger("keyboard", "redo", null);
        const versionAfter = m.getAlternativeVersionId();
        if (versionBefore === versionAfter && onRedoExhausted) {
          // Native redo exhausted — fall back to snapshot stack
          const snapshot = onRedoExhausted();
          if (snapshot) {
            editor.setValue(snapshot);
            initialVersionRef.current = m.getAlternativeVersionId();
          }
        }
      }
    );

    // Bridge Cmd+/ and Cmd+S to DOM so useKeyboardShortcuts catches them
    editor.addCommand(
      // eslint-disable-next-line no-bitwise
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash,
      () => {
        containerRef.current?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "/",
            code: "Slash",
            metaKey: true,
            bubbles: true,
          })
        );
      }
    );

    editor.addCommand(
      // eslint-disable-next-line no-bitwise
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        containerRef.current?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "s",
            code: "KeyS",
            metaKey: true,
            bubbles: true,
          })
        );
      }
    );
  };

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden">
      <Editor
        height="100%"
        language="markdown"
        theme={darkMode ? "vs-dark" : "light"}
        value={content}
        onChange={(value) => onChange(value ?? "")}
        onMount={handleMount}
        options={{
          wordWrap: "on",
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "off",
          scrollBeyondLastLine: false,
          padding: { top: 16 },
        }}
      />
    </div>
  );
}
