import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { groupByDay, groupByHour, groupByMonth } from "../../lib/timelineGroups";
import AnalysisWheel from "./AnalysisWheel";
import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";

const filters = [
  { key: "hour", label: "Hora" },
  { key: "day", label: "Dia" },
  { key: "month", label: "Mes" }
];

export default function Timeline({ expenses, onClose }) {
  const [activeFilter, setActiveFilter] = useState("hour");
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const firstItemRef = useRef(null);
  const groups = useMemo(() => getTimelineGroups(expenses, activeFilter), [expenses, activeFilter]);

  useEffect(() => {
    firstItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeFilter]);

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7fb]">
      <section className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-28 pt-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Timeline</p>
            <h2 className="text-2xl font-black text-slate-950">Movimientos</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAnalysisOpen(true)}
              className="flex h-10 items-center justify-center rounded-full bg-[#0066ff] px-4 text-sm font-black text-white shadow-[0_12px_26px_rgba(0,102,255,0.24)] transition active:scale-95"
            >
              Analisis
            </button>
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
          {groups.length === 0 ? (
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
                />
              ))}
            </ol>
          )}
        </div>
      </section>
      {isAnalysisOpen && <AnalysisWheel expenses={expenses} onClose={() => setIsAnalysisOpen(false)} />}
    </div>
  );
}

function SegmentedControl({ value, onChange }) {
  return (
    <div className="grid grid-cols-3 rounded-2xl bg-white p-1 shadow-sm">
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

const TimelineGroup = forwardRef(function TimelineGroup({ group, mode }, ref) {
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
              <li key={expense.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-800">{expense.description}</p>
                  <p className="text-xs font-semibold text-slate-400">
                    {formatTime(expense.createdAt)} - {getCategoryLabel(expense.category)} - {getPaymentMethodLabel(expense.paymentMethod)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-black text-slate-950">{formatCurrency(expense.amount)}</p>
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

function formatTime(value) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
