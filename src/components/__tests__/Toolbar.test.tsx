import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KeymapProvider } from "../../lib/keymap/provider";
import { Toolbar } from "../Toolbar";

type Props = Parameters<typeof Toolbar>[0];

function renderToolbar(overrides: Partial<Props> = {}) {
  render(
    <KeymapProvider>
      <Toolbar
        fileName="my-notes"
        filterText=""
        hideDone={false}
        showNotes={false}
        weekFilter={null}
        onFilterChange={() => {}}
        onToggleHideDone={() => {}}
        onAddTask={() => {}}
        onToggleNotes={() => {}}
        onWeekFilterChange={() => {}}
        {...overrides}
      />
    </KeymapProvider>,
  );
}

describe("Toolbar (task grid header)", () => {
  it("titles the document by its file name, not the project: frontmatter default", () => {
    renderToolbar({ fileName: "my-notes" });
    expect(screen.getByText("my-notes")).toBeTruthy();
    // The old behavior surfaced the parser's "Untitled Project" default here — must not anymore.
    expect(screen.queryByText("Untitled Project")).toBeNull();
  });

  it("falls back to 'Untitled' for an unsaved buffer (no file name)", () => {
    renderToolbar({ fileName: undefined });
    expect(screen.getByText("Untitled")).toBeTruthy();
  });
});
