import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { TabBar } from "../TabBar";
import type { TabInfo } from "../../lib/types";

type Props = Parameters<typeof TabBar>[0];

function tab(id: string, label: string, filePath: string | null = `/ws/${label}`): TabInfo {
  return { id, label, filePath, kind: "markdown" } as TabInfo;
}

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    tabs: [tab("t1", "a.md"), tab("t2", "b.md")],
    activeTabId: "t1",
    onSelectTab: vi.fn(),
    onCloseTab: vi.fn(),
    onAddTab: vi.fn(),
    onDetachTab: vi.fn(),
    ...overrides,
  };
  render(<TabBar {...props} />);
  return props;
}

describe("TabBar", () => {
  it("renders a close button on every tab", () => {
    setup({ tabs: [tab("t1", "a.md"), tab("t2", "b.md"), tab("t3", "c.md")] });
    expect(screen.getAllByRole("button", { name: /^Close / })).toHaveLength(3);
  });

  it("renders a close button on the LAST remaining tab (closing all tabs is allowed)", () => {
    // The regression: the close ✕ used to be hidden when only one tab was left
    // (`tabs.length > 1`), so the final tab was unclosable with the mouse even though
    // the app now falls back to an empty pane. Every tab must stay closable.
    const onCloseTab = vi.fn();
    setup({ tabs: [tab("only", "solo.md")], activeTabId: "only", onCloseTab });

    const closeBtn = screen.getByRole("button", { name: "Close solo.md" });
    fireEvent.click(closeBtn);
    expect(onCloseTab).toHaveBeenCalledWith("only");
  });

  it("close click doesn't also select the tab (stops propagation)", () => {
    const onSelectTab = vi.fn();
    const onCloseTab = vi.fn();
    setup({ onSelectTab, onCloseTab });

    fireEvent.click(screen.getByRole("button", { name: "Close b.md" }));
    expect(onCloseTab).toHaveBeenCalledWith("t2");
    expect(onSelectTab).not.toHaveBeenCalled();
  });
});
