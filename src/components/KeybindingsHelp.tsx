import { useEffect, useMemo, useState } from "react";
import { useKeymapApi } from "../lib/keymap/provider";
import { formatSequence } from "../lib/keymap/keystroke";
import type { ActionValue, Keymap } from "../lib/keymap/keymap";

interface KeybindingsHelpProps {
  open: boolean;
  onClose: () => void;
}

interface Row {
  keys: string;
  label: string;
}

/** Collapse a keymap to the *effective* binding per (context, keystroke) — later blocks win. */
function groupBindings(keymap: Keymap): Array<{ context: string; rows: Row[] }> {
  const groups = new Map<string, Map<string, ActionValue>>();
  const order: string[] = [];
  for (const block of keymap) {
    const ctx = block.context?.trim() || "Global";
    if (!groups.has(ctx)) {
      groups.set(ctx, new Map());
      order.push(ctx);
    }
    const m = groups.get(ctx)!;
    for (const [keys, value] of Object.entries(block.bindings)) m.set(keys, value);
  }
  return order.map((context) => ({
    context,
    rows: [...groups.get(context)!.entries()]
      .filter(([, v]) => v !== null) // null = unbound; hide it
      .map(([keys, v]) => ({
        keys,
        label: Array.isArray(v) ? `${v[0]} (${JSON.stringify(v[1])})` : (v as string),
      })),
  })).filter((g) => g.rows.length > 0);
}

const PLACEHOLDER = `[
  {
    "context": "Workspace",
    "bindings": { "mod-shift-o": "file::Open", "mod-p": null }
  }
]`;

/**
 * Keyboard-shortcuts reference + editor. Lists the effective keymap grouped by context, and lets
 * the user layer JSON overrides (saved to localStorage, merged after the defaults — Zed-style).
 */
/** What each context means — shown so users pick the right one when customizing. */
const CONTEXT_HELP: Record<string, string> = {
  Workspace: "everywhere",
  Grid: "task-table view",
  Editor: "raw markdown editor (todo docs)",
  QA: "markdown WYSIWYG (qa / plain docs)",
  RawFile: "non-markdown file open",
  Terminal: "terminal focused",
};

export function KeybindingsHelp({ open, onClose }: KeybindingsHelpProps) {
  const { mergedKeymap, userKeymapText, setUserKeymapText, resetUserKeymap, isMac, getActiveContexts } =
    useKeymapApi();
  const groups = useMemo(() => groupBindings(mergedKeymap), [mergedKeymap]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(userKeymapText);
  const [error, setError] = useState<string | null>(null);
  const [activeContexts, setActiveContexts] = useState<string[]>([]);

  // Re-seed the editor + snapshot the active contexts whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setDraft(userKeymapText);
      setError(null);
      setActiveContexts(getActiveContexts());
    }
  }, [open, userKeymapText, getActiveContexts]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    const err = setUserKeymapText(draft);
    setError(err);
    if (!err) setEditing(false);
  };

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start justify-center"
      style={{ background: "rgba(0,0,0,0.45)", paddingTop: "8vh" }}
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div
        className="w-[560px] max-w-[92vw] flex flex-col rounded-lg overflow-hidden"
        style={{
          maxHeight: "80vh",
          background: "var(--nh-bg-elevated)",
          border: "1px solid var(--nh-border)",
          boxShadow: "var(--nh-shadow-lg)",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 h-11 shrink-0 border-b"
          style={{ borderColor: "var(--nh-border)" }}
        >
          <h2 className="text-sm font-semibold" style={{ color: "var(--nh-text)" }}>
            Keyboard Shortcuts
          </h2>
          <button
            className="nh-btn"
            style={{ padding: "2px 8px" }}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "View" : "Customize"}
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-3">
          {editing ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs" style={{ color: "var(--nh-text-secondary)" }}>
                Override or add bindings as a JSON array of <code>{`{ context?, bindings }`}</code>{" "}
                blocks (layered after the defaults; use <code>null</code> to unbind). Keys use Zed
                syntax: <code>mod-shift-p</code>, <code>ctrl-`</code>, chords like{" "}
                <code>mod-k mod-s</code>. Comments and trailing commas are allowed (JSONC).
              </p>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={PLACEHOLDER}
                spellCheck={false}
                className="w-full h-56 p-2 text-[12px] rounded outline-none resize-none"
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  background: "var(--nh-bg-sunken)",
                  border: `1px solid ${error ? "var(--nh-accent)" : "var(--nh-border)"}`,
                  color: "var(--nh-text)",
                }}
              />
              {error && (
                <p className="text-xs" style={{ color: "var(--nh-accent)" }}>
                  {error}
                </p>
              )}
              <div className="flex items-center gap-2 justify-end">
                <button className="nh-btn" onClick={resetUserKeymap}>
                  Reset to defaults
                </button>
                <button className="nh-btn-primary" onClick={handleSave}>
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div
                  className="text-[12px] flex flex-wrap items-center gap-1.5"
                  style={{ color: "var(--nh-text-secondary)" }}
                >
                  <span>Active now:</span>
                  {Object.keys(CONTEXT_HELP).map((ctx) => {
                    const on = activeContexts.includes(ctx);
                    return (
                      <span
                        key={ctx}
                        title={CONTEXT_HELP[ctx]}
                        className="px-1.5 py-0.5 rounded text-[11px]"
                        style={{
                          background: on ? "var(--nh-accent-subtle)" : "var(--nh-bg-sunken)",
                          color: on ? "var(--nh-accent)" : "var(--nh-text-tertiary)",
                          border: `1px solid ${on ? "var(--nh-accent)" : "var(--nh-border)"}`,
                        }}
                      >
                        {ctx}
                      </span>
                    );
                  })}
                </div>
                <p className="text-[11px]" style={{ color: "var(--nh-text-tertiary)" }}>
                  A binding only fires when its context is active (hover a chip for what it means).
                </p>
              </div>
              {groups.map((group) => (
                <div key={group.context}>
                  <div
                    className="text-[11px] font-semibold uppercase tracking-wide mb-1"
                    style={{ color: "var(--nh-text-tertiary)" }}
                  >
                    {group.context}
                  </div>
                  <div className="flex flex-col">
                    {group.rows.map((row) => (
                      <div
                        key={row.keys + row.label}
                        className="flex items-center justify-between py-[3px] text-[13px]"
                      >
                        <span style={{ color: "var(--nh-text-secondary)" }}>{row.label}</span>
                        <kbd
                          className="px-1.5 py-0.5 rounded text-[12px]"
                          style={{
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            background: "var(--nh-bg-sunken)",
                            border: "1px solid var(--nh-border)",
                            color: "var(--nh-text)",
                          }}
                        >
                          {formatSequence(row.keys, isMac)}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
