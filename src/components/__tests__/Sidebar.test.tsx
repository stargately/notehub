import { describe, it, expect, vi } from "vitest";
import { useRef } from "react";
import { render } from "@testing-library/react";
import { Sidebar } from "../Sidebar";
import type { FileTreeHandle } from "../FileTree";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Render Sidebar with no workspace so the "Open Folder" content path is taken (no FileTree / Tauri).
function Harness({ open }: { open: boolean }) {
  const treeRef = useRef<FileTreeHandle>(null);
  return (
    <Sidebar
      open={open}
      width={240}
      onWidthChange={() => {}}
      workspaceRoot={null}
      activeFilePath={null}
      onOpenFile={() => {}}
      onOpenFolder={() => {}}
      treeRef={treeRef}
    />
  );
}

describe("Sidebar collapse (Cmd+B): no unmount, no flash", () => {
  it("stays mounted when collapsed — content is hidden, not torn out of the row", () => {
    const { getByText, rerender, container } = render(<Harness open />);

    const btn = getByText("Open Folder");
    expect(container.contains(btn)).toBe(true);
    const root = container.firstElementChild as HTMLElement;
    // Open: full width, content wrapper visible.
    expect(root.style.width).not.toBe("0px");
    const contentWhenOpen = btn.closest('[class*="min-h-0"]') as HTMLElement;
    expect(contentWhenOpen.style.display).not.toBe("none");

    // Collapse — the SAME button node must persist (no remount) and the panel shrinks to 0 width
    // with its content display:none, so toggling never tears a flex child out of the row.
    rerender(<Harness open={false} />);
    expect(getByText("Open Folder")).toBe(btn); // identical node ⇒ never unmounted
    expect(root.style.width).toBe("0px");
    expect(contentWhenOpen.style.display).toBe("none");
  });

  it("only renders the resize handle while open (not grabbable at the window edge when collapsed)", () => {
    const { container, rerender } = render(<Harness open />);
    const handle = () => container.querySelector('[style*="col-resize"]');
    expect(handle()).not.toBeNull();
    rerender(<Harness open={false} />);
    expect(handle()).toBeNull();
  });
});
