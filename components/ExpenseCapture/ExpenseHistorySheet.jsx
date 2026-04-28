import { forwardRef } from "react";
import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";

const categoryStyles = {
  food: { bar: "bg-emerald-500" },
  transport: { bar: "bg-sky-500" },
  market: { bar: "bg-amber-500" },
  health: { bar: "bg-rose-500" },
  home: { bar: "bg-violet-500" },
  other: { bar: "bg-slate-400" }
};

export function QuickMenu({ onProfile, onSettings, onTimeline, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[4px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar menu" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[2rem] bg-white px-6 pb-32 pt-4 shadow-[0_-24px_70px_rgba(15,23,42,0.24)]">
        <div className="mx-auto mb-8 h-1.5 w-14 rounded-full bg-slate-200" />
        <nav className="space-y-3" aria-label="Menu de informacion">
          <MenuItem
            icon="timeline"
            label="Timeline"
            detail="Ver historial de gastos"
            highlighted
            onClick={onTimeline}
          />
          <MenuItem icon="user" label="Profile" detail="Datos personales e identidad" onClick={onProfile} />
          <MenuItem icon="gear" label="Settings" detail="Privacidad, seguridad y apps" onClick={onSettings} />
        </nav>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, detail, highlighted = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-4 rounded-[1.5rem] p-5 text-left transition active:scale-[0.98] disabled:opacity-35",
        highlighted ? "bg-blue-100 text-[#0052cc]" : "bg-white text-slate-950 active:bg-slate-50"
      ].join(" ")}
    >
      <span
        className={[
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-sm",
          highlighted ? "bg-white text-[#0052cc]" : "bg-slate-100 text-slate-600"
        ].join(" ")}
      >
        <MenuIcon name={icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={["block text-xl font-black", highlighted ? "text-[#0052cc]" : "text-slate-950"].join(" ")}>
          {label}
        </span>
        <span className={["mt-1 block text-base font-semibold", highlighted ? "text-blue-500" : "text-slate-500"].join(" ")}>
          {detail}
        </span>
      </span>
      <span className={["text-3xl font-black", highlighted ? "text-[#0052cc]" : "text-slate-300"].join(" ")} aria-hidden="true">
        &gt;
      </span>
    </button>
  );
}

function MenuIcon({ name }) {
  const paths = {
    list: "M7 7h10M7 12h10M7 17h6",
    timeline: "M12 5v14M8 7h8M8 12h8M8 17h8M6 7h.01M6 12h.01M6 17h.01",
    bars: "M6 17V9M12 17V5M18 17v-6",
    chart: "M4 19h16M7 16l3-5 4 3 4-7",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0",
    card: "M4 7h16v10H4V7ZM4 10h16",
    gear: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 12h2m12 0h2M12 4v2m0 12v2"
  };

  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d={paths[name]} />
    </svg>
  );
}

export default function ExpenseHistorySheet({
  mode,
  count,
  total,
  insight,
  topCategory,
  topExpense,
  categorySummary,
  selectedFilter,
  onFilter,
  onClearFilter,
  expenses,
  swipedExpenseId,
  pointerStart,
  onSwipe,
  onDelete,
  onClose
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar panel" />
      <section className="absolute inset-x-0 bottom-0 mx-auto max-h-[82vh] max-w-md overflow-y-auto rounded-t-[2rem] bg-[#f5f7fb] px-4 pb-28 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">{mode === "summary" ? "Resumen" : "Hoy"}</p>
            <h2 className="text-2xl font-black">{mode === "summary" ? "Vista del dia" : "Gastos del dia"}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-black text-slate-500 shadow-sm"
            aria-label="Cerrar"
          >
            x
          </button>
        </div>

        {count === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm font-semibold text-slate-500">
            Todavia no cargaste gastos hoy.
          </p>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="rounded-full border border-slate-100 bg-white px-3 py-1 text-sm font-bold text-slate-600 shadow-sm">
                {formatCurrency(total)} en {count} {count === 1 ? "gasto" : "gastos"}
              </span>
            </div>

            <p className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#0052cc]">
              {insight}
            </p>

            {(mode === "summary" || categorySummary.length > 1) && (
              <DailySummary total={total} count={count} topCategory={topCategory} topExpense={topExpense} />
            )}

            <CategorySummary items={categorySummary} selected={selectedFilter} onSelect={onFilter} />
            {selectedFilter && (
              <button type="button" onClick={onClearFilter} className="mt-2 text-xs font-black text-[#0066ff]">
                Ver todos los gastos
              </button>
            )}

            <ul className="mt-3 space-y-2">
              {expenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  isTop={expense.id === topExpense?.id}
                  isSwiped={swipedExpenseId === expense.id}
                  pointerStart={pointerStart}
                  onSwipe={onSwipe}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function ExpenseRow({ expense, isTop, isSwiped, pointerStart, onSwipe, onDelete }) {
  return (
    <li
      data-swipe-row
      className={[
        "relative overflow-hidden rounded-xl bg-red-500",
        isTop ? "shadow-[0_8px_28px_rgba(0,102,255,0.14)]" : "shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onDelete(expense.id)}
        className="absolute inset-y-0 right-0 flex w-16 items-center justify-center text-white"
        aria-label="Eliminar gasto"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M6 7h12M9 7V5h6v2m-7 3 1 9h6l1-9" />
        </svg>
      </button>
      <div
        onPointerDown={(event) => {
          pointerStart.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerCancel={() => onSwipe(null)}
        onPointerUp={(event) => {
          const deltaX = event.clientX - pointerStart.current.x;
          const deltaY = event.clientY - pointerStart.current.y;
          onSwipe(deltaX < -36 && Math.abs(deltaX) > Math.abs(deltaY) + 12 ? expense.id : null);
        }}
        className={[
          "flex touch-pan-y items-center justify-between rounded-xl border border-slate-100/80 bg-white px-4 py-3.5 transition-transform",
          isSwiped ? "-translate-x-16" : "translate-x-0"
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={[
              "h-9 shrink-0 rounded-full",
              isTop ? "w-2 bg-[#0066ff]" : "w-1.5",
              isTop ? "" : categoryStyles[expense.category]?.bar ?? categoryStyles.other.bar
            ].join(" ")}
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{expense.description}</p>
            <p className="text-[13px] font-medium text-slate-500">
              {getCategoryLabel(expense.category)} - {getPaymentMethodLabel(expense.paymentMethod)}
            </p>
          </div>
        </div>
        <p className="ml-3 shrink-0 text-[15px] font-bold">{formatCurrency(expense.amount)}</p>
      </div>
    </li>
  );
}

const DailySummary = forwardRef(function DailySummary({ total, count, topCategory, topExpense }, ref) {
  return (
    <section ref={ref} className="mb-3 scroll-mt-4 rounded-2xl bg-slate-950 p-4 text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-400">Resumen</p>
          <p className="mt-1 text-3xl font-black leading-none">{formatCurrency(total)}</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">
          {count} {count === 1 ? "gasto" : "gastos"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <StatPill label="Categoria top" value={topCategory ? getCategoryLabel(topCategory.category) : "Sin datos"} />
        <StatPill label="Mayor gasto" value={topExpense ? formatCurrency(topExpense.amount) : "$0"} />
      </div>
    </section>
  );
});

function StatPill({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className="truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function CategorySummary({ items, selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {items.map((item) => (
        <button
          type="button"
          onClick={() => onSelect(item.category)}
          key={item.category}
          className={[
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm transition active:scale-95",
            selected === item.category
              ? "border-[#0066ff] bg-[#0066ff] text-white"
              : "border-slate-100 bg-white text-slate-600"
          ].join(" ")}
        >
          {getCategoryLabel(item.category)} {formatCurrency(item.total)}
        </button>
      ))}
    </div>
  );
}
