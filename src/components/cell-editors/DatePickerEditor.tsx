import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
} from "react";
import type { ICellEditorParams } from "ag-grid-community";

export const DatePickerEditor = forwardRef(function DatePickerEditor(
  props: ICellEditorParams,
  ref
) {
  const [value, setValue] = useState(props.value || "");
  const valueRef = useRef(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.showPicker?.();
  }, []);

  useImperativeHandle(ref, () => ({
    getValue() {
      return valueRef.current;
    },
  }));

  return (
    <input
      ref={inputRef}
      type="date"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        valueRef.current = e.target.value;
        props.stopEditing();
      }}
      className="w-full h-full px-2 py-1 border-0 outline-none bg-white dark:bg-gray-800 text-sm"
    />
  );
});
