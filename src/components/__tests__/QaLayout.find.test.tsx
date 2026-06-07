import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { KeymapProvider, useKeymapContext } from "../../lib/keymap/provider";
import { CONTEXTS } from "../../lib/keymap/actions";

vi.mock("../MarkdownWysiwyg", () => ({
  MarkdownWysiwyg: ({ value }: { value: string }) => <div>{value}</div>,
}));
vi.mock("../../lib/qa-find", () => ({
  collectMatches: () => [],
  paintHighlights: () => {},
  clearHighlights: () => {},
  scrollToMatch: () => {},
  replaceNthOccurrence: (s: string) => s,
  replaceAllOccurrences: (s: string) => s,
}));

import { QaLayout } from "../QaLayout";

// `mod-f` → editor::Find is bound in the QA context, contributed here so the keymap can dispatch it.
function QaContext() {
  useKeymapContext(CONTEXTS.qa, true);
  return null;
}

const pressCmdF = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", metaKey: true, bubbles: true }));
  });

describe("QaLayout — Cmd+F focus", () => {
  it("focuses the find input, and re-focuses it on a second Cmd+F while already open", () => {
    render(
      <KeymapProvider>
        <QaContext />
        <QaLayout content={"hello world"} onChange={() => {}} onToggleEditor={() => {}} darkMode={false} fileName="doc" variant="qa" active />
      </KeymapProvider>,
    );

    // First Cmd+F opens the find bar and focuses its input.
    pressCmdF();
    const input = screen.getByPlaceholderText("Find") as HTMLInputElement;
    expect(document.activeElement).toBe(input);

    // Focus moves away (the user clicked back into the document).
    act(() => input.blur());
    expect(document.activeElement).not.toBe(input);

    // Second Cmd+F (bar already open) must return focus to the input — the reported bug.
    pressCmdF();
    expect(document.activeElement).toBe(input);
  });
});
