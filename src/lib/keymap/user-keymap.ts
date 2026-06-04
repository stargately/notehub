import type { Keymap } from "./keymap";

/**
 * User keymap overrides — a JSON array of keymap blocks persisted to localStorage. Layered AFTER
 * the default keymap, so a user block re-binding (or `null`-unbinding) a key wins. This is the
 * customization surface, like Zed's `~/.config/zed/keymap.json`.
 */
const STORAGE_KEY = "nh-keymap";

/** Raw JSON text the user last saved (empty string if none). */
export function loadUserKeymapText(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function saveUserKeymapText(text: string): void {
  try {
    if (text.trim()) window.localStorage.setItem(STORAGE_KEY, text);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore (e.g. private mode) */
  }
}

/** Remove `//` and `/* *​/` comments, ignoring anything inside string literals. */
function stripComments(input: string): string {
  let out = "";
  let inString = false;
  let quote = "";
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    const next = input[i + 1];
    if (inString) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i++;
      } else if (c === quote) {
        inString = false;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      out += c;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i + 1 < input.length && input[i + 1] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++;
      i++; // skip the closing '/'
      continue;
    }
    out += c;
  }
  return out;
}

/** Drop trailing commas (a comma whose next significant char is `}`/`]`), string-aware. */
function removeTrailingCommas(input: string): string {
  let out = "";
  let inString = false;
  let quote = "";
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inString) {
      out += c;
      if (c === "\\") {
        out += input[i + 1] ?? "";
        i++;
      } else if (c === quote) {
        inString = false;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inString = true;
      quote = c;
      out += c;
      continue;
    }
    if (c === ",") {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j++;
      if (input[j] === "}" || input[j] === "]") continue; // trailing comma → drop
    }
    out += c;
  }
  return out;
}

/**
 * Strip JSONC niceties so the editor tolerates what Zed's keymap.json does: `//` and `/* *​/`
 * comments and trailing commas. Two string-aware passes (comments first, then trailing commas) so
 * a comma sitting before a comment-then-`}` is still recognized as trailing.
 */
export function stripJsonc(input: string): string {
  return removeTrailingCommas(stripComments(input));
}

/**
 * Return a user-facing error if any binding targets an action not in `known` — otherwise a typo'd
 * action name (e.g. `workspace::CopyPath`) would bind silently and do nothing. `null` unbinds and
 * is always allowed. Pure so it's unit-tested; the provider passes the real action set.
 */
export function validateKeymapActions(keymap: Keymap, known: ReadonlySet<string>): string | null {
  const unknown = new Set<string>();
  for (const block of keymap) {
    for (const value of Object.values(block.bindings)) {
      const action = Array.isArray(value) ? value[0] : value;
      if (action && !known.has(action)) unknown.add(action);
    }
  }
  if (unknown.size === 0) return null;
  return `Unknown action${unknown.size > 1 ? "s" : ""}: ${[...unknown]
    .map((a) => `"${a}"`)
    .join(", ")}. Use one of the action names listed below (e.g. "editor::CopyPath").`;
}

/** Parse + lightly validate the user keymap text. Returns the blocks and a parse error (if any). */
export function parseUserKeymap(text: string): { keymap: Keymap; error: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { keymap: [], error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonc(trimmed));
  } catch (e) {
    return { keymap: [], error: `Invalid JSON: ${(e as Error).message}` };
  }
  if (!Array.isArray(parsed)) {
    return { keymap: [], error: "Keymap must be a JSON array of { context?, bindings } blocks." };
  }
  for (const block of parsed) {
    if (typeof block !== "object" || block === null || Array.isArray(block)) {
      return { keymap: [], error: "Each block must be an object." };
    }
    const b = block as Record<string, unknown>;
    if (typeof b.bindings !== "object" || b.bindings === null || Array.isArray(b.bindings)) {
      return { keymap: [], error: "Each block needs a `bindings` object (keystroke → action)." };
    }
    if (b.context !== undefined && typeof b.context !== "string") {
      return { keymap: [], error: "`context` must be a string." };
    }
  }
  return { keymap: parsed as Keymap, error: null };
}
