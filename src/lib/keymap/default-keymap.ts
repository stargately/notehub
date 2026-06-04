import type { Keymap } from "./keymap";

/**
 * NoteHub's default keymap, modeled on Zed's `default.json`: ordered blocks of
 * `context` + `keystroke → action`. `mod` is the primary accelerator (⌘ on macOS, Ctrl elsewhere).
 * Users layer overrides on top via the keymap editor (see `user-keymap.ts`); their blocks are
 * appended after these, so they win ties.
 *
 * This is the single source of truth for the app's shortcuts — every binding here used to live in
 * an ad-hoc `keydown` listener (`useKeyboardShortcuts`, `Toolbar`, `QaLayout`, `TerminalPanel`).
 */
export const DEFAULT_KEYMAP: Keymap = [
  {
    // Global — available everywhere (the "Workspace" context is always active).
    context: "Workspace",
    bindings: {
      "mod-p": "file::QuickOpen",
      "mod-o": "file::Open",
      "mod-b": "workspace::ToggleSidebar",
      "mod-`": "workspace::ToggleTerminal",
      "mod-r": "editor::Reload",
      "mod-s": "editor::Save",
      "mod-/": "editor::ToggleRawView",
      "mod-shift-c": "editor::CopyPath",
      "mod-1": ["workspace::ActivateTab", 0],
      "mod-2": ["workspace::ActivateTab", 1],
      "mod-3": ["workspace::ActivateTab", 2],
      "mod-4": ["workspace::ActivateTab", 3],
      "mod-5": ["workspace::ActivateTab", 4],
      "mod-6": ["workspace::ActivateTab", 5],
      "mod-7": ["workspace::ActivateTab", 6],
      "mod-8": ["workspace::ActivateTab", 7],
      "mod-9": ["workspace::ActivateTab", 8],
    },
  },
  {
    // Task-table (grid) view.
    context: "Grid",
    bindings: {
      "mod-z": "editor::Undo",
      "mod-shift-z": "editor::Redo",
      "mod-n": "grid::NewTask",
      "mod-f": "grid::FocusFilter",
    },
  },
  {
    // Milkdown WYSIWYG editor (layout: qa and plain markdown docs).
    context: "QA",
    bindings: {
      "mod-shift-p": "editor::Print",
      "mod-f": "editor::Find",
    },
  },
  {
    // Integrated terminal (when focused).
    context: "Terminal",
    bindings: {
      "mod-d": "terminal::SplitPane",
    },
  },
];
