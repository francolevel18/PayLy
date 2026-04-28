import { useMemo, useState } from "react";
import { formatCurrency, getCategoryLabel } from "./useExpenseParser";

const periods = [
  { key: "current", label: "Mes actual", offset: 0 },
  { key: "previous", label: "Mes pasado", offset: -1 }
];

const categoryMeta = {
  food: { icon: "🍔", tone: "border-[#0066ff] text-[#0052cc] shadow-[0_0_28px_rgba(0,102,255,0.22)]" },
  transport: { icon: "🚗", tone: "border-slate-200 text-slate-600" },
  market: { icon: "🛒", tone: "border-slate-200 text-slate-600" },
  health: { icon: "🏥", tone: "border-slate-200 text-slate-600" },
  services: { icon: "⚡", tone: "border-slate-200 text-slate-600" },
  other: { icon: "📦", tone: "border-orange-400 bg-orange-50 text-orange-700 shadow-[0_0_24px_rgba(249,115,22,0.18)]" },
  home: { icon: "🏠", tone: "border-slate-200 text-slate-600" },
  leisure: { icon: "🎬", tone: "border-slate-200 text-slate-600" }
};

const nodePositions = [
  "left-1/2 top-0 -translate-x-1/2 -translate-y-3",
  "right-0 top-[22%] translate-x-1",
  "right-0 bottom-[18%] translate-x-1",
  "left-1/2 bottom-0 -translate-x-1/2 translate-y-3",
  "left-0 bottom-[18%] -translate-x-1",
  "left-0 top-[22%] -translate-x-1"
];

const fallbackCategories = ["food", "transport", "market", "health", "services", "other"];

export default function AnalysisWheel({ expenses, onClose }) {
  const [activePeriod, setActivePeriod] = useState("current");
  const current = useMemo(() => analyzeMonth(expenses, 0), [expenses]);
  const previous = useMemo(() => analyzeMonth(expenses, -1), [expenses]);
  const selected = activePeriod === "previous" ? previous : current;
  const comparison = activePeriod === "previous" ? analyzeMonth(expenses, -2) : previous;
  const nodes = buildNodes(selected.categories);
  const selectedCategory = nodes.find((node) => node.total > 0) || nodes[0];
  const insight = getInsight(current, previous);
  const percentChange = getPercentChange(current.total, previous.total);
  const budgetRows = buildBudgetRows(selected.categories);

  return (
    <div className="fixed inset-0 z-[60] bg-[#faf8ff] text-slate-950">
      <section className="mx-auto flex h-full w-full max-w-md flex-col overflow-y-auto pb-8">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition active:scale-95"
            aria-label="Volver al timeline"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <h2 className="text-xl font-black text-[#0052cc]">Analisis</h2>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition active:scale-95"
            aria-label="Notificaciones"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0" />
            </svg>
          </button>
        </header>

        <main className="flex flex-col px-5 pt-8">
          <PeriodControl value={activePeriod} onChange={setActivePeriod} />

          <section className="relative mt-12 aspect-square w-full">
            <div className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-slate-300" />
            <div className="absolute left-1/2 top-1/2 z-10 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-white bg-[#0066ff] text-center text-white shadow-[0_22px_60px_rgba(0,102,255,0.34)] transition active:scale-95">
              <span className="text-xs font-bold uppercase text-white/75">Gastos totales</span>
              <strong className="mt-2 text-[32px] font-black leading-none">{formatCurrency(selected.total)}</strong>
              <span className="mt-3 rounded-full bg-white/20 px-3 py-1 text-xs font-black">
                {formatPercent(activePeriod === "previous" ? getPercentChange(selected.total, comparison.total) : percentChange)} vs mes anterior
              </span>
            </div>

            {nodes.map((node, index) => (
              <CategoryNode
                key={node.category}
                node={node}
                position={nodePositions[index]}
                selected={node.category === selectedCategory.category}
              />
            ))}
          </section>

          <section className="mt-14 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eaedff] text-[#0052cc]">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" d="M4 17l5-5 4 4 7-8M16 8h4v4" />
                </svg>
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-black">Insight Semanal</h3>
                <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">{insight}</p>
              </div>
              <span className="ml-auto text-3xl font-black text-slate-300" aria-hidden="true">
                &gt;
              </span>
            </div>
          </section>

          <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-black">Limites de presupuesto</h3>
              <button type="button" className="text-sm font-black text-[#0052cc]">
                Gestionar
              </button>
            </div>

            {budgetRows.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">Carga gastos este mes para ver limites sugeridos.</p>
            ) : (
              <div className="space-y-4">
                {budgetRows.map((row) => (
                  <BudgetRow key={row.category} row={row} />
                ))}
              </div>
            )}
          </section>
        </main>
      </section>
    </div>
  );
}

function PeriodControl({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 rounded-full border border-slate-200 bg-[#eaedff] p-1 shadow-inner">
      {periods.map((period) => (
        <button
          key={period.key}
          type="button"
          onClick={() => onChange(period.key)}
          className={[
            "h-12 rounded-full text-sm font-black transition active:scale-95",
            value === period.key ? "bg-white text-[#0052cc] shadow-sm" : "text-slate-500"
          ].join(" ")}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

function CategoryNode({ node, position, selected }) {
  const meta = categoryMeta[node.category] || categoryMeta.other;
  const size = selected ? "h-24 w-24" : "h-20 w-20";

  return (
    <div className={["absolute z-20", position].join(" ")}>
      <button
        type="button"
        className={[
          "flex flex-col items-center justify-center rounded-full border bg-white text-center shadow-md transition active:scale-90",
          size,
          selected ? meta.tone : "border-slate-200 text-slate-600"
        ].join(" ")}
      >
        <span className={selected ? "text-3xl" : "text-2xl"}>{meta.icon}</span>
        <span className="mt-1 max-w-[72px] truncate text-[11px] font-black">{getCategoryLabel(node.category)}</span>
        {selected && <span className="mt-0.5 text-[11px] font-bold text-slate-700">{formatCurrency(node.total)}</span>}
      </button>
    </div>
  );
}

function BudgetRow({ row }) {
  const isOver = row.total > row.limit;
  const percent = Math.min((row.total / row.limit) * 100, 100);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black">
        <span>{getCategoryLabel(row.category)}</span>
        <span className={isOver ? "text-red-600" : "text-[#0052cc]"}>
          {formatCurrency(row.total)} / {formatCurrency(row.limit)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#eaedff]">
        <div
          className={["h-full rounded-full", isOver ? "bg-orange-500" : "bg-[#0066ff]"].join(" ")}
          style={{ width: `${Math.max(percent, 5)}%` }}
        />
      </div>
    </div>
  );
}

function analyzeMonth(expenses, offset) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  const categories = new Map();
  let total = 0;

  for (const expense of expenses) {
    const date = new Date(expense.createdAt);
    if (date < start || date >= end) {
      continue;
    }

    const category = expense.category || "other";
    const amount = Number(expense.amount) || 0;
    total += amount;
    categories.set(category, (categories.get(category) || 0) + amount);
  }

  return {
    total,
    categories: [...categories.entries()]
      .map(([category, amount]) => ({ category, total: amount }))
      .sort((a, b) => b.total - a.total)
  };
}

function buildNodes(categories) {
  const byCategory = new Map(categories.map((item) => [item.category, item.total]));
  const ranked = [...categories.map((item) => item.category), ...fallbackCategories]
    .filter((category, index, all) => all.indexOf(category) === index)
    .slice(0, 6);

  return ranked.map((category) => ({
    category,
    total: byCategory.get(category) || 0
  }));
}

function buildBudgetRows(categories) {
  return categories.slice(0, 2).map((item, index) => {
    const multiplier = index === 0 ? 1.15 : 0.9;
    const minimum = index === 0 ? 30000 : 12000;
    const limit = roundToThousand(Math.max(minimum, item.total * multiplier));
    return { ...item, limit };
  });
}

function getInsight(current, previous) {
  if (current.total === 0 && previous.total === 0) {
    return "Cuando cargues gastos, Payly va a detectar tus patrones del mes.";
  }

  const reducedCategory = previous.categories
    .map((oldItem) => {
      const currentItem = current.categories.find((item) => item.category === oldItem.category);
      const currentTotal = currentItem?.total || 0;
      return {
        category: oldItem.category,
        reduction: oldItem.total - currentTotal,
        percent: oldItem.total > 0 ? ((oldItem.total - currentTotal) / oldItem.total) * 100 : 0
      };
    })
    .filter((item) => item.reduction > 0)
    .sort((a, b) => b.reduction - a.reduction)[0];

  if (reducedCategory && reducedCategory.percent >= 5) {
    return `Has reducido tus gastos en ${getCategoryLabel(reducedCategory.category)} un ${Math.round(reducedCategory.percent)}%.`;
  }

  const top = current.categories[0];
  if (top) {
    const share = current.total > 0 ? Math.round((top.total / current.total) * 100) : 0;
    return `${getCategoryLabel(top.category)} concentra el ${share}% de tus gastos este mes.`;
  }

  return "Mes tranquilo por ahora. El timeline se actualiza con cada gasto nuevo.";
}

function getPercentChange(current, previous) {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function formatPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function roundToThousand(value) {
  return Math.max(1000, Math.ceil(value / 1000) * 1000);
}
