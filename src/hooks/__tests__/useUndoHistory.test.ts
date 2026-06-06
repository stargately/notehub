import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUndoHistory } from "../useUndoHistory";

describe("useUndoHistory", () => {
  it("returns a stable object identity across re-renders (so consumers' React.memo holds)", () => {
    // App passes the whole `undoHistory` object to every DocumentView; if its identity changed
    // each render it would defeat React.memo(DocumentView) and re-render every editor.
    const { result, rerender } = renderHook(() => useUndoHistory());
    const first = result.current;
    rerender();
    rerender();
    expect(result.current).toBe(first);
  });

  it("records snapshots and walks undo/redo per tab", () => {
    const { result } = renderHook(() => useUndoHistory());
    const h = result.current;
    h.initTab("t1", "v0");
    h.pushSnapshot("t1", "v1");
    h.pushSnapshot("t1", "v2");

    expect(h.undo("t1")).toBe("v1");
    expect(h.undo("t1")).toBe("v0");
    expect(h.undo("t1")).toBeNull(); // stack exhausted
    expect(h.redo("t1")).toBe("v1");
  });

  it("keeps per-tab stacks isolated and drops them on cleanup", () => {
    const { result } = renderHook(() => useUndoHistory());
    const h = result.current;
    h.initTab("a", "a0");
    h.initTab("b", "b0");
    h.pushSnapshot("a", "a1");

    expect(h.undo("b")).toBeNull(); // b never changed
    expect(h.undo("a")).toBe("a0");

    h.cleanupTab("a");
    expect(h.hasTab("a")).toBe(false);
    expect(h.hasTab("b")).toBe(true);
  });
});
