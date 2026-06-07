import Editor, { type OnMount, type EditorProps } from "@monaco-editor/react";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, type MutableRefObject } from "react";
import { toFraction, fromFraction } from "../lib/scroll-sync";

type MonacoEditor = Parameters<OnMount>[0];

interface MarkdownEditorProps {
  content: string;
  onChange: (content: string) => void;
  darkMode: boolean;
  /** Monaco language id; defaults to "markdown". Set when editing other text files. */
  language?: string;
  /** Shared scroll-progress fraction carried across a Cmd+/ view toggle (see DocumentView). */
  scrollRef?: MutableRefObject<number | null>;
  onUndoExhausted?: () => string | null;
  onRedoExhausted?: () => string | null;
}

// Static — hoisted so a fresh object identity per render doesn't trigger Monaco's `updateOptions`
// diff on every keystroke (the `content` prop changes each edit).
const MONACO_OPTIONS: EditorProps["options"] = {
  // Background tabs stay mounted in a display:none container, so Monaco must re-measure when its
  // tab is revealed (otherwise it paints at 0×0).
  automaticLayout: true,
  wordWrap: "on",
  minimap: { enabled: false },
  fontSize: 14,
  lineNumbers: "off",
  scrollBeyondLastLine: false,
  padding: { top: 16 },
};

function MarkdownEditorImpl({ content, onChange, darkMode, language = "markdown", scrollRef, onUndoExhausted, onRedoExhausted }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const initialVersionRef = useRef<number>(0);
  const editorRef = useRef<MonacoEditor | null>(null);
  const lastContentRef = useRef(content);
  const pendingViewStateRef = useRef<ReturnType<MonacoEditor["saveViewState"]>>(null);
  // Latest scroll fraction, tracked live so we can hand it off on unmount (the editor may already be
  // disposed by then). `scrollRef` (from DocumentView) is the cross-view handoff slot.
  const liveFractionRef = useRef(0);
  const scrollRefProp = useRef(scrollRef);
  scrollRefProp.current = scrollRef;

  // Write our final scroll progress into the shared slot when this editor unmounts (Cmd+/ toggle),
  // so the incoming WYSIWYG view can resume at the same place. A *layout*-effect cleanup so it runs
  // before the incoming QaLayout's layout-effect restore reads the slot (same commit).
  useLayoutEffect(() => {
    return () => {
      if (scrollRefProp.current) scrollRefProp.current.current = liveFractionRef.current;
    };
  }, []);

  // Preserve cursor + scroll across an external live-reload. When `content` changes from disk,
  // @monaco-editor/react replaces the whole document with one full-range edit, which collapses the
  // cursor to the doc end. We snapshot the view state *here in render* — before that child effect
  // runs (children's effects fire before this parent's) and while the model still holds the old
  // text — then restore it in the effect below. For a local edit this snapshots the current state
  // and restores it unchanged (a no-op), so no flag is needed to distinguish the two.
  if (content !== lastContentRef.current) {
    lastContentRef.current = content;
    pendingViewStateRef.current = editorRef.current?.saveViewState() ?? null;
  }
  useEffect(() => {
    const ed = editorRef.current;
    const vs = pendingViewStateRef.current;
    pendingViewStateRef.current = null;
    if (ed && vs) ed.restoreViewState(vs);
  }, [content]);

  const handleChange = useCallback((value: string | undefined) => onChange(value ?? ""), [onChange]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.focus();

    // Track scroll progress so it can be handed to the WYSIWYG view on a Cmd+/ toggle.
    const layoutHeight = () => editor.getLayoutInfo().height;
    editor.onDidScrollChange(() => {
      liveFractionRef.current = toFraction(editor.getScrollTop(), editor.getScrollHeight(), layoutHeight());
    });
    // Resume the progress carried over from the previous (WYSIWYG) view, if any. Monaco lays the
    // whole model out synchronously, so getScrollHeight is accurate immediately.
    const incoming = scrollRefProp.current?.current;
    if (incoming != null) {
      scrollRefProp.current!.current = null;
      editor.setScrollTop(fromFraction(incoming, editor.getScrollHeight(), layoutHeight()));
      liveFractionRef.current = incoming;
    }

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

    // Bridge Cmd+/ and Cmd+S to DOM so the global keymap dispatcher catches them
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

    // Bridge Cmd+B (otherwise eaten as "bold") so the sidebar toggle reaches the window handler.
    editor.addCommand(
      // eslint-disable-next-line no-bitwise
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
      () => {
        containerRef.current?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "b",
            code: "KeyB",
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
        language={language}
        theme={darkMode ? "vs-dark" : "light"}
        value={content}
        onChange={handleChange}
        onMount={handleMount}
        options={MONACO_OPTIONS}
      />
    </div>
  );
}

/**
 * Memoized so the Monaco wrapper isn't reconciled on unrelated parent re-renders. Its props are
 * stable for a loaded tab (`onChange`/`onUndoExhausted`/`onRedoExhausted` are memoized upstream),
 * so it re-renders only when `content`/`darkMode`/`language` actually change.
 */
export const MarkdownEditor = memo(MarkdownEditorImpl);
