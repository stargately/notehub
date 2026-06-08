import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const updateFileMenuMock = vi.fn(async (_a: boolean, _b: boolean) => {});
vi.mock("../../lib/tauri-api", () => ({
  isTauri: true,
  updateFileMenu: (a: boolean, b: boolean) => updateFileMenuMock(a, b),
}));

// Mock the Tauri event system: capture each listener by event name; tests fire them by hand.
const listeners = new Map<string, (e: unknown) => void>();
const listenMock = vi.fn(async (event: string, cb: (e: unknown) => void) => {
  listeners.set(event, cb);
  return () => listeners.delete(event);
});
vi.mock("@tauri-apps/api/event", () => ({
  listen: (e: string, cb: (ev: unknown) => void) => listenMock(e, cb),
}));

// Mock the window: controllable focus state + captured onFocusChanged callback.
let focused = true;
let focusCb: ((e: { payload: boolean }) => void) | null = null;
const isFocusedMock = vi.fn(async () => focused);
const onFocusChangedMock = vi.fn(async (cb: (e: { payload: boolean }) => void) => {
  focusCb = cb;
  return () => {
    focusCb = null;
  };
});
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ isFocused: isFocusedMock, onFocusChanged: onFocusChangedMock }),
}));

import { useNativeMenu, type NativeMenuHandlers } from "../useNativeMenu";

// Each handler is a vi.fn() (assignable to `() => void`); the inferred record keeps `.mock` typing
// for assertions while still satisfying NativeMenuHandlers when passed to the hook.
const makeHandlers = () => ({
  onNewFile: vi.fn(),
  onNewFolder: vi.fn(),
  onOpenFile: vi.fn(),
  onOpenFolder: vi.fn(),
  onQuickOpen: vi.fn(),
  onSave: vi.fn(),
  onRefresh: vi.fn(),
  onClose: vi.fn(),
  onOpenKeymap: vi.fn(),
});

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  listeners.clear();
  focused = true;
  focusCb = null;
  updateFileMenuMock.mockClear();
  listenMock.mockClear();
  isFocusedMock.mockClear();
  onFocusChangedMock.mockClear();
});

const EVENT_TO_HANDLER: Array<[string, keyof NativeMenuHandlers]> = [
  ["menu:new-file", "onNewFile"],
  ["menu:new-folder", "onNewFolder"],
  ["menu:open-file", "onOpenFile"],
  ["menu:open-folder", "onOpenFolder"],
  ["menu:quick-open", "onQuickOpen"],
  ["menu:save", "onSave"],
  ["menu:refresh-tree", "onRefresh"],
  ["menu:close", "onClose"],
  ["menu:open-keymap", "onOpenKeymap"],
];

describe("useNativeMenu — event routing", () => {
  it("routes every menu:* event to its matching handler", async () => {
    const handlers = makeHandlers();
    renderHook(() => useNativeMenu(handlers, { hasWorkspace: true, canSave: true }));
    await waitFor(() => expect(listeners.size).toBe(EVENT_TO_HANDLER.length));

    for (const [event, handler] of EVENT_TO_HANDLER) {
      act(() => listeners.get(event)!({}));
      expect(handlers[handler]).toHaveBeenCalledTimes(1);
    }
  });

  it("invokes the latest handler after a re-render (ref-based, listeners registered once)", async () => {
    const first = makeHandlers();
    const { rerender } = renderHook(({ h }) => useNativeMenu(h, { hasWorkspace: true, canSave: true }), {
      initialProps: { h: first },
    });
    await waitFor(() => expect(listeners.has("menu:save")).toBe(true));

    const second = makeHandlers();
    rerender({ h: second });
    act(() => listeners.get("menu:save")!({}));

    expect(first.onSave).not.toHaveBeenCalled();
    expect(second.onSave).toHaveBeenCalledTimes(1);
    expect(listenMock).toHaveBeenCalledTimes(EVENT_TO_HANDLER.length); // not re-subscribed
  });
});

describe("useNativeMenu — enabled-state sync", () => {
  it("pushes the menu state on mount when the window is focused", async () => {
    focused = true;
    renderHook(() => useNativeMenu(makeHandlers(), { hasWorkspace: true, canSave: false }));
    await waitFor(() => expect(updateFileMenuMock).toHaveBeenCalledWith(true, false));
  });

  it("does NOT push on mount when unfocused, but pushes when focus is gained", async () => {
    focused = false;
    renderHook(() => useNativeMenu(makeHandlers(), { hasWorkspace: false, canSave: true }));
    await flush();
    expect(updateFileMenuMock).not.toHaveBeenCalled();

    await waitFor(() => expect(onFocusChangedMock).toHaveBeenCalled());
    act(() => focusCb!({ payload: true }));
    expect(updateFileMenuMock).toHaveBeenCalledWith(false, true);
  });

  it("pushes on state change while focused", async () => {
    focused = true;
    const { rerender } = renderHook(({ s }) => useNativeMenu(makeHandlers(), s), {
      initialProps: { s: { hasWorkspace: false, canSave: false } },
    });
    await waitFor(() => expect(updateFileMenuMock).toHaveBeenCalledWith(false, false));
    updateFileMenuMock.mockClear();

    rerender({ s: { hasWorkspace: true, canSave: false } });
    await flush();
    expect(updateFileMenuMock).toHaveBeenCalledWith(true, false);
  });
});
