import { useEffect, useRef, type RefObject } from "react";

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onClickOutside: () => void
) {
  const callbackRef = useRef(onClickOutside);
  callbackRef.current = onClickOutside;

  useEffect(() => {
    if (!active) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callbackRef.current();
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [active, ref]);
}
