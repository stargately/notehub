import { memo, useEffect, useRef } from "react";
import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { diagram } from "@milkdown/plugin-diagram";
import { mermaidNodeView } from "../lib/milkdown-mermaid";
import { registerPmView, type PmInsertView } from "../lib/pm-plain-paste";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";

interface MarkdownWysiwygProps {
  /** Initial markdown. Changes after mount are treated as external (reload / Monaco edit). */
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  /** Controls the mermaid diagram theme (light/dark). */
  darkMode?: boolean;
}

/**
 * Thin React wrapper around a Milkdown Crepe instance — a Typora-style WYSIWYG
 * markdown editor that round-trips to markdown. One instance per mount.
 */
function MarkdownWysiwygImpl({ value, onChange, placeholder, className, darkMode }: MarkdownWysiwygProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);

  // Keep callbacks in refs so the editor is created once and never torn down on
  // identity changes of onChange.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const crepe = new Crepe({
      root,
      defaultValue: value,
      featureConfigs: {
        // Use the browser's native caret instead of Crepe's virtual cursor. The virtual
        // cursor renders a widget decoration for ANY editor whose selection is empty — not
        // just the focused one — so with QaLayout's many mounted cells every cell drew its
        // own cursor (multiple cursors at once, only the focused one blinking). The native
        // caret only appears in the focused contenteditable and blinks on its own, giving
        // exactly one blinking cursor globally. (Drop/gap cursors stay enabled.)
        [Crepe.Feature.Cursor]: { virtual: false },
        ...(placeholder ? { [Crepe.Feature.Placeholder]: { text: placeholder } } : {}),
      },
    });

    // Render ```mermaid fences as diagrams. `diagram` adds the schema + remark parsing;
    // mermaidNodeView draws the SVG (the plugin ships no renderer).
    crepe.editor.use(diagram).use(mermaidNodeView(!!darkMode));

    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown) => {
        onChangeRef.current(markdown);
      });
    });

    const created = crepe.create();
    crepeRef.current = crepe;

    // Expose this editor's ProseMirror view so the window-level Cmd+Shift+V handler can insert
    // plain text into it when it's the focused cell. Guard against the unmount-before-create race.
    let unregister: (() => void) | null = null;
    let disposed = false;
    created.then(() => {
      if (disposed) return;
      try {
        crepe.editor.action((ctx) => {
          unregister = registerPmView(ctx.get(editorViewCtx) as unknown as PmInsertView);
        });
      } catch {
        // Editor torn down / not ready — nothing to register.
      }
    });

    return () => {
      // Destroy only after creation settles, so StrictMode's mount→unmount→mount
      // double-invoke doesn't tear down a half-initialized editor.
      disposed = true;
      created.then(() => crepe.destroy());
      unregister?.();
      crepeRef.current = null;
    };
    // Create exactly once per mount. `value`/`placeholder` are read at creation only;
    // QaLayout remounts (via key) when content changes externally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={rootRef} className={className} />;
}

/**
 * Memoized with a `value`-ignoring comparator. The editor is **mount-once**: Crepe reads `value`
 * only as `defaultValue` at creation, after which Milkdown owns its own DOM — so a changed `value`
 * never needs a re-render (QaLayout remounts via `key` when content changes externally). This skips
 * the wrapper re-render of the very cell being typed in, whose `value` updates on every keystroke.
 * `onChange` IS compared because the impl writes it into a ref during render; darkMode/placeholder
 * only feed the initial Crepe construction.
 */
export const MarkdownWysiwyg = memo(
  MarkdownWysiwygImpl,
  (prev, next) =>
    prev.onChange === next.onChange &&
    prev.darkMode === next.darkMode &&
    prev.placeholder === next.placeholder &&
    prev.className === next.className,
);
