import { getPaymentMethodLabel, paymentMethods } from "./useExpenseParser";

export default function PaymentMethodSelector({ selected, onSelect }) {
  return (
    <section className="rounded-2xl bg-white/45 p-3">
      <p className="mb-2 text-[11px] font-black uppercase text-slate-400">Medio de pago</p>
      <div className="flex flex-wrap gap-1.5">
        {paymentMethods.map((option) => {
          const isSelected = selected === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(isSelected ? undefined : option)}
              className={[
                "motion-fast min-h-9 rounded-full border px-3 py-1.5 text-sm font-bold transition-[background-color,border-color,color,transform,box-shadow] active:scale-[0.97]",
                isSelected ? "scale-100 border-[#0066ff] bg-white text-[#0066ff] shadow-sm" : "scale-[0.98] border-transparent bg-transparent text-slate-400"
              ].join(" ")}
            >
              {getPaymentMethodLabel(option)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
