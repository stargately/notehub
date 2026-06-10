import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutlinePanel } from "../OutlinePanel";
import type { OutlineHeading } from "../../lib/outline";

const h = (level: number, text: string, line: number): OutlineHeading => ({
  level,
  text,
  raw: text,
  line,
});

describe("OutlinePanel", () => {
  it("lists headings indented relative to the shallowest level", () => {
    render(
      <OutlinePanel
        headings={[h(2, "Top", 0), h(3, "Child", 2), h(2, "Sibling", 4)]}
        onJump={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const top = screen.getByRole("button", { name: "Top" });
    const child = screen.getByRole("button", { name: "Child" });
    // Shallowest (h2) sits at the base indent; the h3 child is one step deeper.
    expect(top.style.paddingLeft).toBe("12px");
    expect(child.style.paddingLeft).toBe("24px");
    expect(screen.getByRole("button", { name: "Sibling" })).toBeTruthy();
  });

  it("clicking a heading jumps to its outline index", () => {
    const onJump = vi.fn();
    render(
      <OutlinePanel
        headings={[h(1, "Intro", 0), h(2, "Setup", 3)]}
        onJump={onJump}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Setup" }));
    expect(onJump).toHaveBeenCalledWith(1);
  });

  it("shows an empty state and a working close button", () => {
    const onClose = vi.fn();
    render(<OutlinePanel headings={[]} onJump={vi.fn()} onClose={onClose} />);
    expect(screen.getByText("No headings")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Close outline"));
    expect(onClose).toHaveBeenCalled();
  });
});
