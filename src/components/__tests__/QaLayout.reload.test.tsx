import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { KeymapProvider } from "../../lib/keymap/provider";

// Count actual editor MOUNTS (useEffect[]), so we can tell a remount apart from a re-render.
const counters = vi.hoisted(() => ({ mounts: 0 }));
vi.mock("../MarkdownWysiwyg", async () => {
  const { useEffect } = await import("react");
  return {
    MarkdownWysiwyg: ({ value }: { value: string }) => {
      useEffect(() => {
        counters.mounts++;
      }, []);
      return <div>{value}</div>;
    },
  };
});
vi.mock("../../lib/qa-find", () => ({
  collectMatches: () => [],
  paintHighlights: () => {},
  clearHighlights: () => {},
  scrollToMatch: () => {},
  replaceNthOccurrence: (s: string) => s,
  replaceAllOccurrences: (s: string) => s,
}));

import { QaLayout } from "../QaLayout";

const props = { onChange: () => {}, onToggleEditor: () => {}, darkMode: false, fileName: "doc", variant: "qa" as const };
const A = ["header", "", "**>>>**", "Q1", "**<<<**", "A1", "", "**>>>**", "Q2", "**<<<**", "A2"].join("\n");
// Same document with only the second answer changed — i.e. an external edit (Claude) to one cell.
const B = ["header", "", "**>>>**", "Q1", "**<<<**", "A1", "", "**>>>**", "Q2", "**<<<**", "A2 EDITED"].join("\n");

describe("QaLayout live-reload — minimal remounts (preserves cursor + scroll)", () => {
  it("remounts only the cells whose content changed on an external reload", () => {
    const { rerender } = render(
      <KeymapProvider>
        <QaLayout content={A} {...props} />
      </KeymapProvider>,
    );
    expect(counters.mounts).toBe(5); // header + 2 blocks × (left + right)

    // An external change arrives (the `content` prop changes); only block-1-right differs.
    rerender(
      <KeymapProvider>
        <QaLayout content={B} {...props} />
      </KeymapProvider>,
    );

    // Exactly one cell remounted — the other four kept their live editor (cursor/scroll survive).
    expect(counters.mounts).toBe(6);
  });
});
