import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from "react";
import type { ICellEditorParams } from "ag-grid-community";

export const TagsEditor = forwardRef(function TagsEditor(
  props: ICellEditorParams,
  ref
) {
  const tags = Array.isArray(props.value) ? props.value : [];
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(tags.join(", "));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useImperativeHandle(ref, () => ({
    getValue() {
      return valueRef.current
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);
    },
  }));

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={valueRef.current}
      onChange={(e) => {
        valueRef.current = e.target.value;
      }}
      onBlur={() => props.stopEditing()}
      onKeyDown={(e) => {
        if (e.key === "Enter") props.stopEditing();
      }}
      placeholder="tag1, tag2, ..."
      className="w-full h-full px-2 py-1 border-0 outline-none bg-white dark:bg-gray-800 text-sm"
    />
  );
});
