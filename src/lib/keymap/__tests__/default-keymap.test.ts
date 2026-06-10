import { describe, it, expect } from "vitest";
import { compileKeymap, resolve } from "../keymap";
import { parseSequence } from "../keystroke";
import { DEFAULT_KEYMAP } from "../default-keymap";
import { ACTIONS, CONTEXTS } from "../actions";

// Resolve a keystroke against the real default keymap with the given contexts active
// (Workspace is always active, mirroring the provider).
const compiled = compileKeymap(DEFAULT_KEYMAP);
const press = (seq: string, ...contexts: string[]) =>
  resolve(compiled, new Set([CONTEXTS.workspace, ...contexts]), parseSequence(seq));

describe("DEFAULT_KEYMAP — go-to-heading (Cmd+Shift+O)", () => {
  it("resolves in the QA context (WYSIWYG + raw view of qa/plain docs)", () => {
    expect(press("cmd-shift-o", CONTEXTS.qa)).toEqual({
      kind: "action",
      action: ACTIONS.goToSymbol,
      arg: undefined,
    });
  });

  it("resolves in the Editor context (raw markdown view of a todo doc)", () => {
    expect(press("cmd-shift-o", CONTEXTS.editor)).toEqual({
      kind: "action",
      action: ACTIONS.goToSymbol,
      arg: undefined,
    });
  });

  it("does not fire outside a markdown view (Workspace alone, or the task grid)", () => {
    expect(press("cmd-shift-o").kind).toBe("none");
    expect(press("cmd-shift-o", CONTEXTS.grid).kind).toBe("none");
  });

  it("matches Ctrl+Shift+O too (mod is the cross-platform accelerator)", () => {
    expect(press("ctrl-shift-o", CONTEXTS.qa)).toEqual({
      kind: "action",
      action: ACTIONS.goToSymbol,
      arg: undefined,
    });
  });

  it("stays distinct from its modifier neighbors (Cmd+O open, Cmd+Shift+P print)", () => {
    expect(press("cmd-o", CONTEXTS.qa)).toEqual({
      kind: "action",
      action: ACTIONS.openFile,
      arg: undefined,
    });
    expect(press("cmd-shift-p", CONTEXTS.qa)).toEqual({
      kind: "action",
      action: ACTIONS.print,
      arg: undefined,
    });
  });
});
