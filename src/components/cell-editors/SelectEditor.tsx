import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useEffect,
} from "react";
import type { ICellEditorParams } from "ag-grid-community";

interface SelectEditorProps extends ICellEditorParams {
  options: string[];
}

export const SelectEditor = forwardRef(function SelectEditor(
  props: SelectEditorProps,
  ref
) {
  const valueRef = useRef(props.value);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  useImperativeHandle(ref, () => ({
    getValue() {
      return valueRef.current;
    },
    isCancelBeforeStart() {
      return false;
    },
    isCancelAfterEnd() {
      return false;
    },
  }));

  return (
    <select
      ref={selectRef}
      defaultValue={props.value}
      onChange={(e) => {
        valueRef.current = e.target.value;
        props.stopEditing();
      }}
      className="w-full h-full px-2 py-1 border-0 outline-none bg-white dark:bg-gray-800 text-sm"
    >
      {props.options.map((opt) => (
        <option key={opt} value={opt}>
          {opt.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
});
