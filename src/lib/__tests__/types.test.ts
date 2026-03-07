import { describe, it, expect } from "vitest";
import { resolveFieldType } from "../types";
import type { ColumnConfig } from "../types";

describe("resolveFieldType", () => {
  it("resolves 'tags' field to 'tags' type", () => {
    const col: ColumnConfig = { field: "tags", width: 200 };
    expect(resolveFieldType(col)).toBe("tags");
  });

  it("resolves 'status' field to 'select' type", () => {
    const col: ColumnConfig = { field: "status", width: 120 };
    expect(resolveFieldType(col)).toBe("select");
  });

  it("resolves 'due' field to 'date' type", () => {
    const col: ColumnConfig = { field: "due", width: 120 };
    expect(resolveFieldType(col)).toBe("date");
  });

  it("uses explicit type over built-in mapping", () => {
    const col: ColumnConfig = { field: "tags", width: 200, type: "text" };
    expect(resolveFieldType(col)).toBe("text");
  });

  it("defaults unknown fields to 'text'", () => {
    const col: ColumnConfig = { field: "custom_field", width: 100 };
    expect(resolveFieldType(col)).toBe("text");
  });
});
