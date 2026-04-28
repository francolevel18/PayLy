import { forwardRef, useEffect } from "react";

const ExpenseInput = forwardRef(function ExpenseInput({ value, onChange }, ref) {
  useEffect(() => {
    requestAnimationFrame(() => ref.current?.focus());
  }, [ref]);

  return (
    <label className="block">
      <span className="sr-only">Escribir gasto</span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="4500 comida"
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        className="h-16 w-full rounded-3xl border-2 border-white bg-white px-5 text-xl font-bold text-slate-950 shadow-[0_14px_35px_rgba(15,23,42,0.12)] outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-[#0066ff] focus:ring-4 focus:ring-blue-500/10"
      />
    </label>
  );
});

export default ExpenseInput;
