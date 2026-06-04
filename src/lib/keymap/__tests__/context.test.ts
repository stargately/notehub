import { describe, it, expect } from "vitest";
import { compileContext } from "../context";

const set = (...names: string[]) => new Set(names);

describe("compileContext", () => {
  it("an empty predicate matches everywhere", () => {
    expect(compileContext(undefined)(set())).toBe(true);
    expect(compileContext("")(set("Grid"))).toBe(true);
  });

  it("matches a bare identifier against the active set", () => {
    const p = compileContext("Grid");
    expect(p(set("Workspace", "Grid"))).toBe(true);
    expect(p(set("Workspace"))).toBe(false);
  });

  it("handles ! && || and parentheses with precedence", () => {
    expect(compileContext("!Terminal")(set("Editor"))).toBe(true);
    expect(compileContext("!Terminal")(set("Terminal"))).toBe(false);
    expect(compileContext("Grid && Workspace")(set("Grid", "Workspace"))).toBe(true);
    expect(compileContext("Grid && Workspace")(set("Grid"))).toBe(false);
    expect(compileContext("Grid || QA")(set("QA"))).toBe(true);
    // && binds tighter than ||: "QA && Editor || Grid" === "(QA && Editor) || Grid"
    expect(compileContext("QA && Editor || Grid")(set("Grid"))).toBe(true);
    expect(compileContext("QA && (Editor || Grid)")(set("QA", "Grid"))).toBe(true);
    expect(compileContext("QA && (Editor || Grid)")(set("QA"))).toBe(false);
  });
});
