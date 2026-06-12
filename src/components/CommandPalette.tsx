import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fuzzyFilter } from "../lib/fuzzy";
import { useKeymapApi } from "../lib/keymap/provider";
import { paletteCommands, type PaletteCommand } from "../lib/keymap/commands";
import { formatSequence } from "../lib/keymap/keystroke";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface Row extends PaletteCommand {
  indices?: number[];
}

const MAX_ROWS = 50;

/** Render a command title with the fuzzy-matched characters accented. */
function TitleLabel({ title, indices }: { title: string; indices?: number[] }) {
  if (!indices || indices.length === 0) {
    return (
      <span className="truncate" style={{ color: "var(--nh-text)" }}>
        {title}
      </span>
    );
  }
  const set = new Set(indices);
  return (
    <span className="truncate">
      {Array.from(title).map((ch, i) =>
        set.has(i) ? (
          <span key={i} style={{ color: "var(--nh-accent)", fontWeight: 600 }}>
            {ch}
          </span>
        ) : (
          <span key={i} style={{ color: "var(--nh-text)" }}>
            {ch}
          </span>
        ),
      )}
    </span>
  );
}

/**
 * Zed-style Cmd+Shift+P command palette: a fuzzy finder over every currently-runnable keymap
 * action (titled + handler registered), showing each command's live keybinding. Enter dispatches
 * the action through the keymap registry (`performAction`), so the focused view's handler fires —
 * the same path as pressing the key.
 */
export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { mergedKeymap, getActiveContexts, getRegisteredActions, performAction, isMac } =
    useKeymapApi();
  const [query, setQuery] = useState("");
  const [commands, setCommands] = useState<PaletteCommand[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // The element focused before the palette stole focus — restored before running a command, so
  // focus-sensitive handlers (e.g. paste-as-plain-text) target the editor, not the palette.
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // On open: snapshot the runnable command list + the prior focus, reset, and focus the input.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    prevFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCommands(paletteCommands(mergedKeymap, getActiveContexts(), getRegisteredActions()));
    inputRef.current?.focus();
  }, [open, mergedKeymap, getActiveContexts, getRegisteredActions]);

  const results = useMemo<Row[]>(() => {
    if (!open) return [];
    if (!query.trim()) return commands.slice(0, MAX_ROWS);
    return fuzzyFilter(query.trim(), commands, (c) => c.title)
      .slice(0, MAX_ROWS)
      .map(({ item, match }) => ({ ...item, indices: match.indices }));
  }, [open, query, commands]);

  // Keep the selection in range and scrolled into view.
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, results.length - 1)));
  }, [results.length]);
  useEffect(() => {
    // Optional call: jsdom (tests) doesn't implement scrollIntoView.
    rowRefs.current[selected]?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  const run = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      onClose();
      // Restore focus first (the palette input holds it); the unmount happens after this handler,
      // and removing a non-focused element won't move focus again.
      prevFocusRef.current?.focus();
      performAction(row.action);
    },
    [onClose, performAction],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => (results.length ? (s + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => (results.length ? (s - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[selected]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center nh-fade-in"
      style={{ background: "rgba(0,0,0,0.32)", paddingTop: "14vh" }}
      onMouseDown={onClose}
    >
      <div
        className="w-[640px] max-w-[92vw] flex flex-col overflow-hidden"
        style={{
          background: "var(--nh-bg-elevated)",
          border: "1px solid var(--nh-border)",
          borderRadius: "var(--nh-radius-lg)",
          boxShadow: "var(--nh-shadow-lg)",
          maxHeight: "62vh",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Run a command…"
          spellCheck={false}
          className="w-full bg-transparent outline-none px-4 h-12 text-[15px]"
          style={{ color: "var(--nh-text)", borderBottom: "1px solid var(--nh-border)" }}
        />

        <div className="flex-1 overflow-auto py-1">
          {results.length === 0 ? (
            <div
              className="px-4 py-6 text-center text-[13px]"
              style={{ color: "var(--nh-text-tertiary)" }}
            >
              No matching commands
            </div>
          ) : (
            results.map((row, i) => (
              <button
                key={row.action}
                ref={(el) => (rowRefs.current[i] = el)}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => run(row)}
                onMouseMove={() => setSelected(i)}
                className="w-full flex items-center gap-2 text-left px-4 py-[6px] text-[13px]"
                style={{
                  background: i === selected ? "var(--nh-accent-subtle)" : undefined,
                }}
              >
                <TitleLabel title={row.title} indices={row.indices} />
                <span
                  className="truncate text-[12px]"
                  style={{ color: "var(--nh-text-tertiary)" }}
                >
                  {row.action}
                </span>
                {row.keystroke && (
                  <kbd
                    className="ml-auto shrink-0 px-1.5 py-0.5 rounded text-[12px]"
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      background: "var(--nh-bg-sunken)",
                      border: "1px solid var(--nh-border)",
                      color: "var(--nh-text)",
                    }}
                  >
                    {formatSequence(row.keystroke, isMac)}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
