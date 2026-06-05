import { describe, it, expect } from "vitest";
import { isReleaseOutsideWindow } from "../tear-off";

// Window spanning x ∈ [100, 1300], y ∈ [50, 850].
const rect = { x: 100, y: 50, width: 1200, height: 800 };

describe("isReleaseOutsideWindow", () => {
  it("is false for a point inside the window", () => {
    expect(isReleaseOutsideWindow(700, 400, rect)).toBe(false);
  });

  it("treats the edges as inside (a release on the border is not a tear-off)", () => {
    expect(isReleaseOutsideWindow(100, 50, rect)).toBe(false); // top-left corner
    expect(isReleaseOutsideWindow(1300, 850, rect)).toBe(false); // bottom-right corner
  });

  it("is true past each side", () => {
    expect(isReleaseOutsideWindow(99, 400, rect)).toBe(true); // left
    expect(isReleaseOutsideWindow(1301, 400, rect)).toBe(true); // right
    expect(isReleaseOutsideWindow(700, 49, rect)).toBe(true); // above
    expect(isReleaseOutsideWindow(700, 851, rect)).toBe(true); // below
  });

  it("respects a margin (deadzone around the window)", () => {
    expect(isReleaseOutsideWindow(1315, 400, rect, 20)).toBe(false); // within margin → inside
    expect(isReleaseOutsideWindow(1321, 400, rect, 20)).toBe(true); // beyond margin → outside
  });

  it("treats a release on a second monitor as outside the primary window", () => {
    expect(isReleaseOutsideWindow(1600, 400, { x: 0, y: 0, width: 1440, height: 900 })).toBe(true);
  });
});
