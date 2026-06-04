import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type MutableRefObject,
} from "react";
import { compileKeymap, resolve, type Keymap } from "./keymap";
import { eventToKeystroke, type Keystroke } from "./keystroke";
import { DEFAULT_KEYMAP } from "./default-keymap";
import { CONTEXTS, KNOWN_ACTIONS } from "./actions";
import {
  loadUserKeymapText,
  parseUserKeymap,
  saveUserKeymapText,
  validateKeymapActions,
} from "./user-keymap";

type ActionHandler = (arg?: unknown) => void;
type HandlerRef = MutableRefObject<ActionHandler>;

interface KeymapApi {
  /** Register a handler (by ref so it can update freely). Returns an unregister fn. */
  registerAction: (action: string, ref: HandlerRef) => () => void;
  /** Mark a context name active; returns a cleanup that deactivates it. */
  pushContext: (name: string) => () => void;
  /** Snapshot of the currently-active context names (for the keybindings viewer / debugging). */
  getActiveContexts: () => string[];
  /** Default + user blocks merged, for display in the keybindings viewer. */
  mergedKeymap: Keymap;
  defaultKeymap: Keymap;
  /** Raw user-override JSON text + a validating setter (returns an error string or null). */
  userKeymapText: string;
  setUserKeymapText: (text: string) => string | null;
  resetUserKeymap: () => void;
  isMac: boolean;
}

const Ctx = createContext<KeymapApi | null>(null);

/** How long a chord prefix waits for its next keystroke before resetting. */
const CHORD_TIMEOUT_MS = 1200;

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent);
}

/**
 * Hosts the single window-level key dispatcher for the Zed-style keymap. Keystrokes are matched
 * against the merged keymap + active contexts into actions; the most-recently-registered handler
 * for an action (the focused view) runs it. Multi-stroke chords are buffered with a timeout.
 */
export function KeymapProvider({ children }: { children: ReactNode }) {
  const isMac = useMemo(detectMac, []);
  const [userKeymapText, setUserText] = useState(loadUserKeymapText);

  const mergedKeymap = useMemo<Keymap>(
    () => [...DEFAULT_KEYMAP, ...parseUserKeymap(userKeymapText).keymap],
    [userKeymapText],
  );
  const compiled = useMemo(() => compileKeymap(mergedKeymap), [mergedKeymap]);
  // Keep the live compiled keymap in a ref so the (mount-once) keydown listener always sees latest.
  const compiledRef = useRef(compiled);
  compiledRef.current = compiled;

  // action name → stack of handler refs (last registered = focused view = highest priority).
  const handlers = useRef(new Map<string, HandlerRef[]>());
  // context name → active count.
  const contexts = useRef(new Map<string, number>());
  const pending = useRef<Keystroke[]>([]);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerAction = useCallback((action: string, ref: HandlerRef) => {
    const stack = handlers.current.get(action) ?? [];
    stack.push(ref);
    handlers.current.set(action, stack);
    return () => {
      const s = handlers.current.get(action);
      if (!s) return;
      const i = s.indexOf(ref);
      if (i >= 0) s.splice(i, 1);
      if (s.length === 0) handlers.current.delete(action);
    };
  }, []);

  const pushContext = useCallback((name: string) => {
    contexts.current.set(name, (contexts.current.get(name) ?? 0) + 1);
    return () => {
      const n = (contexts.current.get(name) ?? 0) - 1;
      if (n <= 0) contexts.current.delete(name);
      else contexts.current.set(name, n);
    };
  }, []);

  const getActiveContexts = useCallback(
    () => [...new Set([CONTEXTS.workspace, ...contexts.current.keys()])],
    [],
  );

  const setUserKeymapText = useCallback((text: string): string | null => {
    const { keymap, error } = parseUserKeymap(text);
    if (error) return error;
    // Reject typo'd action names — otherwise the binding would silently do nothing.
    const actionError = validateKeymapActions(keymap, KNOWN_ACTIONS);
    if (actionError) return actionError;
    saveUserKeymapText(text);
    setUserText(text);
    return null;
  }, []);

  const resetUserKeymap = useCallback(() => {
    saveUserKeymapText("");
    setUserText("");
  }, []);

  useEffect(() => {
    const clearPending = () => {
      pending.current = [];
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const stroke = eventToKeystroke(e);
      if (!stroke.key) return; // a bare modifier press — wait for the real key

      pending.current = [...pending.current, stroke];

      const active = new Set<string>(contexts.current.keys());
      active.add(CONTEXTS.workspace); // always active

      const res = resolve(compiledRef.current, active, pending.current);

      if (res.kind === "pending") {
        e.preventDefault();
        if (pendingTimer.current) clearTimeout(pendingTimer.current);
        pendingTimer.current = setTimeout(clearPending, CHORD_TIMEOUT_MS);
        return;
      }

      clearPending();

      if (res.kind === "action") {
        const stack = handlers.current.get(res.action);
        const top = stack && stack[stack.length - 1];
        if (top) {
          e.preventDefault();
          top.current(res.arg);
        }
        // No registered handler → let the key fall through (don't preventDefault).
      }
      // res.kind === "none" → not ours; do nothing.
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearPending();
    };
  }, []);

  const api = useMemo<KeymapApi>(
    () => ({
      registerAction,
      pushContext,
      getActiveContexts,
      mergedKeymap,
      defaultKeymap: DEFAULT_KEYMAP,
      userKeymapText,
      setUserKeymapText,
      resetUserKeymap,
      isMac,
    }),
    [registerAction, pushContext, getActiveContexts, mergedKeymap, userKeymapText, setUserKeymapText, resetUserKeymap, isMac],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

function useKeymapCtx(): KeymapApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useKeymap* must be used within <KeymapProvider>");
  return ctx;
}

/**
 * Register a handler for a keymap action while this component is mounted (focused view wins).
 * Pass `enabled = false` to skip registration — used so only the *active* tab's view registers
 * its actions when every open tab is kept mounted (background tabs must not claim the binding).
 */
export function useKeymapAction(action: string, handler: ActionHandler, enabled = true): void {
  const api = useKeymapCtx();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!enabled) return;
    return api.registerAction(action, ref);
  }, [api, action, enabled]);
}

/** Mark a keymap context active while `active` is true (e.g. "Grid" while the task table shows). */
export function useKeymapContext(name: string, active: boolean): void {
  const api = useKeymapCtx();
  useEffect(() => {
    if (!active) return;
    return api.pushContext(name);
  }, [api, name, active]);
}

/** Access the keymap for the viewer/editor UI (merged bindings, user overrides, platform). */
export function useKeymapApi(): KeymapApi {
  return useKeymapCtx();
}
