import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fuzzyFilter } from "../lib/fuzzy";
import { recentPaths } from "../lib/recent-files";
import type { FileEntry, TabInfo } from "../lib/types";

interface QuickOpenProps {
  open: boolean;
  onClose: () => void;
  workspaceRoot: string | null;
  tabs: TabInfo[];
  /** Lazily fetch (and cache) the recursive workspace file index. */
  ensureIndex: () => Promise<FileEntry[]>;
  /** Open/focus a file by absolute path (= useTabManagement.openPath). */
  onOpenFile: (path: string) => void;
  /** Prompt to open a folder when there's no workspace root yet. */
  onOpenFolder: () => void;
}

interface Row extends FileEntry {
  indices?: number[];
}

const MAX_ROWS = 50;

/** A path with no index entry (e.g. an open file outside the workspace root). */
function synthRow(path: string): Row {
  const name = path.split("/").pop() || path;
  return { path, rel: name, name };
}

/** Empty-query ordering: open tabs first (tab order), then the MRU, deduped. */
function emptyQueryRows(tabs: TabInfo[], index: FileEntry[]): Row[] {
  const byPath = new Map(index.map((e) => [e.path, e]));
  const seen = new Set<string>();
  const rows: Row[] = [];
  const push = (path: string | null) => {
    if (!path || path.startsWith("browser://") || seen.has(path)) return;
    seen.add(path);
    rows.push(byPath.get(path) ?? synthRow(path));
  };
  for (const t of tabs) push(t.filePath);
  for (const p of recentPaths()) push(p);
  return rows.slice(0, MAX_ROWS);
}

/** Render a relative path: basename emphasized, dir dimmed, fuzzy-matched chars accented. */
function RowLabel({ rel, indices }: { rel: string; indices?: number[] }) {
  const slash = rel.lastIndexOf("/");
  const dir = slash >= 0 ? rel.slice(0, slash + 1) : "";
  const base = slash >= 0 ? rel.slice(slash + 1) : rel;
  const baseStart = slash + 1;

  if (!indices || indices.length === 0) {
    return (
      <span className="flex items-baseline gap-2 min-w-0">
        <span className="truncate" style={{ color: "var(--nh-text)" }}>
          {base}
        </span>
        {dir && (
          <span className="truncate text-[12px]" style={{ color: "var(--nh-text-tertiary)" }}>
            {dir}
          </span>
        )}
      </span>
    );
  }

  const set = new Set(indices);
  const chars = (text: string, offset: number, baseColor: string) =>
    Array.from(text).map((ch, i) =>
      set.has(offset + i) ? (
        <span key={i} style={{ color: "var(--nh-accent)", fontWeight: 600 }}>
          {ch}
        </span>
      ) : (
        <span key={i} style={{ color: baseColor }}>
          {ch}
        </span>
      ),
    );

  return (
    <span className="flex items-baseline gap-2 min-w-0">
      <span className="truncate">{chars(base, baseStart, "var(--nh-text)")}</span>
      {dir && (
        <span className="truncate text-[12px]">{chars(dir, 0, "var(--nh-text-tertiary)")}</span>
      )}
    </span>
  );
}

/** Zed/VS Code-style Cmd+P fuzzy file finder over the current workspace. */
export function QuickOpen({
  open,
  onClose,
  workspaceRoot,
  tabs,
  ensureIndex,
  onOpenFile,
  onOpenFolder,
}: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // On open: reset, focus, and (lazily) fetch the index.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    inputRef.current?.focus();
    let cancelled = false;
    ensureIndex().then((files) => {
      if (!cancelled) setIndex(files);
    });
    return () => {
      cancelled = true;
    };
  }, [open, ensureIndex]);

  const results = useMemo<Row[]>(() => {
    if (!open) return [];
    if (!query.trim()) return emptyQueryRows(tabs, index);
    return fuzzyFilter(query.trim(), index, (e) => e.rel)
      .slice(0, MAX_ROWS)
      .map(({ item, match }) => ({ ...item, indices: match.indices }));
  }, [open, query, index, tabs]);

  // Keep the selection in range and scrolled into view.
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(0, results.length - 1)));
  }, [results.length]);
  useEffect(() => {
    rowRefs.current[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const choose = useCallback(
    (row: Row | undefined) => {
      if (!row) return;
      onClose();
      onOpenFile(row.path);
    },
    [onClose, onOpenFile],
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
      choose(results[selected]);
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
          placeholder={workspaceRoot ? "Search files by name…" : "Open recent files…"}
          spellCheck={false}
          className="w-full bg-transparent outline-none px-4 h-12 text-[15px]"
          style={{ color: "var(--nh-text)", borderBottom: "1px solid var(--nh-border)" }}
        />

        <div className="flex-1 overflow-auto py-1">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px]" style={{ color: "var(--nh-text-tertiary)" }}>
              {!workspaceRoot ? (
                <div className="flex flex-col items-center gap-3">
                  <span>Open a folder to search its files.</span>
                  <button
                    className="nh-btn-primary"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      onClose();
                      onOpenFolder();
                    }}
                  >
                    Open Folder
                  </button>
                </div>
              ) : query.trim() ? (
                "No matching files"
              ) : (
                "No recent files"
              )}
            </div>
          ) : (
            results.map((row, i) => (
              <button
                key={row.path}
                ref={(el) => (rowRefs.current[i] = el)}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => choose(row)}
                onMouseMove={() => setSelected(i)}
                className="w-full flex items-center text-left px-4 py-[6px] text-[13px]"
                style={{
                  background: i === selected ? "var(--nh-accent-subtle)" : undefined,
                }}
              >
                <RowLabel rel={row.rel} indices={row.indices} />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
