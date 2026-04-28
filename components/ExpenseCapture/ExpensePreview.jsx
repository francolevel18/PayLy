import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";
import CategorySelector from "./CategorySelector";
import PaymentMethodSelector from "./PaymentMethodSelector";

export default function ExpensePreview({ preview, onSelectCategory, onSelectPaymentMethod }) {
  return (
    <>
      <section
        key={`${preview.category}-${preview.paymentMethod}-${preview.description}`}
        className="animate-quickIn rounded-2xl bg-slate-950 p-5 text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)]"
      >
        <div className="mb-4 min-w-0">
          <p className="mb-1 text-xs font-bold text-slate-400">Preview</p>
          <p key={preview.amount} className="animate-amountFlip truncate text-4xl font-black leading-none">
            {formatCurrency(preview.amount)}
          </p>
          <p key={`${preview.category}-${preview.paymentMethod}`} className="animate-parserPulse mt-3 truncate text-sm font-bold text-[#8ab8ff]">
            Detectado: {getCategoryLabel(preview.category)} - {getPaymentMethodLabel(preview.paymentMethod)}
          </p>
        </div>
        <p className="truncate rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-slate-200">
          {preview.description}
        </p>
      </section>

      <CategorySelector selected={preview.category} onSelect={onSelectCategory} />
      <PaymentMethodSelector selected={preview.paymentMethod} onSelect={onSelectPaymentMethod} />
    </>
  );
}
