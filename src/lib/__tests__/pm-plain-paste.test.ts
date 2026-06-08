import { describe, it, expect, vi, afterEach } from "vitest";
import {
  registerPmView,
  findFocusedView,
  insertPlainTextIntoView,
  pasteAsPlainText,
  type PmInsertView,
} from "../pm-plain-paste";

/**
 * A fake ProseMirror view backed by a real (focusable) DOM node, so `document.activeElement`
 * matching works under jsdom. `state.tr` is a chainable stub recording the inserted text.
 */
function makeView() {
  const dom = document.createElement("div");
  dom.tabIndex = 0; // make it focusable in jsdom
  document.body.appendChild(dom);
  const tr = {
    inserted: null as string | null,
    scrolled: false,
    insertText(text: string) {
      this.inserted = text;
      return this;
    },
    scrollIntoView() {
      this.scrolled = true;
      return this;
    },
  };
  const dispatch = vi.fn();
  // Cast through unknown: the chainable `tr` + mock `dispatch` satisfy PmInsertView structurally
  // but vitest's Mock type doesn't line up with the declared call signature.
  const view = { dom, state: { tr }, dispatch } as unknown as PmInsertView;
  return { view, dom, tr, dispatch };
}

const cleanups: Array<() => void> = [];
function track(unregister: () => void) {
  cleanups.push(unregister);
  return unregister;
}

afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
  document.body.innerHTML = "";
  (document.activeElement as HTMLElement | null)?.blur?.();
});

describe("pm-plain-paste", () => {
  it("inserts the clipboard text into the focused registered view (literal, via insertText)", async () => {
    const { view, dom, tr, dispatch } = makeView();
    track(registerPmView(view));
    dom.focus();

    const result = await pasteAsPlainText(async () => "# foo");

    expect(result).toBe("# foo");
    expect(tr.inserted).toBe("# foo"); // literal characters — never parsed into a heading
    expect(tr.scrolled).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(tr);
  });

  it("no-ops (returns null, no dispatch) when no registered view is focused", async () => {
    const { view, dispatch } = makeView();
    track(registerPmView(view));
    // nothing focused (activeElement is body)

    const result = await pasteAsPlainText(async () => "hello");

    expect(result).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("routes to whichever of several registered views holds focus", async () => {
    const a = makeView();
    const b = makeView();
    track(registerPmView(a.view));
    track(registerPmView(b.view));
    b.dom.focus();

    await pasteAsPlainText(async () => "x");

    expect(b.dispatch).toHaveBeenCalledTimes(1);
    expect(a.dispatch).not.toHaveBeenCalled();
  });

  it("matches when focus is on a descendant of the view's dom (contains)", () => {
    const { view, dom } = makeView();
    track(registerPmView(view));
    const child = document.createElement("span");
    child.tabIndex = 0;
    dom.appendChild(child);
    child.focus();

    expect(findFocusedView()).toBe(view);
  });

  it("captures the focused view synchronously, before the async clipboard read", async () => {
    const a = makeView();
    const b = makeView();
    track(registerPmView(a.view));
    track(registerPmView(b.view));
    a.dom.focus();

    // The read resolves only after focus has moved to b — the insert must still target a.
    const result = await pasteAsPlainText(
      () =>
        new Promise<string>((resolve) => {
          b.dom.focus();
          resolve("captured");
        }),
    );

    expect(result).toBe("captured");
    expect(a.tr.inserted).toBe("captured");
    expect(a.dispatch).toHaveBeenCalledTimes(1);
    expect(b.dispatch).not.toHaveBeenCalled();
  });

  it("does nothing for an empty clipboard", async () => {
    const { view, dom, dispatch } = makeView();
    track(registerPmView(view));
    dom.focus();

    const result = await pasteAsPlainText(async () => "");

    expect(result).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("fails gracefully when the clipboard read rejects (permission denied)", async () => {
    const { view, dom, dispatch } = makeView();
    track(registerPmView(view));
    dom.focus();

    const result = await pasteAsPlainText(async () => {
      throw new Error("NotAllowedError");
    });

    expect(result).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("stops routing to a view once it is unregistered", async () => {
    const { view, dom, dispatch } = makeView();
    const unregister = registerPmView(view);
    dom.focus();
    unregister();

    const result = await pasteAsPlainText(async () => "x");

    expect(result).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("insertPlainTextIntoView dispatches an insertText+scrollIntoView transaction", () => {
    const { view, tr, dispatch } = makeView();
    insertPlainTextIntoView(view, "literal *text*");
    expect(tr.inserted).toBe("literal *text*");
    expect(tr.scrolled).toBe(true);
    expect(dispatch).toHaveBeenCalledWith(tr);
  });
});
