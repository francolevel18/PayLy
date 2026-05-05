import { forwardRef, useEffect, useState } from "react";

const placeholders = ["Ej: 4500 fiambre", "Ej: 1200 uber mp", "Ej: 8500 cine tarjeta 3 cuotas"];

const ExpenseInput = forwardRef(function ExpenseInput({ value, onChange }, ref) {
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    requestAnimationFrame(() => ref.current?.focus());
  }, [ref]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % placeholders.length);
    }, 2600);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <label className="block">
      <span className="sr-only">Escribir gasto</span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholders[placeholderIndex]}
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        className="motion-fast h-16 w-full rounded-3xl border-2 border-white bg-white px-5 text-xl font-bold text-slate-950 shadow-[0_14px_35px_rgba(15,23,42,0.12)] outline-none transition-[border-color,box-shadow,transform] placeholder:font-semibold placeholder:text-slate-400 focus:border-[#0066ff] focus:shadow-[0_16px_38px_rgba(0,102,255,0.14)] focus:ring-4 focus:ring-blue-500/10 active:scale-[0.995]"
      />
    </label>
  );
});

export default ExpenseInput;
