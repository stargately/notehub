import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { KeymapProvider } from "../../lib/keymap/provider";

// Count every Milkdown-cell render. The stub is a controlled textarea so we can drive `onChange`.
const renders = vi.hoisted(() => ({ count: 0 }));
vi.mock("../MarkdownWysiwyg", () => ({
  MarkdownWysiwyg: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    renders.count++;
    return <textarea value={value} onChange={(e) => onChange(e.target.value)} />;
  },
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

// One header + two Q&A blocks → 5 cell editors (header, b0 left/right, b1 left/right).
const CONTENT = ["header", "", "**>>>**", "Q1", "**<<<**", "A1", "", "**>>>**", "Q2", "**<<<**", "A2"].join("\n");

describe("QaLayout performance — memoized cells", () => {
  it("editing one cell re-renders only that cell, not the rest of the document", () => {
    const { container } = render(
      <KeymapProvider>
        <QaLayout content={CONTENT} onChange={() => {}} onToggleEditor={() => {}} darkMode={false} fileName="doc" variant="qa" />
      </KeymapProvider>,
    );

    const afterMount = renders.count;
    expect(afterMount).toBe(5); // all five cells mounted once

    const cell = container.querySelector('[data-qa-field="block-0-left"] textarea') as HTMLTextAreaElement;
    act(() => {
      fireEvent.change(cell, { target: { value: "Q1 edited" } });
    });

    // Only the edited cell's `value` changed; the other four are skipped by QaCell's React.memo.
    expect(renders.count).toBe(afterMount + 1);
  });
});
