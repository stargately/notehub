import { useEffect, useLayoutEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Right-aligned shortcut hint, e.g. "⌘⇧C" or "F2". */
  shortcut?: string;
  /** Render in the accent (red) color — used for destructive actions like Delete. */
  danger?: boolean;
  /** Draw a divider above this item. */
  separatorBefore?: boolean;
}

export interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

/**
 * A small floating menu positioned at (x, y), clamped to the viewport. Closes on outside click,
 * Escape, or scroll. Shared by the tab bar and the file tree (the pattern originated in TabBar).
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Keep the menu on-screen (rows near the panel bottom/right would otherwise clip).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad)
      left = Math.max(pad, window.innerWidth - rect.width - pad);
    if (top + rect.height > window.innerHeight - pad)
      top = Math.max(pad, window.innerHeight - rect.height - pad);
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("click", onClose);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("click", onClose);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[70] py-1 min-w-[200px] rounded-lg nh-fade-in"
      style={{
        left: pos.left,
        top: pos.top,
        background: "var(--nh-bg-elevated)",
        border: "1px solid var(--nh-border)",
        boxShadow: "var(--nh-shadow-lg)",
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.separatorBefore && (
            <div className="my-1 h-px" style={{ background: "var(--nh-border)" }} />
          )}
          <button
            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between transition-colors ${
              item.disabled ? "opacity-40 cursor-default" : ""
            }`}
            style={{
              color: item.disabled
                ? "var(--nh-text-tertiary)"
                : item.danger
                ? "var(--nh-accent)"
                : "var(--nh-text)",
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) e.currentTarget.style.background = "var(--nh-bg-sunken)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
            onClick={() => {
              if (item.disabled) return;
              item.onClick();
              onClose();
            }}
            disabled={item.disabled}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span style={{ color: "var(--nh-text-tertiary)" }} className="ml-4 text-[10px]">
                {item.shortcut}
              </span>
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
