import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";
import CategorySelector from "./CategorySelector";
import PaymentMethodSelector from "./PaymentMethodSelector";

const installmentOptions = [1, 3, 6, 9, 12];

export default function ExpensePreview({ preview, onSelectCategory, onSelectInstallments, onSelectPaymentMethod }) {
  const hasInstallments = preview.paymentMethod === "credit" && preview.installments > 1;

  return (
    <>
      <section
        key={`${preview.category}-${preview.paymentMethod}-${preview.description}`}
        className="animate-quickIn rounded-2xl bg-slate-950 p-5 text-white shadow-[0_18px_45px_rgba(15,23,42,0.22)]"
      >
        <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold text-slate-400">Listo para guardar</p>
            <p key={preview.amount} className="animate-amountFlip truncate text-4xl font-black leading-none">
              {formatCurrency(preview.amount)}
            </p>
          </div>
          {hasInstallments ? (
            <div className="shrink-0 rounded-2xl bg-white px-3 py-2 text-right text-slate-950">
              <p className="text-[10px] font-black uppercase text-slate-400">Cuota</p>
              <p className="text-sm font-black">{formatCurrency(preview.amount / preview.installments)}</p>
            </div>
          ) : null}
        </div>
        <div className="space-y-2">
          <p className="truncate rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-slate-200">
            {preview.description}
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs font-black">
            <PreviewTag label="Categoria" value={getCategoryLabel(preview.category)} />
            <PreviewTag
              label="Pago"
              value={`${getPaymentMethodLabel(preview.paymentMethod)}${hasInstallments ? ` · ${preview.installments} cuotas` : ""}`}
            />
          </div>
        </div>
      </section>

      <CategorySelector selected={preview.category} onSelect={onSelectCategory} />
      <PaymentMethodSelector selected={preview.paymentMethod} onSelect={onSelectPaymentMethod} />
      {preview.paymentMethod === "credit" ? (
        <InstallmentsSelector selected={preview.installments} onSelect={onSelectInstallments} />
      ) : null}
    </>
  );
}

function PreviewTag({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-white/10 px-3 py-2">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="truncate text-[#8ab8ff]">{value}</p>
    </div>
  );
}

function InstallmentsSelector({ selected, onSelect }) {
  return (
    <section className="rounded-2xl bg-white/45 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase text-slate-400">Cuotas</p>
        <p className="text-xs font-bold text-slate-400">Se guarda como una compra</p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {installmentOptions.map((option) => {
          const isSelected = selected === option;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              className={[
                "motion-fast h-10 rounded-2xl border text-sm font-black transition-[background-color,border-color,color,transform,box-shadow] active:scale-[0.97]",
                isSelected ? "border-[#0066ff] bg-white text-[#0066ff] shadow-sm" : "border-transparent bg-transparent text-slate-400"
              ].join(" ")}
            >
              {option === 1 ? "1x" : `${option}x`}
            </button>
          );
        })}
      </div>
    </section>
  );
}
