import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { MutableRefObject } from "react";

// Fake Monaco surface: enough of the editor/monaco API for handleMount to run, with addCommand
// registrations captured so the keymap bridges can be invoked directly.
const h = vi.hoisted(() => {
  const addCommands: Array<{ keys: number; run: () => void }> = [];
  const editor = {
    focus: vi.fn(),
    revealLineInCenter: vi.fn(),
    setPosition: vi.fn(),
    onDidScrollChange: vi.fn(),
    getScrollTop: () => 0,
    getScrollHeight: () => 100,
    getLayoutInfo: () => ({ height: 50 }),
    getModel: () => ({ getAlternativeVersionId: () => 1 }),
    addCommand: (keys: number, run: () => void) => {
      addCommands.push({ keys, run });
    },
    saveViewState: () => null,
    restoreViewState: vi.fn(),
    setScrollTop: vi.fn(),
    setValue: vi.fn(),
    trigger: vi.fn(),
  };
  const monaco = {
    KeyMod: { CtrlCmd: 2048, Shift: 1024 },
    KeyCode: { KeyZ: 1, Slash: 2, KeyS: 3, KeyB: 4, KeyO: 5 },
  };
  return { addCommands, editor, monaco };
});

vi.mock("@monaco-editor/react", async () => {
  const { useEffect } = await import("react");
  return {
    default: ({ onMount }: { onMount: (e: unknown, m: unknown) => void }) => {
      useEffect(() => {
        onMount(h.editor, h.monaco);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    },
  };
});

import { MarkdownEditor } from "../MarkdownEditor";

type RevealRef = MutableRefObject<((line: number) => void) | null>;

function renderEditor(revealLineRef: RevealRef) {
  return render(
    <MarkdownEditor content="x" onChange={() => {}} darkMode={false} revealLineRef={revealLineRef} />,
  );
}

beforeEach(() => {
  h.addCommands.length = 0;
  h.editor.focus.mockClear();
  h.editor.revealLineInCenter.mockClear();
  h.editor.setPosition.mockClear();
});

describe("MarkdownEditor — outline jump handle (revealLineRef)", () => {
  it("fills the handle on mount; invoking it reveals the line, places the cursor, and focuses", () => {
    const ref: RevealRef = { current: null };
    renderEditor(ref);

    expect(ref.current).toBeTypeOf("function");
    h.editor.focus.mockClear(); // mount focuses too — isolate the jump's focus
    ref.current!(7);
    expect(h.editor.revealLineInCenter).toHaveBeenCalledWith(7);
    expect(h.editor.setPosition).toHaveBeenCalledWith({ lineNumber: 7, column: 1 });
    expect(h.editor.focus).toHaveBeenCalledTimes(1);
  });

  it("clears the handle on unmount so a jump can't reach a disposed editor", () => {
    const ref: RevealRef = { current: null };
    const { unmount } = renderEditor(ref);
    expect(ref.current).not.toBeNull();
    unmount();
    expect(ref.current).toBeNull();
  });
});

describe("MarkdownEditor — Cmd+Shift+O keymap bridge", () => {
  it("re-dispatches Monaco's Cmd+Shift+O as a window keydown the keymap dispatcher can catch", () => {
    renderEditor({ current: null });

    // eslint-disable-next-line no-bitwise
    const combo = h.monaco.KeyMod.CtrlCmd | h.monaco.KeyMod.Shift | h.monaco.KeyCode.KeyO;
    const bridge = h.addCommands.find((c) => c.keys === combo);
    expect(bridge).toBeTruthy();

    const seen: KeyboardEvent[] = [];
    const listener = (e: Event) => seen.push(e as KeyboardEvent);
    window.addEventListener("keydown", listener);
    bridge!.run();
    window.removeEventListener("keydown", listener);

    expect(seen).toHaveLength(1);
    expect(seen[0].key).toBe("O");
    expect(seen[0].metaKey).toBe(true);
    expect(seen[0].shiftKey).toBe(true);
  });
});
