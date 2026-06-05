/**
 * Tab tear-off geometry. A tab is dragged via native HTML5 drag; on `dragend` we get the release
 * point in logical screen coords (`MouseEvent.screenX/screenY`) and compare it to the window's
 * outer rect (fetched from Rust as `get_window_rect`, also logical) to decide whether the tab was
 * released *outside* the window — in which case it tears off into a new window.
 */

export interface ScreenRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Whether the screen point `(sx, sy)` lies outside `rect` (optionally past a `margin`). Edges are
 * treated as inside (inclusive), so a release exactly on the window border is not a tear-off.
 */
export function isReleaseOutsideWindow(
  sx: number,
  sy: number,
  rect: ScreenRect,
  margin = 0,
): boolean {
  return (
    sx < rect.x - margin ||
    sx > rect.x + rect.width + margin ||
    sy < rect.y - margin ||
    sy > rect.y + rect.height + margin
  );
}
