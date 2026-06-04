import { describe, it, expect } from "vitest";
import { parseUserKeymap, stripJsonc, validateKeymapActions } from "../user-keymap";
import { KNOWN_ACTIONS } from "../actions";
import type { Keymap } from "../keymap";

describe("parseUserKeymap (JSONC-tolerant, like Zed)", () => {
  it("accepts a trailing comma after the last binding", () => {
    const text = `[
      {
        "context": "Editor",
        "bindings": {
          "cmd-shift-x": "editor::CopyPath",
        }
      }
    ]`;
    const { keymap, error } = parseUserKeymap(text);
    expect(error).toBeNull();
    expect(keymap).toEqual([{ context: "Editor", bindings: { "cmd-shift-x": "editor::CopyPath" } }]);
  });

  it("accepts // and /* */ comments and trailing commas in arrays", () => {
    const text = `[
      // global overrides
      {
        "bindings": {
          "mod-p": null, /* unbind quick-open */
        },
      },
    ]`;
    const { keymap, error } = parseUserKeymap(text);
    expect(error).toBeNull();
    expect(keymap).toEqual([{ bindings: { "mod-p": null } }]);
  });

  it("empty text is valid (no overrides)", () => {
    expect(parseUserKeymap("   ")).toEqual({ keymap: [], error: null });
  });

  it("reports a clear error for non-array / bad shape", () => {
    expect(parseUserKeymap(`{ "bindings": {} }`).error).toMatch(/array/i);
    expect(parseUserKeymap(`[{ "context": "X" }]`).error).toMatch(/bindings/i);
  });

  it("preserves commas and slashes inside string values", () => {
    // The string value contains a comma and `//`; the sanitizer must not touch them.
    const out = stripJsonc(`{ "a": "x, y // z" }`);
    expect(out).toContain('"x, y // z"');
  });
});

describe("validateKeymapActions", () => {
  const known = new Set(["editor::CopyPath", "file::QuickOpen", "workspace::ActivateTab"]);

  it("accepts known actions", () => {
    const keymap: Keymap = [{ bindings: { "cmd-shift-x": "editor::CopyPath" } }];
    expect(validateKeymapActions(keymap, known)).toBeNull();
  });

  it("rejects a typo'd action and names it (the real bug: workspace::CopyPath)", () => {
    const keymap: Keymap = [{ context: "Editor", bindings: { "cmd-shift-x": "workspace::CopyPath" } }];
    const err = validateKeymapActions(keymap, known);
    expect(err).toContain("Unknown action");
    expect(err).toContain('"workspace::CopyPath"');
  });

  it("pluralizes and lists multiple unknown actions", () => {
    const keymap: Keymap = [{ bindings: { "cmd-1": "foo::Bar", "cmd-2": "baz::Qux" } }];
    const err = validateKeymapActions(keymap, known);
    expect(err).toContain("Unknown actions");
    expect(err).toContain('"foo::Bar"');
    expect(err).toContain('"baz::Qux"');
  });

  it("ignores null (unbind) and validates the action of a [action, arg] pair", () => {
    const ok: Keymap = [{ bindings: { "mod-p": null, "mod-1": ["workspace::ActivateTab", 0] } }];
    expect(validateKeymapActions(ok, known)).toBeNull();
    const bad: Keymap = [{ bindings: { "mod-1": ["workspace::Nope", 0] } }];
    expect(validateKeymapActions(bad, known)).toContain('"workspace::Nope"');
  });

  it("the real KNOWN_ACTIONS set has editor::CopyPath but not workspace::CopyPath", () => {
    expect(KNOWN_ACTIONS.has("editor::CopyPath")).toBe(true);
    expect(KNOWN_ACTIONS.has("file::QuickOpen")).toBe(true);
    expect(KNOWN_ACTIONS.has("workspace::CopyPath")).toBe(false);
  });
});
