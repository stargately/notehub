/**
 * Command-palette metadata: friendly titles for the keymap actions plus the pure logic that turns
 * "what's registered + what contexts are active" into the palette's row list.
 *
 * The palette lists an action iff it has a title here AND a handler is currently registered for it
 * (the same availability test the key dispatcher uses — so "shown" always means "runnable").
 * Actions that require an argument (`workspace::ActivateTab`) and the palette itself are left out
 * of the title map on purpose.
 */

import { ACTIONS } from "./actions";
import { compileKeymap, resolve, type Keymap } from "./keymap";
import { parseSequence, type Keystroke } from "./keystroke";

export interface PaletteCommand {
  /** The keymap action name (`domain::Name`). */
  action: string;
  /** Human-friendly display title. */
  title: string;
  /** Binding-syntax keystroke that triggers the action right now, or null if none does. */
  keystroke: string | null;
}

/** Friendly titles for palette display — the `domain::Name` ids are too terse for users. */
export const COMMAND_TITLES: Record<string, string> = {
  [ACTIONS.quickOpen]: "Go to File…",
  [ACTIONS.openFile]: "Open File…",
  [ACTIONS.toggleSidebar]: "Toggle Sidebar",
  [ACTIONS.toggleTerminal]: "Toggle Terminal",
  [ACTIONS.closeTab]: "Close Tab",
  [ACTIONS.openKeymap]: "Open Keyboard Shortcuts",
  [ACTIONS.save]: "Save File",
  [ACTIONS.reload]: "Reload File",
  [ACTIONS.toggleRawView]: "Toggle Raw Markdown View",
  [ACTIONS.copyPath]: "Copy File Path",
  [ACTIONS.undo]: "Undo",
  [ACTIONS.redo]: "Redo",
  [ACTIONS.find]: "Find & Replace…",
  [ACTIONS.print]: "Print Document…",
  [ACTIONS.goToSymbol]: "Go to Heading…",
  [ACTIONS.toggleOutline]: "Toggle Outline Panel",
  [ACTIONS.pasteAsPlainText]: "Paste as Plain Text",
  [ACTIONS.newTask]: "New Task",
  [ACTIONS.focusFilter]: "Filter Tasks",
  [ACTIONS.splitTerminal]: "Split Terminal Pane",
  // Intentionally untitled (and so never listed): ACTIONS.activateTab (needs a tab-index arg)
  // and ACTIONS.openCommandPalette (the palette itself).
};

/**
 * Build the palette's rows: every titled action with a registered handler, alphabetical by title.
 * Each row carries the keystroke that would actually trigger the action under the active contexts —
 * verified through the real resolver, so an unbound, shadowed, or inactive-context binding shows
 * no key rather than a key that wouldn't work.
 */
export function paletteCommands(
  keymap: Keymap,
  activeContexts: Iterable<string>,
  registeredActions: Iterable<string>,
): PaletteCommand[] {
  const active = new Set(activeContexts);
  const compiled = compileKeymap(keymap);

  // All keystrokes declared for each action, in declaration order (later = higher precedence).
  const candidates = new Map<string, string[]>();
  for (const block of keymap) {
    for (const [seq, value] of Object.entries(block.bindings)) {
      const action = Array.isArray(value) ? value[0] : value;
      if (!action) continue;
      const list = candidates.get(action) ?? [];
      list.push(seq);
      candidates.set(action, list);
    }
  }

  // resolve() takes *pressed* keystrokes, where `mod` is never set — concretize it as Meta so a
  // `mod-…` binding sequence can be replayed through the resolver as if the user pressed it.
  const asPressed = (ks: Keystroke): Keystroke =>
    ks.mod ? { ...ks, mod: false, meta: true } : ks;

  const keystrokeFor = (action: string): string | null => {
    const seqs = candidates.get(action);
    if (!seqs) return null;
    // Last-declared first, so a user remap (appended after the defaults) is the one displayed.
    for (let i = seqs.length - 1; i >= 0; i--) {
      const res = resolve(compiled, active, parseSequence(seqs[i]).map(asPressed));
      if (res.kind === "action" && res.action === action) return seqs[i];
    }
    return null;
  };

  const rows: PaletteCommand[] = [];
  for (const action of new Set(registeredActions)) {
    const title = COMMAND_TITLES[action];
    if (!title) continue;
    rows.push({ action, title, keystroke: keystrokeFor(action) });
  }
  rows.sort((a, b) => a.title.localeCompare(b.title));
  return rows;
}
