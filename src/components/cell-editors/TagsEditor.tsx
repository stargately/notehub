import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react";
import type { ICellEditorParams } from "ag-grid-community";

export const TagsEditor = forwardRef(function TagsEditor(
  props: ICellEditorParams,
  ref
) {
  const tags = Array.isArray(props.value) ? props.value : [];
  const [value, setValue] = useState(tags.join(", "));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useImperativeHandle(ref, () => ({
    getValue() {
      return value
        .split(",")
        .map((t: string) => t.trim())
        .filter(Boolean);
    },
  }));

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => props.stopEditing()}
      onKeyDown={(e) => {
        if (e.key === "Enter") props.stopEditing();
      }}
      placeholder="tag1, tag2, ..."
      className="w-full h-full px-2 py-1 border-0 outline-none bg-white dark:bg-gray-800 text-sm"
    />
  );
});
