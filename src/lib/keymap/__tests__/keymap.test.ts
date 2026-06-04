import { describe, it, expect } from "vitest";
import { compileKeymap, resolve, type Keymap } from "../keymap";
import { parseSequence, eventToKeystroke } from "../keystroke";
import { DEFAULT_KEYMAP } from "../default-keymap";
import { parseUserKeymap } from "../user-keymap";

const ks = (key: string, mods: Partial<{ meta: boolean; ctrl: boolean; shift: boolean }> = {}) =>
  eventToKeystroke({ key, metaKey: !!mods.meta, ctrlKey: !!mods.ctrl, altKey: false, shiftKey: !!mods.shift });

const set = (...n: string[]) => new Set(n);

describe("resolve", () => {
  const keymap: Keymap = [
    { context: "Workspace", bindings: { "mod-s": "editor::Save", "mod-1": ["workspace::ActivateTab", 0] } },
    { context: "Grid", bindings: { "mod-f": "grid::FocusFilter" } },
    { context: "QA", bindings: { "mod-f": "editor::Find" } },
    { context: "Workspace", bindings: { "mod-k mod-s": "app::OpenKeymap" } },
  ];
  const compiled = compileKeymap(keymap);

  it("resolves a simple binding to its action", () => {
    expect(resolve(compiled, set("Workspace"), [ks("s", { meta: true })])).toEqual({
      kind: "action",
      action: "editor::Save",
      arg: undefined,
    });
  });

  it("passes an action argument through", () => {
    expect(resolve(compiled, set("Workspace"), [ks("1", { meta: true })])).toEqual({
      kind: "action",
      action: "workspace::ActivateTab",
      arg: 0,
    });
  });

  it("gates on context — same key resolves differently per context", () => {
    expect(resolve(compiled, set("Workspace", "Grid"), [ks("f", { meta: true })])).toMatchObject({
      action: "grid::FocusFilter",
    });
    expect(resolve(compiled, set("Workspace", "QA"), [ks("f", { meta: true })])).toMatchObject({
      action: "editor::Find",
    });
    // Neither context active → no binding.
    expect(resolve(compiled, set("Workspace"), [ks("f", { meta: true })])).toEqual({ kind: "none" });
  });

  it("reports pending while a chord prefix is matched, then completes", () => {
    const k = ks("k", { meta: true });
    const s = ks("s", { meta: true });
    expect(resolve(compiled, set("Workspace"), [k])).toEqual({ kind: "pending" });
    expect(resolve(compiled, set("Workspace"), [k, s])).toMatchObject({ action: "app::OpenKeymap" });
  });

  it("returns none for an unbound key", () => {
    expect(resolve(compiled, set("Workspace"), [ks("j", { meta: true })])).toEqual({ kind: "none" });
  });
});

describe("precedence", () => {
  it("a later (user) binding overrides an earlier default for the same key+context", () => {
    const keymap: Keymap = [
      { context: "Workspace", bindings: { "mod-s": "editor::Save" } },
      { context: "Workspace", bindings: { "mod-s": "editor::SaveAll" } }, // user override appended later
    ];
    expect(resolve(compileKeymap(keymap), set("Workspace"), [ks("s", { meta: true })])).toMatchObject({
      action: "editor::SaveAll",
    });
  });

  it("a context-bearing binding beats a context-less one", () => {
    const keymap: Keymap = [
      { bindings: { "mod-f": "global::Find" } }, // no context
      { context: "Grid", bindings: { "mod-f": "grid::FocusFilter" } },
    ];
    const compiled = compileKeymap(keymap);
    expect(resolve(compiled, set("Grid"), [ks("f", { meta: true })])).toMatchObject({ action: "grid::FocusFilter" });
    // Outside Grid, the context-less binding still applies.
    expect(resolve(compiled, set("Workspace"), [ks("f", { meta: true })])).toMatchObject({ action: "global::Find" });
  });

  it("null unbinds a key (suppresses without dispatching)", () => {
    const keymap: Keymap = [
      { context: "Workspace", bindings: { "mod-s": "editor::Save" } },
      { context: "Workspace", bindings: { "mod-s": null } }, // user disables it
    ];
    expect(resolve(compileKeymap(keymap), set("Workspace"), [ks("s", { meta: true })])).toEqual({ kind: "none" });
  });
});

describe("user override end-to-end (the real customization path)", () => {
  it("a saved global binding for a new key resolves to its action over the defaults", () => {
    const user = parseUserKeymap(
      `[{ "context": "Workspace", "bindings": { "cmd-shift-x": "editor::CopyPath" } }]`,
    );
    expect(user.error).toBeNull();
    const compiled = compileKeymap([...DEFAULT_KEYMAP, ...user.keymap]);
    // Cmd+Shift+X in the always-on Workspace context.
    const res = resolve(compiled, set("Workspace"), [ks("X", { meta: true, shift: true })]);
    expect(res).toMatchObject({ kind: "action", action: "editor::CopyPath" });
  });

  it("the same key bound only to an inactive context does NOT fire (the common gotcha)", () => {
    const user = parseUserKeymap(
      `[{ "context": "Editor", "bindings": { "cmd-shift-x": "editor::CopyPath" } }]`,
    );
    const compiled = compileKeymap([...DEFAULT_KEYMAP, ...user.keymap]);
    // In QA (editing a markdown doc) the "Editor" context is not active → no match.
    expect(resolve(compiled, set("Workspace", "QA"), [ks("X", { meta: true, shift: true })])).toEqual({
      kind: "none",
    });
    // In the Editor context it fires.
    expect(
      resolve(compiled, set("Workspace", "Editor"), [ks("X", { meta: true, shift: true })]),
    ).toMatchObject({ action: "editor::CopyPath" });
  });
});

describe("parseSequence integration", () => {
  it("multi-stroke binding keys are compiled to sequences", () => {
    const keymap: Keymap = [{ bindings: { "mod-k mod-s": "app::OpenKeymap" } }];
    const compiled = compileKeymap(keymap);
    expect(compiled.bindings[0].sequence).toEqual(parseSequence("mod-k mod-s"));
  });
});
