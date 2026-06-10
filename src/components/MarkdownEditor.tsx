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
  /**
   * Sidebar open/closed — a width-reflow signal. When it flips the editor's width changes, wrapped
   * lines reflow, and the content height changes, so the same scrollTop would show different text.
   * We snapshot the scroll *fraction* and re-apply it once the reflow settles (preserves reading pos).
   */
  sidebarOpen?: boolean;
  /**
   * Receives a "reveal this 1-based line" function once the editor mounts (cleared on unmount) —
   * the outline panel / go-to-heading overlay jump through it (`revealLineInCenter` + cursor + focus).
   */
  revealLineRef?: MutableRefObject<((line: number) => void) | null>;
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

function MarkdownEditorImpl({ content, onChange, darkMode, language = "markdown", scrollRef, sidebarOpen, revealLineRef, onUndoExhausted, onRedoExhausted }: MarkdownEditorProps) {
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
  const revealRefProp = useRef(revealLineRef);
  revealRefProp.current = revealLineRef;

  // Drop the reveal handle when this editor unmounts (Cmd+/ back to the WYSIWYG view) so a jump
  // can't reach a disposed Monaco instance.
  useEffect(() => {
    return () => {
      if (revealRefProp.current) revealRefProp.current.current = null;
    };
  }, []);

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

  // Preserve scroll across the width reflow from toggling the sidebar (Cmd+B). Collapsing/expanding
  // the sidebar changes this editor's width, so wrapped lines reflow and the content height changes —
  // the same scrollTop would now show different text. We snapshot the scroll *fraction* here in render
  // (the DOM still holds the pre-toggle layout) and re-apply it across a few frames in the layout
  // effect below, once Monaco re-wraps via `automaticLayout`. Tied to the discrete `sidebarOpen` flip
  // — not a width observer — so a sidebar-resize *drag* never triggers it.
  const lastSidebarOpenRef = useRef(sidebarOpen);
  const reflowFractionRef = useRef<number | null>(null);
  if (sidebarOpen !== lastSidebarOpenRef.current) {
    lastSidebarOpenRef.current = sidebarOpen;
    const ed = editorRef.current;
    // Only the visible (active) tab has meaningful layout; skip hidden (display:none) background tabs.
    if (ed && containerRef.current?.offsetParent != null) {
      reflowFractionRef.current = toFraction(ed.getScrollTop(), ed.getScrollHeight(), ed.getLayoutInfo().height);
    }
  }
  useLayoutEffect(() => {
    const ed = editorRef.current;
    const frac = reflowFractionRef.current;
    reflowFractionRef.current = null;
    if (!ed || frac == null) return;
    let raf = 0;
    let prevHeight = -1;
    let stable = 0;
    let frames = 0;
    const apply = () => {
      ed.setScrollTop(fromFraction(frac, ed.getScrollHeight(), ed.getLayoutInfo().height));
      const h = ed.getScrollHeight();
      stable = h === prevHeight ? stable + 1 : 0;
      prevHeight = h;
      if (stable < 2 && ++frames < 30) raf = requestAnimationFrame(apply);
    };
    apply(); // first apply pre-paint, then settle across frames as Monaco re-wraps
    return () => cancelAnimationFrame(raf);
  }, [sidebarOpen]);

  const handleChange = useCallback((value: string | undefined) => onChange(value ?? ""), [onChange]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    editor.focus();

    // Hand the outline/go-to-heading jump a way into this editor.
    if (revealRefProp.current) {
      revealRefProp.current.current = (line: number) => {
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: 1 });
        editor.focus();
      };
    }

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

    // Bridge Cmd+Shift+O (otherwise eaten by Monaco's own "Go to Symbol") so the keymap's
    // go-to-heading overlay opens instead.
    editor.addCommand(
      // eslint-disable-next-line no-bitwise
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyO,
      () => {
        containerRef.current?.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "O",
            code: "KeyO",
            metaKey: true,
            shiftKey: true,
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
