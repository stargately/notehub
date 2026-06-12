import { describe, it, expect } from "vitest";
import { COMMAND_TITLES, paletteCommands } from "../commands";
import { DEFAULT_KEYMAP } from "../default-keymap";
import { ACTIONS, CONTEXTS } from "../actions";
import type { Keymap } from "../keymap";

const WS = CONTEXTS.workspace;

describe("COMMAND_TITLES", () => {
  it("titles every action except the arg-carrying and self-referential ones", () => {
    const untitled: string[] = [ACTIONS.activateTab, ACTIONS.openCommandPalette];
    for (const action of Object.values(ACTIONS)) {
      if (untitled.includes(action)) {
        expect(COMMAND_TITLES[action], action).toBeUndefined();
      } else {
        expect(COMMAND_TITLES[action], action).toBeTruthy();
      }
    }
  });
});

describe("paletteCommands", () => {
  it("lists only registered actions that have a title, alphabetically by title", () => {
    const rows = paletteCommands(
      DEFAULT_KEYMAP,
      [WS],
      [ACTIONS.save, ACTIONS.reload, ACTIONS.activateTab, "custom::Unknown"],
    );
    expect(rows.map((r) => r.action)).toEqual([ACTIONS.reload, ACTIONS.save]); // Reload < Save
    expect(rows.map((r) => r.title)).toEqual(["Reload File", "Save File"]);
  });

  it("shows a keystroke only when the binding's context is active", () => {
    const registered = [ACTIONS.save, ACTIONS.find, ACTIONS.print];

    const workspaceOnly = paletteCommands(DEFAULT_KEYMAP, [WS], registered);
    expect(workspaceOnly.find((r) => r.action === ACTIONS.save)?.keystroke).toBe("mod-s");
    expect(workspaceOnly.find((r) => r.action === ACTIONS.find)?.keystroke).toBeNull();
    expect(workspaceOnly.find((r) => r.action === ACTIONS.print)?.keystroke).toBeNull();

    const withQa = paletteCommands(DEFAULT_KEYMAP, [WS, CONTEXTS.qa], registered);
    expect(withQa.find((r) => r.action === ACTIONS.find)?.keystroke).toBe("mod-f");
    expect(withQa.find((r) => r.action === ACTIONS.print)?.keystroke).toBe("mod-shift-e");
  });

  it("lists an action with a registered handler even if it has no binding at all", () => {
    const rows = paletteCommands(DEFAULT_KEYMAP, [WS], [ACTIONS.toggleOutline]);
    expect(rows).toEqual([
      { action: ACTIONS.toggleOutline, title: "Toggle Outline Panel", keystroke: null },
    ]);
  });

  it("prefers a later-declared (user-override) binding for display", () => {
    const keymap: Keymap = [
      ...DEFAULT_KEYMAP,
      { context: WS, bindings: { "mod-shift-x": ACTIONS.save } },
    ];
    const rows = paletteCommands(keymap, [WS], [ACTIONS.save]);
    expect(rows[0].keystroke).toBe("mod-shift-x");
  });

  it("hides a keystroke that is unbound or shadowed by a later binding", () => {
    const unbound: Keymap = [...DEFAULT_KEYMAP, { context: WS, bindings: { "mod-s": null } }];
    expect(paletteCommands(unbound, [WS], [ACTIONS.save])[0].keystroke).toBeNull();

    const shadowed: Keymap = [
      ...DEFAULT_KEYMAP,
      { context: WS, bindings: { "mod-s": ACTIONS.reload } },
    ];
    const rows = paletteCommands(shadowed, [WS], [ACTIONS.save, ACTIONS.reload]);
    // mod-s now resolves to reload, so showing it next to Save would be a lie.
    expect(rows.find((r) => r.action === ACTIONS.save)?.keystroke).toBeNull();
    expect(rows.find((r) => r.action === ACTIONS.reload)?.keystroke).toBe("mod-s");
  });
});
