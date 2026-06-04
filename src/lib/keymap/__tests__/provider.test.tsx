import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { KeymapProvider, useKeymapAction } from "../provider";
import { ACTIONS } from "../actions";

// `editor::Reload` is bound to `mod-r` in the always-active Workspace context, so a Cmd+R keydown
// resolves to it without contributing any extra contexts.
function Reloader({ handler, enabled }: { handler: () => void; enabled: boolean }) {
  useKeymapAction(ACTIONS.reload, handler, enabled);
  return null;
}

const pressCmdR = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "r", metaKey: true, bubbles: true }));
  });

describe("useKeymapAction enabled gating (keep-all-tabs-mounted)", () => {
  it("only registers when enabled — a disabled (background-tab) handler never fires or shadows", () => {
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = render(
      <KeymapProvider>
        <Reloader handler={a} enabled={true} />
        <Reloader handler={b} enabled={false} />
      </KeymapProvider>,
    );

    pressCmdR();
    // `b` is declared later (would win the focused/last-wins stack) but is disabled, so the
    // enabled earlier handler `a` runs instead.
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();

    a.mockClear();
    b.mockClear();

    // Flip which one is active (as happens on a tab switch): now only `b` is registered.
    rerender(
      <KeymapProvider>
        <Reloader handler={a} enabled={false} />
        <Reloader handler={b} enabled={true} />
      </KeymapProvider>,
    );
    pressCmdR();
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });

  it("with multiple enabled handlers, the most-recently-registered (focused) wins", () => {
    const a = vi.fn();
    const b = vi.fn();
    render(
      <KeymapProvider>
        <Reloader handler={a} enabled={true} />
        <Reloader handler={b} enabled={true} />
      </KeymapProvider>,
    );
    pressCmdR();
    expect(b).toHaveBeenCalledTimes(1);
    expect(a).not.toHaveBeenCalled();
  });
});
