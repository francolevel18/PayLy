import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { groupByDay, groupByHour, groupByMonth } from "../../lib/timelineGroups";
import { getMapsUrl } from "../../lib/locationCapture";
import AnalysisWheel from "./AnalysisWheel";
import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";

const filters = [
  { key: "hour", label: "Hora" },
  { key: "day", label: "Dia" },
  { key: "month", label: "Mes" },
  { key: "analysis", label: "Analisis" }
];

export default function Timeline({ actions, expenses, filters, onClose, onEditExpense, subtitle = "Timeline", title = "Movimientos" }) {
  const [activeFilter, setActiveFilter] = useState("hour");
  const firstItemRef = useRef(null);
  const filteredExpenses = useMemo(() => filterExpenses(expenses, filters), [expenses, filters]);
  const groups = useMemo(() => getTimelineGroups(filteredExpenses, activeFilter), [filteredExpenses, activeFilter]);

  useEffect(() => {
    if (activeFilter !== "analysis") {
      firstItemRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [activeFilter]);

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7fb]">
      <section className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-28 pt-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">{subtitle}</p>
            <h2 className="text-2xl font-black text-slate-950">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-black text-slate-500 shadow-sm"
              aria-label="Cerrar"
            >
              x
            </button>
          </div>
        </div>

        <SegmentedControl value={activeFilter} onChange={setActiveFilter} />

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {activeFilter === "analysis" ? (
            <AnalysisWheel expenses={filteredExpenses} embedded />
          ) : groups.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm font-semibold text-slate-500">
              Todavia no hay gastos para mostrar.
            </p>
          ) : (
            <ol className="relative ml-3 border-l-2 border-slate-200 pb-4">
              {groups.map((group, index) => (
                <TimelineGroup
                  key={group.key}
                  ref={index === 0 ? firstItemRef : null}
                  group={group}
                  mode={activeFilter}
                  onEditExpense={onEditExpense}
                />
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}

function SegmentedControl({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 rounded-2xl bg-white p-1 shadow-sm">
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onChange(filter.key)}
          className={[
            "h-11 rounded-xl text-sm font-black transition active:scale-95",
            value === filter.key ? "bg-slate-950 text-white shadow-sm" : "text-slate-400"
          ].join(" ")}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

const TimelineGroup = forwardRef(function TimelineGroup({ group, mode, onEditExpense }, ref) {
  return (
    <li ref={ref} className="relative mb-4 pl-5">
      <span className="absolute -left-[7px] top-2 h-3 w-3 rounded-full border-2 border-[#f5f7fb] bg-[#0066ff]" />
      <section className="rounded-2xl bg-white p-4 shadow-sm transition">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-slate-400">{group.label}</p>
            <h3 className="mt-1 text-lg font-black text-slate-950">{formatCurrency(group.total)}</h3>
          </div>
          <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-500">
            {group.count} {group.count === 1 ? "gasto" : "gastos"}
          </span>
        </div>

        {mode === "month" ? null : (
          <ul className="space-y-2">
            {group.expenses.map((expense) => (
              <li key={expense.id} className="animate-quickIn rounded-xl transition-transform active:scale-[0.99]">
                <button
                  type="button"
                  onClick={() => onEditExpense?.(expense)}
                  className="motion-fast flex w-full items-center justify-between gap-3 rounded-xl text-left transition-transform active:scale-[0.98]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-800">{expense.description}</p>
                    <p className="text-xs font-semibold text-slate-400">
                      {formatTime(expense.createdAt)} - {getCategoryLabel(expense.category)} - {getPaymentMethodLabel(expense.paymentMethod)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black text-slate-950">{formatCurrency(expense.amount)}</p>
                </button>
                {expense.location && (
                  <a
                    href={getMapsUrl(expense.location)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate pl-0 text-xs font-black text-[#0066ff]"
                  >
                    {expense.location.place?.name || "Ver ubicacion guardada"}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </li>
  );
});

function getTimelineGroups(expenses, filter) {
  if (filter === "hour") {
    return groupByHour(expenses);
  }
  if (filter === "month") {
    return groupByMonth(expenses);
  }

  return groupByDay(expenses);
}

function filterExpenses(expenses, filters) {
  if (!filters) {
    return expenses;
  }

  return expenses.filter((expense) => {
    if (filters.paymentMethod && expense.paymentMethod !== filters.paymentMethod) {
      return false;
    }
    if (filters.creditCardId && expense.creditCardId !== filters.creditCardId) {
      return false;
    }
    return true;
  });
}

function formatTime(value) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
