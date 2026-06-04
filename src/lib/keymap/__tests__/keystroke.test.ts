import { describe, it, expect } from "vitest";
import {
  parseKeystroke,
  parseSequence,
  eventToKeystroke,
  keystrokeMatches,
  normalizeKey,
  formatSequence,
} from "../keystroke";

const ev = (key: string, mods: Partial<{ meta: boolean; ctrl: boolean; alt: boolean; shift: boolean }> = {}) =>
  eventToKeystroke({
    key,
    metaKey: !!mods.meta,
    ctrlKey: !!mods.ctrl,
    altKey: !!mods.alt,
    shiftKey: !!mods.shift,
  });

describe("parseKeystroke", () => {
  it("parses modifiers and key", () => {
    expect(parseKeystroke("cmd-shift-p")).toMatchObject({ meta: true, shift: true, key: "p", mod: false });
    expect(parseKeystroke("ctrl-`")).toMatchObject({ ctrl: true, key: "`" });
    expect(parseKeystroke("alt-left")).toMatchObject({ alt: true, key: "left" });
    expect(parseKeystroke("opt-x")).toMatchObject({ alt: true, key: "x" });
  });
  it("treats `mod` as the platform accelerator (not meta/ctrl directly)", () => {
    const k = parseKeystroke("mod-s");
    expect(k).toMatchObject({ mod: true, meta: false, ctrl: false, key: "s" });
  });
});

describe("normalizeKey", () => {
  it("maps arrows/space/esc and lowercases", () => {
    expect(normalizeKey("ArrowUp")).toBe("up");
    expect(normalizeKey(" ")).toBe("space");
    expect(normalizeKey("Escape")).toBe("escape");
    expect(normalizeKey("Z")).toBe("z");
  });
});

describe("eventToKeystroke", () => {
  it("ignores modifier-only presses", () => {
    expect(ev("Meta", { meta: true }).key).toBe("");
    expect(ev("Shift", { shift: true }).key).toBe("");
  });
});

describe("keystrokeMatches", () => {
  it("mod matches Meta OR Ctrl", () => {
    const b = parseKeystroke("mod-s");
    expect(keystrokeMatches(b, ev("s", { meta: true }))).toBe(true);
    expect(keystrokeMatches(b, ev("s", { ctrl: true }))).toBe(true);
    expect(keystrokeMatches(b, ev("s"))).toBe(false);
  });
  it("respects shift exactly (Cmd+P vs Cmd+Shift+P)", () => {
    const b = parseKeystroke("mod-p");
    expect(keystrokeMatches(b, ev("p", { meta: true }))).toBe(true);
    expect(keystrokeMatches(b, ev("P", { meta: true, shift: true }))).toBe(false);
  });
  it("does not match when an un-bound modifier (alt) is held", () => {
    const b = parseKeystroke("mod-s");
    expect(keystrokeMatches(b, ev("s", { meta: true, alt: true }))).toBe(false);
  });
  it("explicit ctrl requires Ctrl, not Meta", () => {
    const b = parseKeystroke("ctrl-x");
    expect(keystrokeMatches(b, ev("x", { ctrl: true }))).toBe(true);
    expect(keystrokeMatches(b, ev("x", { meta: true }))).toBe(false);
  });
});

describe("parseSequence", () => {
  it("splits a chord into keystrokes", () => {
    const seq = parseSequence("mod-k mod-s");
    expect(seq).toHaveLength(2);
    expect(seq[0]).toMatchObject({ mod: true, key: "k" });
    expect(seq[1]).toMatchObject({ mod: true, key: "s" });
  });
});

describe("formatSequence", () => {
  it("renders mac symbols vs +-joined on other platforms", () => {
    expect(formatSequence("mod-shift-p", true)).toBe("⌘⇧P");
    expect(formatSequence("mod-shift-p", false)).toBe("Ctrl+Shift+P");
    expect(formatSequence("mod-k mod-s", true)).toBe("⌘K ⌘S");
  });
});
