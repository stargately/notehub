import { useEffect, useRef } from "react";
import { isTauri, updateFileMenu } from "../lib/tauri-api";

export interface NativeMenuHandlers {
  onNewFile: () => void;
  onNewFolder: () => void;
  onOpenFile: () => void;
  onOpenFolder: () => void;
  onQuickOpen: () => void;
  onSave: () => void;
  onRefresh: () => void;
  onClose: () => void;
  onOpenKeymap: () => void;
}

/** Focus-dependent enabled state pushed to the (shared) native File menu. */
export interface NativeMenuState {
  hasWorkspace: boolean;
  canSave: boolean;
}

/**
 * Bridges the native (Rust-built) File menu to the React app. The menu is app-global; Rust emits a
 * `menu:*` event only to the focused window, so each window's listener fires only when it's
 * frontmost. We also keep the menu's enabled state in sync with the focused window: push on focus
 * gain and whenever this window's `hasWorkspace`/`canSave` change while focused. Tauri-gated; a
 * no-op in the browser. Mirrors the `open-files` / `open-folder` listener pattern.
 */
export function useNativeMenu(handlers: NativeMenuHandlers, state: NativeMenuState) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const stateRef = useRef(state);
  stateRef.current = state;
  // Start unfocused: effect B resolves the real focus and does the mount push, so effect C (which
  // runs synchronously on mount, before B's async focus check) won't push from a background window.
  const focusedRef = useRef(false);

  // Effect A: route menu:* events to the matching handler.
  useEffect(() => {
    if (!isTauri) return;
    let unlisteners: Array<() => void> = [];
    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const wire = async (event: string, run: (h: NativeMenuHandlers) => void) =>
        unlisteners.push(await listen(event, () => run(handlersRef.current)));
      await wire("menu:new-file", (h) => h.onNewFile());
      await wire("menu:new-folder", (h) => h.onNewFolder());
      await wire("menu:open-file", (h) => h.onOpenFile());
      await wire("menu:open-folder", (h) => h.onOpenFolder());
      await wire("menu:quick-open", (h) => h.onQuickOpen());
      await wire("menu:save", (h) => h.onSave());
      await wire("menu:refresh-tree", (h) => h.onRefresh());
      await wire("menu:close", (h) => h.onClose());
      await wire("menu:open-keymap", (h) => h.onOpenKeymap());
    })();
    return () => {
      for (const u of unlisteners) u();
      unlisteners = [];
    };
  }, []);

  // Effect B: track focus; push this window's menu state whenever it's/becomes frontmost.
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      focusedRef.current = await win.isFocused().catch(() => true);
      if (focusedRef.current) {
        void updateFileMenu(stateRef.current.hasWorkspace, stateRef.current.canSave);
      }
      unlisten = await win.onFocusChanged(({ payload: focused }) => {
        focusedRef.current = focused;
        if (focused) {
          void updateFileMenu(stateRef.current.hasWorkspace, stateRef.current.canSave);
        }
      });
    })();
    return () => unlisten?.();
  }, []);

  // Effect C: push on state change while focused (another window owns the menu otherwise).
  useEffect(() => {
    if (!isTauri || !focusedRef.current) return;
    void updateFileMenu(state.hasWorkspace, state.canSave);
  }, [state.hasWorkspace, state.canSave]);
}
