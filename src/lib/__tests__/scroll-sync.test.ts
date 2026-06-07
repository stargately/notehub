import { describe, it, expect } from "vitest";
import { toFraction, fromFraction } from "../scroll-sync";

describe("scroll-sync", () => {
  it("toFraction reports the scroll position as a 0..1 fraction of the range", () => {
    expect(toFraction(0, 1000, 200)).toBe(0);
    expect(toFraction(800, 1000, 200)).toBe(1); // scrollTop === scrollHeight - clientHeight
    expect(toFraction(400, 1000, 200)).toBe(0.5);
  });

  it("toFraction returns 0 when there's nothing to scroll", () => {
    expect(toFraction(0, 200, 200)).toBe(0);
    expect(toFraction(0, 100, 200)).toBe(0); // content shorter than viewport
  });

  it("toFraction clamps out-of-range scrollTop", () => {
    expect(toFraction(-50, 1000, 200)).toBe(0);
    expect(toFraction(99999, 1000, 200)).toBe(1);
  });

  it("fromFraction maps a fraction back to a scrollTop for a (different) height", () => {
    expect(fromFraction(0.5, 1000, 200)).toBe(400);
    // Same fraction, a taller target (e.g. raw editor) → proportionally further down.
    expect(fromFraction(0.5, 3000, 200)).toBe(1400);
    expect(fromFraction(1, 1000, 200)).toBe(800);
  });

  it("fromFraction returns 0 when the target isn't scrollable", () => {
    expect(fromFraction(0.5, 150, 200)).toBe(0);
  });

  it("round-trips a fraction back to the same scrollTop at equal height", () => {
    const f = toFraction(640, 2000, 500);
    expect(fromFraction(f, 2000, 500)).toBeCloseTo(640, 5);
  });
});
