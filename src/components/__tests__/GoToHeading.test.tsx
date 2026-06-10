import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoToHeading } from "../GoToHeading";
import type { OutlineHeading } from "../../lib/outline";

const h = (level: number, text: string, line: number): OutlineHeading => ({
  level,
  text,
  raw: text,
  line,
});

const HEADINGS = [h(1, "Introduction", 0), h(2, "Getting Started", 4), h(2, "Architecture", 9)];

function setup(overrides: Partial<Parameters<typeof GoToHeading>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    headings: HEADINGS,
    onJump: vi.fn(),
    ...overrides,
  };
  render(<GoToHeading {...props} />);
  return props;
}

describe("GoToHeading", () => {
  it("renders nothing when closed", () => {
    setup({ open: false });
    expect(screen.queryByPlaceholderText("Go to heading…")).toBeNull();
  });

  it("lists the full outline (with level badges) on an empty query", () => {
    setup();
    expect(screen.getByText("Introduction")).toBeTruthy();
    expect(screen.getByText("Getting Started")).toBeTruthy();
    expect(screen.getByText("H1")).toBeTruthy();
    expect(screen.getAllByText("H2")).toHaveLength(2);
  });

  it("fuzzy-filters headings and jumps to the original outline index on Enter", () => {
    const { onJump, onClose } = setup();
    const input = screen.getByPlaceholderText("Go to heading…");
    fireEvent.change(input, { target: { value: "arch" } });
    expect(screen.queryByText("Introduction")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onClose).toHaveBeenCalled();
    expect(onJump).toHaveBeenCalledWith(2); // "Architecture" is headings[2]
  });

  it("arrow keys move the selection before Enter", () => {
    const { onJump } = setup();
    const input = screen.getByPlaceholderText("Go to heading…");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onJump).toHaveBeenCalledWith(1);
  });

  it("clicking a row jumps to it", () => {
    const { onJump } = setup();
    fireEvent.click(screen.getByText("Getting Started"));
    expect(onJump).toHaveBeenCalledWith(1);
  });

  it("Escape closes without jumping", () => {
    const { onJump, onClose } = setup();
    fireEvent.keyDown(screen.getByPlaceholderText("Go to heading…"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    expect(onJump).not.toHaveBeenCalled();
  });

  it("shows an empty state for a doc without headings", () => {
    setup({ headings: [] });
    expect(screen.getByText("No headings in this document")).toBeTruthy();
  });
});
