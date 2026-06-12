import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CommandPalette } from "../CommandPalette";
import { KeymapProvider, useKeymapAction, useKeymapContext } from "../../lib/keymap/provider";
import { ACTIONS, CONTEXTS } from "../../lib/keymap/actions";

interface HostProps {
  onSave: () => void;
  onFind: () => void;
  qaActive?: boolean;
  open: boolean;
  onClose: () => void;
}

/** Registers a couple of real actions (like an active DocumentView would) around the palette. */
function Host({ onSave, onFind, qaActive = false, open, onClose }: HostProps) {
  useKeymapAction(ACTIONS.save, onSave);
  useKeymapAction(ACTIONS.find, onFind);
  useKeymapContext(CONTEXTS.qa, qaActive);
  return <CommandPalette open={open} onClose={onClose} />;
}

function setup(overrides: Partial<HostProps> = {}) {
  const props: HostProps = {
    onSave: vi.fn(),
    onFind: vi.fn(),
    open: true,
    onClose: vi.fn(),
    ...overrides,
  };
  // Mount closed first (as App does), so the actions register before the palette snapshots them
  // on open — the palette never starts life open in the real app.
  const view = render(
    <KeymapProvider>
      <Host {...props} open={false} />
    </KeymapProvider>,
  );
  if (props.open) {
    view.rerender(
      <KeymapProvider>
        <Host {...props} />
      </KeymapProvider>,
    );
  }
  return { ...props, view };
}

const input = () => screen.getByPlaceholderText("Run a command…");

describe("CommandPalette", () => {
  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByPlaceholderText("Run a command…")).toBeNull();
  });

  it("lists the registered commands with title + action id, alphabetically", () => {
    setup();
    const rows = screen.getAllByRole("button");
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining("Find & Replace…"),
      expect.stringContaining("Save File"),
    ]);
    expect(screen.getByText(ACTIONS.save)).toBeTruthy();
  });

  it("shows a binding only when its context is active (Find is QA-bound)", () => {
    const { view } = setup();
    // QA inactive: Save has its Workspace mod-s binding; Find shows no key.
    const findRow = screen.getByText("Find & Replace…").closest("button")!;
    const saveRow = screen.getByText("Save File").closest("button")!;
    expect(saveRow.querySelector("kbd")).toBeTruthy();
    expect(findRow.querySelector("kbd")).toBeNull();
    view.unmount();

    setup({ qaActive: true });
    const findRow2 = screen.getByText("Find & Replace…").closest("button")!;
    expect(findRow2.querySelector("kbd")).toBeTruthy();
  });

  it("fuzzy-filters by title", () => {
    setup();
    fireEvent.change(input(), { target: { value: "save" } });
    expect(screen.getByText(/Save/)).toBeTruthy();
    expect(screen.queryByText("Find & Replace…")).toBeNull();
  });

  it("Enter runs the selected command through the keymap registry and closes", () => {
    const { onSave, onFind, onClose } = setup();
    fireEvent.change(input(), { target: { value: "save" } });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onFind).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("arrow keys move the selection before Enter", () => {
    const { onSave, onFind } = setup();
    fireEvent.keyDown(input(), { key: "ArrowDown" }); // Find… → Save File
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onFind).not.toHaveBeenCalled();
  });

  it("clicking a row runs it", () => {
    const { onFind, onClose } = setup();
    fireEvent.click(screen.getByText("Find & Replace…"));
    expect(onFind).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape closes without running anything", () => {
    const { onSave, onFind, onClose } = setup();
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    expect(onFind).not.toHaveBeenCalled();
  });

});

/** Stateful integration: the default keymap's Cmd+Shift+P opens the palette; run restores focus. */
function StatefulApp({ onSave }: { onSave: () => void }) {
  const [open, setOpen] = useState(false);
  useKeymapAction(ACTIONS.openCommandPalette, () => setOpen(true));
  useKeymapAction(ACTIONS.save, onSave);
  return (
    <>
      <input data-testid="editor" />
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </>
  );
}

describe("CommandPalette — keymap integration", () => {
  it("opens on Cmd+Shift+P via the default keymap, excludes itself, and restores focus on run", () => {
    const focusedAtRun: Element[] = [];
    render(
      <KeymapProvider>
        <StatefulApp onSave={() => focusedAtRun.push(document.activeElement!)} />
      </KeymapProvider>,
    );

    const editor = screen.getByTestId("editor");
    editor.focus();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "p", metaKey: true, shiftKey: true, bubbles: true }),
      );
    });

    expect(input()).toBeTruthy();
    // The palette never lists itself (no row for the action that reopens it).
    expect(screen.queryByText("app::OpenCommandPalette")).toBeNull();

    fireEvent.change(input(), { target: { value: "save" } });
    fireEvent.keyDown(input(), { key: "Enter" });

    // The handler saw focus restored to the pre-palette element, and the palette closed.
    expect(focusedAtRun).toEqual([editor]);
    expect(screen.queryByPlaceholderText("Run a command…")).toBeNull();
  });
});
