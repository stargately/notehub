/**
 * Keystroke parsing & matching for the Zed-style keymap.
 *
 * A keystroke is a key plus modifiers, written like Zed: `cmd-shift-p`, `ctrl-\``, `alt-left`.
 * Modifiers: `cmd` (Meta), `ctrl` (Control), `alt`/`opt`/`option` (Alt), `shift`, and the
 * platform-agnostic `mod` — the primary accelerator, which matches **either** Meta or Control so a
 * single keymap works on macOS (⌘) and Windows/Linux (Ctrl), mirroring the app's old
 * `e.metaKey || e.ctrlKey` checks.
 *
 * A binding's value can be a single keystroke or a space-separated **sequence** (chord), e.g.
 * `cmd-k cmd-s`, matched stroke-by-stroke against successive key presses.
 */

export interface Keystroke {
  meta: boolean;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  /** The binding used `mod` (primary accelerator); matches Meta OR Ctrl. Always false on events. */
  mod: boolean;
  /** Normalized, lower-cased key name (e.g. "p", "/", "`", "left", "escape", "f2"). */
  key: string;
}

const SPECIAL_KEYS: Record<string, string> = {
  arrowup: "up",
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  " ": "space",
  spacebar: "space",
  esc: "escape",
};

/** Normalize a binding-token key or an event key to a canonical lower-case name. */
export function normalizeKey(raw: string): string {
  const k = raw.toLowerCase();
  return SPECIAL_KEYS[k] ?? k;
}

/** Parse a single keystroke token like "cmd-shift-p" into a {@link Keystroke}. */
export function parseKeystroke(token: string): Keystroke {
  const ks: Keystroke = { meta: false, ctrl: false, alt: false, shift: false, mod: false, key: "" };
  // Split on "-" but keep a trailing "-" as the literal minus key (e.g. "cmd--").
  const parts = token.split("-");
  // If the token ends with "-", the final empty segment means the key is "-".
  let keyPart = parts.pop() ?? "";
  if (keyPart === "" && parts.length > 0) keyPart = "-";
  for (const p of parts) {
    switch (p.toLowerCase()) {
      case "cmd":
      case "super":
      case "win":
        ks.meta = true;
        break;
      case "ctrl":
      case "control":
        ks.ctrl = true;
        break;
      case "alt":
      case "opt":
      case "option":
        ks.alt = true;
        break;
      case "shift":
        ks.shift = true;
        break;
      case "mod":
        ks.mod = true;
        break;
      default:
        // Unknown modifier — ignore (lenient).
        break;
    }
  }
  ks.key = normalizeKey(keyPart);
  return ks;
}

/** Parse a space-separated keystroke sequence ("cmd-k cmd-s") into its keystrokes. */
export function parseSequence(seq: string): Keystroke[] {
  return seq
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(parseKeystroke);
}

/** Build the {@link Keystroke} a keyboard event represents (modifier-only presses → empty key). */
export function eventToKeystroke(e: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): Keystroke {
  const key = e.key;
  // A bare modifier press has no actionable key.
  const isModifierOnly = key === "Meta" || key === "Control" || key === "Alt" || key === "Shift";
  return {
    meta: e.metaKey,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
    mod: false,
    key: isModifierOnly ? "" : normalizeKey(key),
  };
}

/** Whether an event keystroke satisfies a binding keystroke (handles the `mod` alias). */
export function keystrokeMatches(binding: Keystroke, event: Keystroke): boolean {
  if (!binding.key || binding.key !== event.key) return false;
  if (binding.alt !== event.alt) return false;
  if (binding.shift !== event.shift) return false;
  if (binding.mod) {
    // Primary accelerator: Meta OR Ctrl (lenient, cross-platform).
    return event.meta || event.ctrl;
  }
  return binding.meta === event.meta && binding.ctrl === event.ctrl;
}

const MAC_SYMBOLS: Record<keyof Pick<Keystroke, "meta" | "ctrl" | "alt" | "shift">, string> = {
  meta: "⌘",
  ctrl: "⌃",
  alt: "⌥",
  shift: "⇧",
};

const KEY_LABELS: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
  space: "Space",
  escape: "Esc",
  enter: "↵",
  "`": "`",
};

/** Human-readable label for a keystroke sequence, themed per platform (⌘ on mac, "Ctrl" else). */
export function formatSequence(seq: string, isMac: boolean): string {
  return parseSequence(seq)
    .map((ks) => formatKeystroke(ks, isMac))
    .join(" ");
}

function formatKeystroke(ks: Keystroke, isMac: boolean): string {
  const mods: string[] = [];
  if (ks.mod) mods.push(isMac ? MAC_SYMBOLS.meta : "Ctrl");
  if (ks.ctrl && !ks.mod) mods.push(isMac ? MAC_SYMBOLS.ctrl : "Ctrl");
  if (ks.meta && !ks.mod) mods.push(isMac ? MAC_SYMBOLS.meta : "Win");
  if (ks.alt) mods.push(isMac ? MAC_SYMBOLS.alt : "Alt");
  if (ks.shift) mods.push(isMac ? MAC_SYMBOLS.shift : "Shift");
  const key = KEY_LABELS[ks.key] ?? (ks.key.length === 1 ? ks.key.toUpperCase() : ks.key);
  const sep = isMac ? "" : "+";
  return [...mods, key].join(sep);
}
