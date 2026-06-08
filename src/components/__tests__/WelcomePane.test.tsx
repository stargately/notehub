import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WelcomePane } from "../WelcomePane";

type Props = Parameters<typeof WelcomePane>[0];

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    hasWorkspace: true,
    onNewFile: vi.fn(),
    onOpenFile: vi.fn(),
    onQuickOpen: vi.fn(),
    onOpenFolder: vi.fn(),
    ...overrides,
  };
  render(<WelcomePane {...props} />);
  return props;
}

describe("WelcomePane (Zed-style empty pane)", () => {
  it("with a workspace, lists New File / Open File / Quick Open / Open Another Folder", () => {
    setup({ hasWorkspace: true });
    expect(screen.getByRole("button", { name: /New File/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open File/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Quick Open/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Open Another Folder/ })).toBeTruthy();
  });

  it("without a workspace, hides the workspace-only actions (New File / Quick Open)", () => {
    setup({ hasWorkspace: false });
    expect(screen.queryByRole("button", { name: /New File/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Quick Open/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Open File/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Open Folder/ })).toBeTruthy();
  });

  it("each row invokes its handler on click", () => {
    const props = setup({ hasWorkspace: true });
    fireEvent.click(screen.getByRole("button", { name: /New File/ }));
    fireEvent.click(screen.getByRole("button", { name: /Open File/ }));
    fireEvent.click(screen.getByRole("button", { name: /Quick Open/ }));
    fireEvent.click(screen.getByRole("button", { name: /Open Another Folder/ }));
    expect(props.onNewFile).toHaveBeenCalledTimes(1);
    expect(props.onOpenFile).toHaveBeenCalledTimes(1);
    expect(props.onQuickOpen).toHaveBeenCalledTimes(1);
    expect(props.onOpenFolder).toHaveBeenCalledTimes(1);
  });

  it("renders a shortcut chip for keymap-bound actions (Open File / Quick Open)", () => {
    setup({ hasWorkspace: true });
    // formatSequence renders ⌘O (mac) or Ctrl+O — assert the key letter shows in a <kbd>.
    const chips = document.querySelectorAll("kbd.nh-kbd");
    expect(chips.length).toBe(2);
    const text = Array.from(chips).map((c) => c.textContent ?? "").join(" ");
    expect(text).toMatch(/O/);
    expect(text).toMatch(/P/);
  });
});
