import { categories, getCategoryLabel } from "./useExpenseParser";

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

export default function CategorySelector({ selected, onSelect }) {
  return (
    <QuickChips
      title="Categoria"
      options={categories}
      selected={selected}
      getLabel={getCategoryLabel}
      onSelect={onSelect}
      styleMap={categoryStyles}
    />
  );
}

function QuickChips({ title, options, selected, getLabel, onSelect, styleMap }) {
  return (
    <section className="rounded-2xl bg-white/45 p-3">
      <p className="mb-2 text-[11px] font-black uppercase text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isSelected = selected === option;
          const selectedStyle = styleMap?.[option]?.chip ?? "border-[#0066ff] text-[#0066ff]";

          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(isSelected ? undefined : option)}
              className={[
                "motion-fast min-h-9 rounded-full border px-3 py-1.5 text-sm font-bold transition-[background-color,border-color,color,transform,box-shadow] active:scale-[0.97]",
                isSelected ? `${selectedStyle} scale-100 bg-white shadow-sm` : "scale-[0.98] border-transparent bg-transparent text-slate-400"
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
