import { useEffect, useRef } from "react";
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
import type { TerminalOutputPayload, TerminalExitPayload } from "../lib/types";

interface TerminalViewProps {
  /** Working directory for the spawned shell (captured once at mount). */
  cwd?: string;
  /** The owning tab is the active tab (this view is on-screen). */
  visible: boolean;
  /** This is the focused pane within its tab. */
  active: boolean;
  /** Called when the underlying shell process exits. */
  onExit?: () => void;
  /** Called when the user focuses (clicks into) this pane. */
  onFocus?: () => void;
}

/**
 * A single terminal: one xterm instance bound to one PTY session. The parent
 * (`TerminalPanel`) keeps this mounted even when its tab is hidden so background
 * terminals keep running and retain their scrollback.
 */
export function TerminalView({ cwd, visible, active, onExit, onFocus }: TerminalViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<number | null>(null);
  const unlistenRef = useRef<Array<() => void>>([]);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

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
        // Full 16-color ANSI palette (VS Code Dark+) so colored output matches
        // a real terminal.
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#e5e5e5",
      },
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

          // Listen for PTY output / exit
          const { listen } = await import("@tauri-apps/api/event");
          const unlistenOutput = await listen<TerminalOutputPayload>(
            "terminal-output",
            (event) => {
              if (event.payload.session_id === id) {
                term.write(event.payload.data);
              }
            }
          );
          const unlistenExit = await listen<TerminalExitPayload>(
            "terminal-exit",
            (event) => {
              if (event.payload.session_id === id) {
                onExitRef.current?.();
              }
            }
          );
          unlistenRef.current = [unlistenOutput, unlistenExit];

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
      for (const unlisten of unlistenRef.current) unlisten();
      unlistenRef.current = [];
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

  // Refit when this pane becomes visible/active or layout changes
  useEffect(() => {
    if (visible && fitAddonRef.current && termRef.current) {
      // Small delay to let CSS layout settle
      const timer = setTimeout(() => {
        fitAddonRef.current?.fit();
        const dims = fitAddonRef.current?.proposeDimensions();
        if (dims && sessionIdRef.current !== null) {
          resizeTerminal(sessionIdRef.current, dims.cols, dims.rows);
        }
        if (active) termRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [visible, active]);

  // ResizeObserver for container size changes (panel resize, divider drag)
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

  return (
    <div
      onMouseDown={onFocus}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        backgroundColor: "#1e1e1e",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
