import { useEffect, useRef, useCallback, useState, Fragment } from "react";
import { TerminalView } from "./TerminalView";
import { useKeymapAction, useKeymapContext } from "../lib/keymap/provider";
import { ACTIONS, CONTEXTS } from "../lib/keymap/actions";

interface TerminalPanelProps {
  visible: boolean;
  cwd?: string;
  onClose: () => void;
}

interface TermPane {
  id: string;
  weight: number; // flex ratio relative to sibling panes
}

interface TermTab {
  id: string;
  title: string;
  panes: TermPane[];
}

export function TerminalPanel({ visible, cwd, onClose }: TerminalPanelProps) {
  // Monotonic counters: one for stable unique ids (panes + tabs), one for the
  // human-facing "Terminal N" tab titles.
  const seqRef = useRef(0);
  const tabNumRef = useRef(0);
  const makeId = () => `t${++seqRef.current}`;
  const makeTab = useCallback((): TermTab => ({
    id: makeId(),
    title: `Terminal ${++tabNumRef.current}`,
    panes: [{ id: makeId(), weight: 1 }],
  }), []);

  // Seed all three pieces of state from a single initial tab so they can't
  // desync (e.g. under React StrictMode's double-invoked initializers).
  const initialTabRef = useRef<TermTab | null>(null);
  if (!initialTabRef.current) initialTabRef.current = makeTab();
  const [tabs, setTabs] = useState<TermTab[]>([initialTabRef.current]);
  const [activeTabId, setActiveTabId] = useState<string>(initialTabRef.current.id);
  const [activePaneId, setActivePaneId] = useState<string>(initialTabRef.current.panes[0].id);

  const [panelHeight, setPanelHeight] = useState(300);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const panelRootRef = useRef<HTMLDivElement>(null);

  // --- Tab / pane actions -------------------------------------------------

  const addTab = useCallback(() => {
    const tab = makeTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setActivePaneId(tab.panes[0].id);
  }, [makeTab]);

  const splitActivePane = useCallback(() => {
    const newPaneId = makeId();
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        const avg = t.panes.reduce((s, p) => s + p.weight, 0) / t.panes.length;
        return { ...t, panes: [...t.panes, { id: newPaneId, weight: avg }] };
      })
    );
    setActivePaneId(newPaneId);
  }, [activeTabId]);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId);
        if (next.length === 0) {
          // Never leave zero tabs — keep one fresh terminal.
          const fresh = makeTab();
          setActiveTabId(fresh.id);
          setActivePaneId(fresh.panes[0].id);
          return [fresh];
        }
        if (tabId === activeTabId) {
          const idx = prev.findIndex((t) => t.id === tabId);
          const neighbor = next[Math.min(idx, next.length - 1)];
          setActiveTabId(neighbor.id);
          setActivePaneId(neighbor.panes[0].id);
        }
        return next;
      });
    },
    [activeTabId, makeTab]
  );

  const closePane = useCallback(
    (tabId: string, paneId: string) => {
      setTabs((prev) => {
        const tab = prev.find((t) => t.id === tabId);
        if (!tab) return prev;
        // Closing the last pane of a tab closes the whole tab.
        if (tab.panes.length <= 1) {
          const next = prev.filter((t) => t.id !== tabId);
          if (next.length === 0) {
            const fresh = makeTab();
            setActiveTabId(fresh.id);
            setActivePaneId(fresh.panes[0].id);
            return [fresh];
          }
          if (tabId === activeTabId) {
            const idx = prev.findIndex((t) => t.id === tabId);
            const neighbor = next[Math.min(idx, next.length - 1)];
            setActiveTabId(neighbor.id);
            setActivePaneId(neighbor.panes[0].id);
          }
          return next;
        }
        const paneIdx = tab.panes.findIndex((p) => p.id === paneId);
        const remaining = tab.panes.filter((p) => p.id !== paneId);
        if (paneId === activePaneId) {
          const neighbor = remaining[Math.min(paneIdx, remaining.length - 1)];
          setActivePaneId(neighbor.id);
        }
        return prev.map((t) =>
          t.id === tabId ? { ...t, panes: remaining } : t
        );
      });
    },
    [activeTabId, activePaneId, makeTab]
  );

  // Cmd+D to split — only while the terminal panel is visible AND focused, so it never hijacks
  // Cmd+D from the editor/grid. Modeled as a keymap "Terminal" context (active when focus is
  // inside the panel) + the `terminal::SplitPane` action.
  const [terminalFocused, setTerminalFocused] = useState(false);
  useEffect(() => {
    if (!visible) {
      setTerminalFocused(false);
      return;
    }
    const update = () => setTerminalFocused(!!panelRootRef.current?.contains(document.activeElement));
    update();
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, [visible]);
  useKeymapContext(CONTEXTS.terminal, visible && terminalFocused);
  useKeymapAction(ACTIONS.splitTerminal, () => splitActivePane());

  // --- Panel height drag handle -------------------------------------------

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      startYRef.current = e.clientY;
      startHeightRef.current = panelHeight;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!draggingRef.current) return;
        const delta = startYRef.current - ev.clientY;
        const newHeight = Math.max(100, Math.min(800, startHeightRef.current + delta));
        setPanelHeight(newHeight);
      };

      const handleMouseUp = () => {
        draggingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [panelHeight]
  );

  // --- Pane divider drag (adjusts the two flanking panes' weights) --------

  const handleDividerDown = useCallback(
    (tabId: string, leftIdx: number) => (e: React.MouseEvent) => {
      e.preventDefault();
      const rowEl = (e.currentTarget as HTMLElement).parentElement;
      if (!rowEl) return;
      const startX = e.clientX;
      const rowWidth = rowEl.getBoundingClientRect().width;

      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      const leftStart = tab.panes[leftIdx].weight;
      const rightStart = tab.panes[leftIdx + 1].weight;
      const pairTotal = leftStart + rightStart;

      const move = (ev: MouseEvent) => {
        const dxRatio = ((ev.clientX - startX) / rowWidth) * tab.panes.length;
        let newLeft = leftStart + dxRatio;
        // Keep both panes above a small minimum.
        const min = pairTotal * 0.1;
        newLeft = Math.max(min, Math.min(pairTotal - min, newLeft));
        const newRight = pairTotal - newLeft;
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== tabId) return t;
            const panes = t.panes.slice();
            panes[leftIdx] = { ...panes[leftIdx], weight: newLeft };
            panes[leftIdx + 1] = { ...panes[leftIdx + 1], weight: newRight };
            return { ...t, panes };
          })
        );
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    },
    [tabs]
  );

  // --- Render -------------------------------------------------------------

  const iconBtn: React.CSSProperties = {
    background: "none",
    border: "none",
    color: "#cccccc",
    cursor: "pointer",
    padding: "2px 4px",
    display: "flex",
    alignItems: "center",
    lineHeight: 1,
  };

  return (
    <div
      ref={panelRootRef}
      style={{
        height: panelHeight,
        display: visible ? "flex" : "none",
        flexDirection: "column",
        flexShrink: 0,
      }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          height: 4,
          cursor: "ns-resize",
          backgroundColor: "#333",
          flexShrink: 0,
        }}
      />

      {/* Header: tab strip + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "2px 6px",
          backgroundColor: "#252526",
          color: "#cccccc",
          fontSize: 12,
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, overflow: "hidden" }}>
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setActivePaneId(tab.panes[0].id);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 6px",
                  borderRadius: 4,
                  cursor: "pointer",
                  backgroundColor: isActive ? "#37373d" : "transparent",
                  color: isActive ? "#ffffff" : "#aaaaaa",
                  whiteSpace: "nowrap",
                }}
              >
                <span>{tab.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  style={{ ...iconBtn, padding: 0 }}
                  title="Close tab"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button onClick={splitActivePane} style={iconBtn} title="Split right (Cmd+D)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="16" rx="1.5" strokeWidth={2} />
              <line x1="12" y1="4" x2="12" y2="20" strokeWidth={2} />
            </svg>
          </button>
          <button onClick={addTab} style={iconBtn} title="New terminal tab">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button onClick={onClose} style={{ ...iconBtn, fontSize: 16 }} title="Close terminal (Ctrl+`)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bodies: every tab stays mounted (display toggled) so background
          terminals keep running and retain scrollback. */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            style={{
              display: tab.id === activeTabId ? "flex" : "none",
              flexDirection: "row",
              width: "100%",
              height: "100%",
            }}
          >
            {tab.panes.map((pane, idx) => (
              <Fragment key={pane.id}>
                <div
                  style={{
                    flex: pane.weight,
                    minWidth: 0,
                    height: "100%",
                    outline:
                      tab.id === activeTabId &&
                      pane.id === activePaneId &&
                      tab.panes.length > 1
                        ? "1px solid #37373d"
                        : "none",
                  }}
                >
                  <TerminalView
                    cwd={cwd}
                    visible={tab.id === activeTabId}
                    active={pane.id === activePaneId}
                    onFocus={() => setActivePaneId(pane.id)}
                    onExit={() => closePane(tab.id, pane.id)}
                  />
                </div>
                {idx < tab.panes.length - 1 && (
                  <div
                    onMouseDown={handleDividerDown(tab.id, idx)}
                    style={{
                      width: 4,
                      cursor: "col-resize",
                      backgroundColor: "#333",
                      flexShrink: 0,
                    }}
                  />
                )}
              </Fragment>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
