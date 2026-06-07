import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QaFindBar } from "../QaFindBar";

type Props = Parameters<typeof QaFindBar>[0];

function baseProps(overrides: Partial<Props> = {}): Props {
  return {
    query: "",
    replace: "",
    caseSensitive: false,
    matchCount: 0,
    activeIndex: 0,
    onQueryChange: vi.fn(),
    onReplaceChange: vi.fn(),
    onToggleCase: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
    onReplaceCurrent: vi.fn(),
    onReplaceAll: vi.fn(),
    onClose: vi.fn(),
    focusSignal: 0,
    ...overrides,
  };
}

describe("QaFindBar focus", () => {
  it("focuses the find input on mount", () => {
    render(<QaFindBar {...baseProps()} />);
    expect(document.activeElement).toBe(screen.getByPlaceholderText("Find"));
  });

  it("re-focuses (and selects) the find input when focusSignal changes — a repeated Cmd+F", () => {
    const props = baseProps({ focusSignal: 0, query: "hello" });
    const { rerender } = render(<QaFindBar {...props} />);
    const input = screen.getByPlaceholderText("Find") as HTMLInputElement;

    // User moved focus away (e.g. clicked back into the document).
    act(() => input.blur());
    expect(document.activeElement).not.toBe(input);

    // Second Cmd+F bumps the signal → the bar grabs focus back.
    rerender(<QaFindBar {...props} focusSignal={1} />);
    expect(document.activeElement).toBe(input);
  });

  it("does not re-focus on unrelated re-renders (focusSignal unchanged)", () => {
    const props = baseProps({ focusSignal: 3 });
    const { rerender } = render(<QaFindBar {...props} />);
    const input = screen.getByPlaceholderText("Find") as HTMLInputElement;
    act(() => input.blur());

    // A re-render that doesn't change focusSignal (e.g. match count updated) must not steal focus.
    rerender(<QaFindBar {...baseProps({ focusSignal: 3, matchCount: 2 })} />);
    expect(document.activeElement).not.toBe(input);
  });
});
