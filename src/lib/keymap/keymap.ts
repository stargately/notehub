/**
 * The keymap matcher: resolve a pressed keystroke sequence + active contexts into an action.
 *
 * A keymap is an ordered list of blocks, each an optional `context` predicate plus a map of
 * keystroke-sequence → action. Precedence (Zed-like): a binding with a context beats a context-less
 * one; ties break toward the binding declared **later** in the list — so a user keymap appended
 * after the defaults overrides them. An action of `null` explicitly **unbinds** a key.
 */

import { compileContext } from "./context";
import { keystrokeMatches, parseSequence, type Keystroke } from "./keystroke";

/** Action value: a name, a `[name, arg]` pair, or `null` to unbind. */
export type ActionValue = string | [string, unknown] | null;

export interface KeymapBlock {
  context?: string;
  bindings: Record<string, ActionValue>;
}

export type Keymap = KeymapBlock[];

interface CompiledBinding {
  sequence: Keystroke[];
  matches: (active: Set<string>) => boolean;
  hasContext: boolean;
  order: number;
  action: string | null;
  arg?: unknown;
}

export interface CompiledKeymap {
  bindings: CompiledBinding[];
}

/** Flatten + compile a keymap (predicates, sequences) once; cheap to resolve against repeatedly. */
export function compileKeymap(keymap: Keymap): CompiledKeymap {
  const bindings: CompiledBinding[] = [];
  let order = 0;
  for (const block of keymap) {
    const matches = compileContext(block.context);
    const hasContext = !!block.context && !!block.context.trim();
    for (const [seq, value] of Object.entries(block.bindings)) {
      let action: string | null = null;
      let arg: unknown;
      if (Array.isArray(value)) {
        action = value[0];
        arg = value[1];
      } else {
        action = value; // string or null
      }
      bindings.push({
        sequence: parseSequence(seq),
        matches,
        hasContext,
        order: order++,
        action,
        arg,
      });
    }
  }
  return { bindings };
}

/** Does `pressed` match the first `pressed.length` keystrokes of `sequence`? */
function isPrefix(sequence: Keystroke[], pressed: Keystroke[]): boolean {
  if (pressed.length > sequence.length) return false;
  for (let i = 0; i < pressed.length; i++) {
    if (!keystrokeMatches(sequence[i], pressed[i])) return false;
  }
  return true;
}

export type Resolution =
  | { kind: "action"; action: string; arg?: unknown }
  | { kind: "pending" } // pressed sequence is a strict prefix of a longer binding
  | { kind: "none" };

/** Higher precedence wins: context-bearing over context-less, then later-declared. */
function better(a: CompiledBinding, b: CompiledBinding): CompiledBinding {
  if (a.hasContext !== b.hasContext) return a.hasContext ? a : b;
  return a.order > b.order ? a : b;
}

/**
 * Resolve the keys pressed so far against the keymap and the active context set:
 * - `action` — a complete, highest-precedence binding matched (or it was explicitly unbound).
 * - `pending` — the keys are a prefix of a longer chord; wait for more input.
 * - `none` — nothing matches; let the event through.
 */
export function resolve(
  compiled: CompiledKeymap,
  active: Set<string>,
  pressed: Keystroke[],
): Resolution {
  let exact: CompiledBinding | null = null;
  let pending = false;
  for (const b of compiled.bindings) {
    if (!b.matches(active)) continue;
    if (!isPrefix(b.sequence, pressed)) continue;
    if (b.sequence.length === pressed.length) {
      exact = exact ? better(exact, b) : b;
    } else {
      pending = true; // strict prefix → a longer chord could still complete
    }
  }
  if (exact) {
    // An explicit unbind (null) suppresses the key without dispatching anything.
    if (exact.action === null) return { kind: "none" };
    return { kind: "action", action: exact.action, arg: exact.arg };
  }
  if (pending) return { kind: "pending" };
  return { kind: "none" };
}
