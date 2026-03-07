import { useRef, useCallback } from "react";

const MAX_STACK_SIZE = 50;

interface TabUndoState {
  undoStack: string[];
  redoStack: string[];
  current: string;
}

export function useUndoHistory() {
  const stateRef = useRef<Record<string, TabUndoState>>({});
  const suppressRef = useRef(false);

  const initTab = useCallback((tabId: string, snapshot: string) => {
    stateRef.current[tabId] = {
      undoStack: [],
      redoStack: [],
      current: snapshot,
    };
  }, []);

  const pushSnapshot = useCallback((tabId: string, snapshot: string) => {
    if (suppressRef.current) {
      suppressRef.current = false;
      const state = stateRef.current[tabId];
      if (state) state.current = snapshot;
      return;
    }
    const state = stateRef.current[tabId];
    if (!state) return;
    if (snapshot === state.current) return;
    state.undoStack.push(state.current);
    if (state.undoStack.length > MAX_STACK_SIZE) {
      state.undoStack.shift();
    }
    state.redoStack = [];
    state.current = snapshot;
  }, []);

  const undo = useCallback((tabId: string): string | null => {
    const state = stateRef.current[tabId];
    if (!state || state.undoStack.length === 0) return null;
    state.redoStack.push(state.current);
    state.current = state.undoStack.pop()!;
    return state.current;
  }, []);

  const redo = useCallback((tabId: string): string | null => {
    const state = stateRef.current[tabId];
    if (!state || state.redoStack.length === 0) return null;
    state.undoStack.push(state.current);
    state.current = state.redoStack.pop()!;
    return state.current;
  }, []);

  const suppressNextPush = useCallback(() => {
    suppressRef.current = true;
  }, []);

  const hasTab = useCallback((tabId: string) => {
    return tabId in stateRef.current;
  }, []);

  const cleanupTab = useCallback((tabId: string) => {
    delete stateRef.current[tabId];
  }, []);

  return { initTab, hasTab, pushSnapshot, undo, redo, suppressNextPush, cleanupTab };
}

export type UndoHistory = ReturnType<typeof useUndoHistory>;
