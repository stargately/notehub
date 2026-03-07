/**
 * Format a tags array into a comma-separated string for display/editing.
 */
export function formatTags(value: unknown): string {
  return Array.isArray(value) ? value.join(", ") : String(value ?? "");
}

/**
 * Parse a comma-separated string (or existing array) back into a tags array.
 */
export function parseTags(value: unknown): string[] {
  if (typeof value === "string") {
    return value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return Array.isArray(value) ? value : [];
}
