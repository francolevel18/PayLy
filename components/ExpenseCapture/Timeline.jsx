import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { getMapsUrl } from "../../lib/locationCapture";
import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";

const periodTabs = [
  { key: "today", label: "Hoy" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "custom", label: "Personalizado" }
];

export default function Timeline({ actions, expenses, filters, onClose, onEditExpense, subtitle = "Timeline", title = "Movimientos" }) {
  const [activePeriod, setActivePeriod] = useState("today");
  const [customDraft, setCustomDraft] = useState(() => getDefaultCustomRange());
  const [customRange, setCustomRange] = useState(() => getDefaultCustomRange());
  const [customError, setCustomError] = useState("");
  const firstItemRef = useRef(null);
  const baseExpenses = useMemo(() => filterExpenses(expenses, filters), [expenses, filters]);
  const periodRange = useMemo(() => getPeriodRange(activePeriod, customRange), [activePeriod, customRange]);
  const periodExpenses = useMemo(() => filterByPeriod(baseExpenses, periodRange), [baseExpenses, periodRange]);
  const groups = useMemo(() => getTimelineGroups(periodExpenses, activePeriod), [periodExpenses, activePeriod]);
  const summary = useMemo(() => buildPeriodSummary(periodExpenses, periodRange), [periodExpenses, periodRange]);

  useEffect(() => {
    firstItemRef.current?.scrollIntoView({ block: "nearest" });
  }, [activePeriod, periodRange.from, periodRange.to]);

  function applyCustomRange() {
    const validation = validateCustomRange(customDraft);
    if (validation) {
      setCustomError(validation);
      return;
    }

    setCustomError("");
    setCustomRange(customDraft);
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7fb]">
      <section className="payly-full-panel mx-auto flex w-full max-w-md flex-col px-4 pt-4">
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

        <SegmentedControl value={activePeriod} onChange={setActivePeriod} />
        {activePeriod === "custom" && (
          <CustomRangePicker
            draft={customDraft}
            error={customError}
            onApply={applyCustomRange}
            onChange={setCustomDraft}
          />
        )}

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <PeriodSummary summary={summary} />
          {groups.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm font-semibold text-slate-500">
              Todavia no hay movimientos en este periodo.
            </p>
          ) : (
            <ol className="relative ml-3 mt-4 border-l-2 border-slate-200 pb-4">
              {groups.map((group, index) => (
                <TimelineGroup
                  key={group.key}
                  ref={index === 0 ? firstItemRef : null}
                  group={group}
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
      {periodTabs.map((filter) => (
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

function CustomRangePicker({ draft, error, onApply, onChange }) {
  return (
    <section className="mt-3 animate-quickIn rounded-2xl bg-white p-3 shadow-sm">
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
        <DateField label="Desde" value={draft.from} onChange={(from) => onChange((current) => ({ ...current, from }))} />
        <DateField label="Hasta" value={draft.to} onChange={(to) => onChange((current) => ({ ...current, to }))} />
        <button
          type="button"
          onClick={onApply}
          className="mt-5 h-11 rounded-xl bg-[#0066ff] px-3 text-xs font-black text-white shadow-[0_10px_20px_rgba(0,102,255,0.18)] transition active:scale-95"
        >
          Aplicar
        </button>
      </div>
      {error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600">{error}</p>}
    </section>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-black uppercase text-slate-400">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-100 bg-slate-50 px-2 text-xs font-black text-slate-950 outline-none focus:border-[#0066ff]"
      />
    </label>
  );
}

function PeriodSummary({ summary }) {
  return (
    <section className="mb-3 animate-quickIn rounded-2xl bg-slate-950 p-4 text-white shadow-[0_14px_34px_rgba(15,23,42,0.16)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-400">Total del periodo</p>
          <p className="mt-1 text-2xl font-black leading-none">{formatCurrency(summary.total)}</p>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">
          {summary.count} {summary.count === 1 ? "movimiento" : "movimientos"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SummaryPill label="Categoria top" value={summary.topCategory ? getCategoryLabel(summary.topCategory) : "Sin datos"} />
        <SummaryPill label="Promedio diario" value={formatCurrency(summary.dailyAverage)} />
      </div>
    </section>
  );
}

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className="truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

const TimelineGroup = forwardRef(function TimelineGroup({ group, onEditExpense }, ref) {
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

        <ul className="space-y-2">
          {group.expenses.map((expense) => (
            <TimelineExpense key={expense.id} expense={expense} onEditExpense={onEditExpense} />
          ))}
        </ul>
      </section>
    </li>
  );
});

function TimelineExpense({ expense, onEditExpense }) {
  const locationName = expense.location?.place?.name || expense.metadata?.location_name;

  return (
    <li className="animate-quickIn rounded-xl transition-transform active:scale-[0.99]">
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
      {expense.location ? (
        <a
          href={getMapsUrl(expense.location)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate pl-0 text-xs font-black text-[#0066ff]"
        >
          {locationName || "Ver ubicacion guardada"}
        </a>
      ) : locationName ? (
        <p className="mt-1 truncate pl-0 text-xs font-black text-[#0066ff]">{locationName}</p>
      ) : null}
    </li>
  );
}

function getTimelineGroups(expenses, period) {
  if (period === "today") {
    return buildGroups(expenses, (expense) => {
      const date = new Date(expense.createdAt);
      return {
        key: date.toISOString().slice(0, 13),
        label: `${String(date.getHours()).padStart(2, "0")}:00`
      };
    });
  }

  return buildGroups(expenses, (expense) => {
    const date = new Date(expense.createdAt);
    return {
      key: date.toISOString().slice(0, 10),
      label: formatShortDate(date)
    };
  });
}

function buildGroups(expenses, getGroup) {
  const groups = new Map();
  const sortedExpenses = [...expenses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  for (const expense of sortedExpenses) {
    const groupInfo = getGroup(expense);
    const group = groups.get(groupInfo.key) || {
      key: groupInfo.key,
      label: groupInfo.label,
      total: 0,
      count: 0,
      expenses: []
    };

    group.total += expense.amount;
    group.count += 1;
    group.expenses.push(expense);
    groups.set(groupInfo.key, group);
  }

  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
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

function filterByPeriod(expenses, range) {
  return expenses.filter((expense) => {
    const date = new Date(expense.createdAt);
    return date >= range.from && date <= range.to;
  });
}

function getPeriodRange(period, customRange) {
  const now = new Date();
  if (period === "week") {
    return { from: startOfDay(addDays(now, -6)), to: endOfDay(now) };
  }
  if (period === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  }
  if (period === "custom") {
    return { from: startOfDay(parseDateInput(customRange.from)), to: endOfDay(parseDateInput(customRange.to)) };
  }

  return { from: startOfDay(now), to: endOfDay(now) };
}

function buildPeriodSummary(expenses, range) {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const byCategory = expenses.reduce((result, expense) => {
    result[expense.category] = (result[expense.category] || 0) + expense.amount;
    return result;
  }, {});
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const dayCount = Math.max(1, Math.ceil((endOfDay(range.to) - startOfDay(range.from)) / 86400000) + 1);

  return {
    total,
    count: expenses.length,
    topCategory,
    dailyAverage: total / dayCount
  };
}

function getDefaultCustomRange() {
  const now = new Date();
  return {
    from: formatDateInput(addDays(now, -6)),
    to: formatDateInput(now)
  };
}

function validateCustomRange(range) {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  const today = endOfDay(new Date());
  const minDate = startOfDay(addDays(today, -90));

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return "Elegí una fecha desde y hasta.";
  }
  if (from > to) {
    return "La fecha desde no puede ser mayor a la fecha hasta.";
  }
  if (from < minDate) {
    return "El rango máximo es de 3 meses hacia atrás.";
  }
  if (to > today) {
    return "La fecha hasta no puede ser futura.";
  }
  if (Math.ceil((endOfDay(to) - startOfDay(from)) / 86400000) + 1 > 90) {
    return "El período no puede superar 90 días.";
  }

  return "";
}

function formatTime(value) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

function formatDateInput(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function parseDateInput(value) {
  return new Date(`${value}T00:00:00`);
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
