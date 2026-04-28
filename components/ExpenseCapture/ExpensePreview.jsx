import {
  categories,
  formatCurrency,
  getCategoryLabel,
  getPaymentMethodLabel,
  paymentMethods
} from "./useExpenseParser";

const categoryStyles = {
  food: { chip: "border-emerald-500 text-emerald-700" },
  health: { chip: "border-rose-500 text-rose-700" },
  home: { chip: "border-violet-500 text-violet-700" },
  leisure: { chip: "border-fuchsia-500 text-fuchsia-700" },
  market: { chip: "border-amber-500 text-amber-700" },
  other: { chip: "border-slate-400 text-slate-700" },
  services: { chip: "border-cyan-500 text-cyan-700" },
  transport: { chip: "border-sky-500 text-sky-700" }
};

export default function ExpensePreview({
  preview,
  canSave,
  activePicker,
  onTogglePicker,
  onSelectCategory,
  onSelectPaymentMethod,
  onSwipeStart,
  onSwipeEnd
}) {
  return (
    <>
      <section
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
        className={[
          "rounded-2xl bg-slate-950 p-5 text-white shadow-[0_18px_45px_rgba(15,23,42,0.24)] transition active:-translate-y-1",
          canSave ? "cursor-grab" : ""
        ].join(" ")}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-bold text-slate-400">Preview</p>
            <p key={preview.amount} className="animate-amountFlip truncate text-4xl font-black leading-none">
              {formatCurrency(preview.amount)}
            </p>
          </div>
          <div data-picker className="relative shrink-0 space-y-1 text-right text-sm">
            <PreviewTag
              label={getCategoryLabel(preview.category)}
              active={activePicker === "category"}
              onClick={() => onTogglePicker(activePicker === "category" ? null : "category")}
            />
            <PreviewTag
              label={getPaymentMethodLabel(preview.paymentMethod)}
              muted
              active={activePicker === "payment"}
              onClick={() => onTogglePicker(activePicker === "payment" ? null : "payment")}
            />
            {activePicker === "category" && (
              <MiniSelector
                options={categories}
                selected={preview.category}
                getLabel={getCategoryLabel}
                onSelect={(value) => {
                  onSelectCategory(value);
                  onTogglePicker(null);
                }}
              />
            )}
            {activePicker === "payment" && (
              <MiniSelector
                options={paymentMethods}
                selected={preview.paymentMethod}
                getLabel={getPaymentMethodLabel}
                onSelect={(value) => {
                  onSelectPaymentMethod(value);
                  onTogglePicker(null);
                }}
              />
            )}
          </div>
        </div>
        <p className="truncate rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-slate-200">
          {preview.description}
        </p>
      </section>

      <QuickChips
        title="Categoria"
        options={categories}
        selected={preview.category}
        getLabel={getCategoryLabel}
        onSelect={onSelectCategory}
        styleMap={categoryStyles}
      />

      <QuickChips
        title="Medio de pago"
        options={paymentMethods}
        selected={preview.paymentMethod}
        getLabel={getPaymentMethodLabel}
        onSelect={onSelectPaymentMethod}
      />
    </>
  );
}

function PreviewTag({ label, active, muted = false, onClick }) {
  return (
    <button
      data-preview-control
      type="button"
      onClick={onClick}
      className={[
        "block rounded-full px-3 py-1 text-xs font-black transition active:scale-95",
        active ? "bg-[#0066ff] text-white" : muted ? "bg-white/10 text-slate-300" : "bg-white text-slate-950"
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function MiniSelector({ options, selected, getLabel, onSelect }) {
  return (
    <div className="absolute right-0 top-16 z-40 flex w-56 flex-wrap justify-end gap-2 rounded-3xl border border-white/20 bg-white p-3 text-left shadow-[0_18px_45px_rgba(15,23,42,0.2)]">
      {options.map((option) => (
        <button
          data-preview-control
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className={[
            "rounded-full border px-3 py-2 text-xs font-black transition active:scale-95",
            selected === option ? "border-[#0066ff] bg-[#0066ff] text-white" : "border-slate-100 bg-slate-50 text-slate-600"
          ].join(" ")}
        >
          {getLabel(option)}
        </button>
      ))}
    </div>
  );
}

function QuickChips({ title, options, selected, getLabel, onSelect, styleMap }) {
  return (
    <section>
      <p className="mb-2 text-xs font-black uppercase text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = selected === option;
          const selectedStyle = styleMap?.[option]?.chip ?? "border-[#0066ff] text-[#0066ff]";

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(isSelected ? undefined : option)}
              className={[
                "min-h-10 rounded-full border-2 bg-white px-4 py-2 text-sm font-bold shadow-sm transition active:scale-95",
                isSelected ? selectedStyle : "border-white text-slate-600"
              ].join(" ")}
            >
              {getLabel(option)}
            </button>
          );
        })}
      </div>
    </section>
  );
}
