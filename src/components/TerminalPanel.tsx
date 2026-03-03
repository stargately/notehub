import { useEffect, useRef, useCallback, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
  isTauri,
  spawnTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
} from "../lib/tauri-api";
import type { TerminalOutputPayload } from "../lib/types";

interface TerminalPanelProps {
  visible: boolean;
  cwd?: string;
  onClose: () => void;
}

export function TerminalPanel({ visible, cwd, onClose }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);
  const [panelHeight, setPanelHeight] = useState(300);
  const draggingRef = useRef(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);

  // Initialize xterm + PTY once
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
        selectionBackground: "#264f78",
      },
      convertEol: true,
      scrollback: 5000,
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    if (isTauri) {
      // Spawn PTY
      spawnTerminal(cwd)
        .then(async (id) => {
          sessionIdRef.current = id;

          // Listen for PTY output
          const { listen } = await import("@tauri-apps/api/event");
          const unlisten = await listen<TerminalOutputPayload>(
            "terminal-output",
            (event) => {
              if (event.payload.session_id === id) {
                term.write(event.payload.data);
              }
            }
          );
          unlistenRef.current = unlisten;

          // Send input to PTY
          term.onData((data) => {
            writeTerminal(id, data);
          });

          // Send initial resize
          const dims = fitAddon.proposeDimensions();
          if (dims) {
            resizeTerminal(id, dims.cols, dims.rows);
          }
        })
        .catch((err) => {
          term.write(`\r\nFailed to start terminal: ${err}\r\n`);
        });
    } else {
      term.write("Terminal requires the desktop app.\r\n");
    }

    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      if (sessionIdRef.current !== null) {
        killTerminal(sessionIdRef.current);
        sessionIdRef.current = null;
      }
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
    // Only run once on mount — cwd is captured at spawn time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refit when visibility or height changes
  useEffect(() => {
    if (visible && fitAddonRef.current && termRef.current) {
      // Small delay to let CSS layout settle
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit();
        const dims = fitAddonRef.current?.proposeDimensions();
        if (dims && sessionIdRef.current !== null) {
          resizeTerminal(sessionIdRef.current, dims.cols, dims.rows);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible, panelHeight]);

  // ResizeObserver for container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (visible && fitAddonRef.current) {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && sessionIdRef.current !== null) {
          resizeTerminal(sessionIdRef.current, dims.cols, dims.rows);
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [visible]);

  // Drag handle for resizing
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

  return (
    <div
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

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "2px 8px",
          backgroundColor: "#252526",
          color: "#cccccc",
          fontSize: 12,
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        <span>Terminal</span>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "#cccccc",
            cursor: "pointer",
            fontSize: 16,
            lineHeight: 1,
            padding: "0 4px",
          }}
          title="Close terminal (Ctrl+`)"
        >
          &times;
        </button>
      </div>

      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "hidden",
          backgroundColor: "#1e1e1e",
        }}
      />
    </div>
  );
}
