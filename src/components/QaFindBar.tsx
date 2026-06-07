import { useEffect, useRef, useState } from "react";

interface QaFindBarProps {
  query: string;
  replace: string;
  caseSensitive: boolean;
  /** Total number of matches found. */
  matchCount: number;
  /** 0-based index of the active match (use -1 / 0 when there are none). */
  activeIndex: number;
  onQueryChange: (q: string) => void;
  onReplaceChange: (r: string) => void;
  onToggleCase: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReplaceCurrent: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
  /**
   * Changes whenever Cmd+F is pressed (including while the bar is already open) — bumping it
   * re-focuses and selects the find input, so a second Cmd+F returns focus to it (like browsers).
   */
  focusSignal?: number;
}

/**
 * Find & replace overlay for the `layout: qa` view. Pinned to the top-right of the
 * document area. Enter/Shift+Enter cycle matches; Escape closes.
 */
export function QaFindBar({
  query, replace, caseSensitive, matchCount, activeIndex,
  onQueryChange, onReplaceChange, onToggleCase, onNext, onPrev,
  onReplaceCurrent, onReplaceAll, onClose, focusSignal,
}: QaFindBarProps) {
  const [showReplace, setShowReplace] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);

  // Focus + select on mount and again whenever `focusSignal` changes (a repeated Cmd+F). Selecting
  // lets the user immediately overwrite the previous query.
  useEffect(() => {
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [focusSignal]);

  const onFindKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const counter = matchCount > 0 ? `${activeIndex + 1}/${matchCount}` : query ? "0/0" : "";

  return (
    <div className="nh-qa-find nh-fade-in" role="search">
      <div className="nh-qa-find-row">
        <button
          className={`nh-qa-find-toggle ${showReplace ? "active" : ""}`}
          onClick={() => setShowReplace((v) => !v)}
          title={showReplace ? "Hide replace" : "Show replace"}
        >
          {showReplace ? "▾" : "▸"}
        </button>
        <input
          ref={findInputRef}
          className="nh-qa-find-input"
          placeholder="Find"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onFindKeyDown}
        />
        <span className="nh-qa-find-count">{counter}</span>
        <button
          className={`nh-qa-find-icon ${caseSensitive ? "active" : ""}`}
          onClick={onToggleCase}
          title="Match case"
        >
          Aa
        </button>
        <button className="nh-qa-find-icon" onClick={onPrev} disabled={matchCount === 0} title="Previous (Shift+Enter)">
          ↑
        </button>
        <button className="nh-qa-find-icon" onClick={onNext} disabled={matchCount === 0} title="Next (Enter)">
          ↓
        </button>
        <button className="nh-qa-find-icon" onClick={onClose} title="Close (Esc)">
          ✕
        </button>
      </div>

      {showReplace && (
        <div className="nh-qa-find-row">
          <span className="nh-qa-find-toggle" />
          <input
            className="nh-qa-find-input"
            placeholder="Replace"
            value={replace}
            onChange={(e) => onReplaceChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }}
          />
          <button className="nh-qa-find-icon nh-qa-find-text" onClick={onReplaceCurrent} disabled={matchCount === 0} title="Replace">
            Replace
          </button>
          <button className="nh-qa-find-icon nh-qa-find-text" onClick={onReplaceAll} disabled={matchCount === 0} title="Replace all">
            All
          </button>
        </div>
      )}
    </div>
  );
}
