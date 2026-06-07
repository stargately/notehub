// Helpers for carrying scroll *progress* (a 0..1 fraction) across a view toggle (Cmd+/), where the
// outgoing and incoming views render the same document at very different total heights — the raw
// Monaco editor vs. the WYSIWYG QaLayout. A fraction normalizes those heights so the reader lands at
// roughly the same place instead of back at the top.

/** Current scroll position as a clamped 0..1 fraction of the scrollable range. */
export function toFraction(scrollTop: number, scrollHeight: number, clientHeight: number): number {
  const max = scrollHeight - clientHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, scrollTop / max));
}

/** The scrollTop that places a given 0..1 fraction within a scrollable range. */
export function fromFraction(fraction: number, scrollHeight: number, clientHeight: number): number {
  const max = scrollHeight - clientHeight;
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, fraction)) * max;
}
