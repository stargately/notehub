/**
 * Action names dispatched by the keymap. Namespaced `domain::Name` like Zed. The keymap maps
 * keystrokes → these names; views register handlers for them via `useKeymapAction`.
 */
export const ACTIONS = {
  // file / workspace
  quickOpen: "file::QuickOpen",
  openFile: "file::Open",
  toggleSidebar: "workspace::ToggleSidebar",
  toggleTerminal: "workspace::ToggleTerminal",
  activateTab: "workspace::ActivateTab", // arg: 0-based tab index
  openKeymap: "app::OpenKeymap",

  // editor / document
  save: "editor::Save",
  reload: "editor::Reload",
  toggleRawView: "editor::ToggleRawView",
  copyPath: "editor::CopyPath",
  undo: "editor::Undo",
  redo: "editor::Redo",
  find: "editor::Find",
  print: "editor::Print",

  // grid / task table
  newTask: "grid::NewTask",
  focusFilter: "grid::FocusFilter",

  // terminal
  splitTerminal: "terminal::SplitPane",
} as const;

export type ActionName = (typeof ACTIONS)[keyof typeof ACTIONS];

/** Every action a binding can target. Used to reject typo'd action names when saving a keymap. */
export const KNOWN_ACTIONS: ReadonlySet<string> = new Set(Object.values(ACTIONS));

/** Context names the app contributes (used in default-keymap predicates). */
export const CONTEXTS = {
  workspace: "Workspace",
  grid: "Grid", // task table view active
  editor: "Editor", // raw Monaco markdown editor active
  qa: "QA", // Milkdown WYSIWYG (qa / plain markdown) active
  rawFile: "RawFile", // non-markdown raw/image file active
  terminal: "Terminal", // terminal panel visible & focused
} as const;
