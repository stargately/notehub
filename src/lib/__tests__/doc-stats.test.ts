import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  stripToPlainText,
  computeDocStats,
  formatDocStats,
  publishDocStats,
  getDocStats,
  subscribeDocStats,
  type DocStats,
} from "../doc-stats";

describe("stripToPlainText", () => {
  it("drops YAML frontmatter", () => {
    expect(stripToPlainText("---\nlayout: qa\n---\nhello world")).toBe("hello world");
  });

  it("drops CRLF frontmatter too", () => {
    expect(stripToPlainText("---\r\nlayout: qa\r\n---\r\nhello world")).toBe("hello world");
  });

  it("strips markdown decoration from prose lines", () => {
    const src = "# Title\n\n> quoted **bold** text\n\n- item one\n- [x] done task\n\n[link](http://x) and ![alt](img.png)";
    expect(stripToPlainText(src)).toBe("Title\n\nquoted bold text\n\nitem one\ndone task\n\nlink and alt");
  });

  it("keeps fenced code content but drops the fence delimiters", () => {
    expect(stripToPlainText("```js\nconst x = 1;\n```\nafter")).toBe("const x = 1;\nafter");
  });

  it("does not strip markdown syntax inside code blocks", () => {
    expect(stripToPlainText("```\n# not a heading\n**raw**\n```")).toBe("# not a heading\n**raw**");
  });

  it("drops QA structural markers and decoration-only lines", () => {
    const src = "intro\n**>>>**\nQuestion?\n**<<<**\nAnswer.\n**===**\nnote\n---\n";
    expect(stripToPlainText(src)).toBe("intro\nQuestion?\nAnswer.\nnote\n");
  });

  it("drops plain and HTML-comment QA markers too", () => {
    const plain = "intro\n>>>\nQuestion?\n<<<\nAnswer.\n===\nnote";
    expect(stripToPlainText(plain)).toBe("intro\nQuestion?\nAnswer.\nnote");
    const comment = "intro\n<!-- Q -->\nQuestion?\n<!-- A -->\nAnswer.\n<!-- E -->\nnote";
    expect(stripToPlainText(comment)).toBe("intro\nQuestion?\nAnswer.\nnote");
  });

  it("drops table separator rows and pipes but keeps cell text", () => {
    expect(stripToPlainText("| Id | Title |\n| --- | --- |\n| 1 | Fix bug |")).toBe(
      "Id Title\n1 Fix bug",
    );
  });
});

describe("computeDocStats", () => {
  it("counts words, characters (line breaks excluded), and reading time", () => {
    const stats = computeDocStats("# Hi\n\none two three");
    expect(stats.words).toBe(4); // Hi one two three
    expect(stats.chars).toBe("Hi".length + "one two three".length);
    expect(stats.readingMinutes).toBe(1);
  });

  it("returns all-zero stats for an empty / frontmatter-only doc", () => {
    expect(computeDocStats("")).toEqual({ words: 0, chars: 0, readingMinutes: 0 });
    expect(computeDocStats("---\nlayout: qa\n---\n")).toEqual({ words: 0, chars: 0, readingMinutes: 0 });
  });

  it("rounds reading time at ~200 wpm with a 1-minute floor", () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");
    expect(computeDocStats(words(10)).readingMinutes).toBe(1); // floor
    expect(computeDocStats(words(700)).readingMinutes).toBe(4); // 3.5 → 4
  });

  it("counts each CJK character as a word (Typora-style)", () => {
    const stats = computeDocStats("你好世界 hello");
    expect(stats.words).toBe(5); // 4 hanzi + "hello"
  });
});

describe("formatDocStats", () => {
  it("formats words/chars/reading time with thousands separators", () => {
    expect(formatDocStats({ words: 1234, chars: 5678, readingMinutes: 6 })).toBe(
      "1,234 words · 5,678 chars · ~6 min read",
    );
  });

  it("singularizes and omits reading time for an empty doc", () => {
    expect(formatDocStats({ words: 1, chars: 1, readingMinutes: 1 })).toBe(
      "1 word · 1 char · ~1 min read",
    );
    expect(formatDocStats({ words: 0, chars: 0, readingMinutes: 0 })).toBe("0 words · 0 chars");
  });
});

describe("doc-stats store", () => {
  beforeEach(() => publishDocStats(null));

  const STATS: DocStats = { words: 3, chars: 11, readingMinutes: 1 };

  it("publishes to subscribers and snapshots via getDocStats", () => {
    const seen = vi.fn();
    const unsub = subscribeDocStats(seen);
    publishDocStats(STATS);
    expect(seen).toHaveBeenCalledTimes(1);
    expect(getDocStats()).toEqual(STATS);
    unsub();
    publishDocStats(null);
    expect(seen).toHaveBeenCalledTimes(1); // unsubscribed
  });

  it("drops equal publishes (stable snapshot identity, no useless notifications)", () => {
    const seen = vi.fn();
    publishDocStats(STATS);
    const snapshot = getDocStats();
    const unsub = subscribeDocStats(seen);
    publishDocStats({ ...STATS }); // equal by value, different object
    expect(seen).not.toHaveBeenCalled();
    expect(getDocStats()).toBe(snapshot); // identity preserved for useSyncExternalStore
    unsub();
  });
});
