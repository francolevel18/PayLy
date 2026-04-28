import { forwardRef } from "react";
import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";

const categoryBars = {
  food: "bg-emerald-500",
  health: "bg-rose-500",
  home: "bg-violet-500",
  leisure: "bg-fuchsia-500",
  market: "bg-amber-500",
  other: "bg-slate-400",
  services: "bg-cyan-500",
  transport: "bg-sky-500"
};

const TodaySection = forwardRef(function TodaySection(
  {
    count,
    total,
    insight,
    topExpense,
    categorySummary,
    selectedFilter,
    onFilter,
    onClearFilter,
    expenses,
    swipedExpenseId,
    pointerStart,
    onSwipe,
    onDelete
  },
  ref
) {
  return (
    <section ref={ref} className="mt-7 flex-1 scroll-mt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Hoy</h2>
        <span className="max-w-[72%] rounded-full border border-slate-100 bg-white px-3 py-1 text-right text-sm font-bold text-slate-600 shadow-sm">
          {formatCurrency(total)} en {count} {count === 1 ? "gasto" : "gastos"}
        </span>
      </div>

      {count === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm font-semibold text-slate-500">
          Todavia no cargaste gastos hoy.
        </p>
      ) : (
        <>
          <p className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#0052cc]">
            {insight}
          </p>
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
  );
});

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
              isTop ? "" : categoryBars[expense.category] ?? categoryBars.other
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

export default TodaySection;
