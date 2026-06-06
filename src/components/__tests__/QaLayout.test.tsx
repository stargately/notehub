import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KeymapProvider } from "../../lib/keymap/provider";

// The header bar is what we're testing — stub the heavy Milkdown editor and the CSS Custom
// Highlight API find module (neither exists in jsdom) so the real QaLayout chrome renders.
vi.mock("../MarkdownWysiwyg", () => ({
  MarkdownWysiwyg: ({ value }: { value: string }) => <div data-testid="wysiwyg">{value}</div>,
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

type Props = Parameters<typeof QaLayout>[0];

function renderQa(overrides: Partial<Props> = {}) {
  const onToggleEditor = vi.fn();
  render(
    <KeymapProvider>
      <QaLayout
        content={"plain body text"}
        onChange={() => {}}
        onToggleEditor={onToggleEditor}
        darkMode={false}
        fileName="my-notes"
        variant="plain"
        {...overrides}
      />
    </KeymapProvider>,
  );
  return { onToggleEditor };
}

describe("QaLayout header (thin Zed-style title bar)", () => {
  it("titles the document by its file name, not the project: frontmatter default", () => {
    renderQa({ fileName: "my-notes" });
    expect(screen.getByText("my-notes")).toBeTruthy();
    // The bug: every plain/Q&A file used to show the parser's "Untitled Project" default here.
    expect(screen.queryByText("Untitled Project")).toBeNull();
  });

  it("falls back to 'Untitled' for an unsaved buffer (no file name)", () => {
    renderQa({ fileName: undefined });
    expect(screen.getByText("Untitled")).toBeTruthy();
  });

  it("shows the variant type badge (Q&A vs Markdown)", () => {
    renderQa({ variant: "qa", fileName: "answers" });
    expect(screen.getByText("Q&A")).toBeTruthy();
  });

  it("renders compact icon actions; the Code button toggles the raw editor", () => {
    const { onToggleEditor } = renderQa({ fileName: "my-notes" });
    expect(screen.getByTitle(/Print cheatsheet/i)).toBeTruthy();
    fireEvent.click(screen.getByTitle(/Edit raw markdown/i));
    expect(onToggleEditor).toHaveBeenCalledTimes(1);
  });
});
