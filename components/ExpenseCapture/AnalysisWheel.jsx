import { useMemo, useState } from "react";
import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";

const periods = [
  { key: "current", label: "Mes actual", offset: 0 },
  { key: "previous", label: "Mes pasado", offset: -1 }
];

const categoryMeta = {
  food: { icon: "CO", tone: "border-[#0066ff] text-[#0052cc] shadow-[0_0_28px_rgba(0,102,255,0.22)]" },
  transport: { icon: "TR", tone: "border-slate-200 text-slate-600" },
  market: { icon: "SU", tone: "border-slate-200 text-slate-600" },
  health: { icon: "SA", tone: "border-slate-200 text-slate-600" },
  services: { icon: "SE", tone: "border-slate-200 text-slate-600" },
  other: { icon: "OT", tone: "border-orange-400 bg-orange-50 text-orange-700 shadow-[0_0_24px_rgba(249,115,22,0.18)]" },
  home: { icon: "HO", tone: "border-slate-200 text-slate-600" },
  leisure: { icon: "OC", tone: "border-slate-200 text-slate-600" }
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

export default function AnalysisWheel({ expenses, onClose, embedded = false }) {
  const [activePeriod, setActivePeriod] = useState("current");
  const current = useMemo(() => analyzeMonth(expenses, 0), [expenses]);
  const previous = useMemo(() => analyzeMonth(expenses, -1), [expenses]);
  const older = useMemo(() => analyzeMonth(expenses, -2), [expenses]);
  const selected = activePeriod === "previous" ? previous : current;
  const comparison = activePeriod === "previous" ? older : previous;
  const nodes = buildNodes(selected.categories);
  const selectedCategory = nodes.find((node) => node.total > 0) || nodes[0];
  const insights = getInsights(selected, comparison);
  const percentChange = getPercentChange(selected.total, comparison.total);
  const budgetRows = buildBudgetRows(selected.categories);
  const categoryDeltas = buildCategoryDeltas(selected.categories, comparison.categories);

  const content = (
    <main className="flex flex-col px-1 pt-3">
      <PeriodControl value={activePeriod} onChange={setActivePeriod} />

      <section className="mt-4 grid grid-cols-2 gap-2">
        <MetricCard label="Promedio" value={formatCurrency(selected.averageExpense)} detail="por gasto" />
        <MetricCard label="Proyeccion" value={formatCurrency(selected.projectedTotal)} detail="cierre de mes" />
        <MetricCard
          label="Categoria top"
          value={selected.topCategory ? getCategoryLabel(selected.topCategory.category) : "Sin datos"}
          detail={selected.topCategory ? `${selected.topCategory.share}% del total` : "todavia"}
        />
        <MetricCard
          label="Mayor gasto"
          value={selected.topExpense ? formatCurrency(selected.topExpense.amount) : "$0"}
          detail={selected.topExpense?.description || "sin gastos"}
        />
      </section>

      <section className="relative mt-12 aspect-square w-full">
        <div className="absolute left-1/2 top-1/2 h-[72%] w-[72%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-slate-300" />
        <div className="absolute left-1/2 top-1/2 z-10 flex h-44 w-44 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-white bg-[#0066ff] text-center text-white shadow-[0_22px_60px_rgba(0,102,255,0.34)] transition active:scale-95">
          <span className="text-xs font-bold uppercase text-white/75">Gastos totales</span>
          <strong className="mt-2 text-[32px] font-black leading-none">{formatCurrency(selected.total)}</strong>
          <span className="mt-3 rounded-full bg-white/20 px-3 py-1 text-xs font-black">
            {formatPercent(percentChange)} vs periodo anterior
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
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eaedff] text-[#0052cc]">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" d="M4 17l5-5 4 4 7-8M16 8h4v4" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-black">Insights</h3>
            <ul className="mt-2 space-y-2">
              {insights.map((insight) => (
                <li key={insight} className="text-sm font-semibold leading-5 text-slate-600">
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-black">Medios de pago</h3>
        {selected.paymentMethods.length === 0 ? (
          <p className="text-sm font-semibold text-slate-500">Todavia no hay medios para analizar.</p>
        ) : (
          <div className="space-y-3">
            {selected.paymentMethods.map((method) => (
              <PaymentMethodRow key={method.paymentMethod} method={method} total={selected.total} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-black">Variacion por categoria</h3>
        {categoryDeltas.length === 0 ? (
          <p className="text-sm font-semibold text-slate-500">Falta historial para comparar categorias.</p>
        ) : (
          <div className="space-y-3">
            {categoryDeltas.map((item) => (
              <CategoryDeltaRow key={item.category} item={item} />
            ))}
          </div>
        )}
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
  );

  if (embedded) {
    return <section className="rounded-[1.75rem] bg-[#faf8ff] px-3 pb-6 pt-2 text-slate-950">{content}</section>;
  }

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
          <span className="h-10 w-10" aria-hidden="true" />
        </header>
        <div className="px-4 pt-5">{content}</div>
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

function MetricCard({ label, value, detail }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 truncate text-base font-black text-slate-950">{value}</p>
      <p className="mt-1 truncate text-xs font-bold text-slate-500">{detail}</p>
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
        <span className={selected ? "text-xl font-black" : "text-base font-black"}>{meta.icon}</span>
        <span className="mt-1 max-w-[72px] truncate text-[11px] font-black">{getCategoryLabel(node.category)}</span>
        {selected && <span className="mt-0.5 text-[11px] font-bold text-slate-700">{formatCurrency(node.total)}</span>}
      </button>
    </div>
  );
}

function PaymentMethodRow({ method, total }) {
  const percent = total > 0 ? Math.round((method.total / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-black text-slate-800">{getPaymentMethodLabel(method.paymentMethod)}</span>
        <span className="font-black text-slate-950">{formatCurrency(method.total)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eaedff]">
          <div className="h-full rounded-full bg-[#0066ff]" style={{ width: `${Math.max(percent, 5)}%` }} />
        </div>
        <span className="w-12 text-right text-xs font-black text-slate-500">{percent}%</span>
      </div>
    </div>
  );
}

function CategoryDeltaRow({ item }) {
  const isUp = item.delta > 0;
  const isFlat = item.delta === 0;
  const label = isFlat ? "sin cambio" : `${isUp ? "+" : ""}${formatCurrency(item.delta)}`;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-slate-900">{getCategoryLabel(item.category)}</p>
        <p className="text-xs font-bold text-slate-500">{formatPercent(item.percent)} vs periodo anterior</p>
      </div>
      <span className={["shrink-0 text-sm font-black", isUp ? "text-red-600" : "text-emerald-600"].join(" ")}>
        {label}
      </span>
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
  const monthLength = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const elapsedDays = offset === 0 ? Math.max(now.getDate(), 1) : monthLength;
  const categories = new Map();
  const paymentMethods = new Map();
  let total = 0;
  let topExpense = null;
  let count = 0;

  for (const expense of expenses) {
    const date = new Date(expense.createdAt);
    if (date < start || date >= end) {
      continue;
    }

    const category = expense.category || "other";
    const paymentMethod = expense.paymentMethod || "cash";
    const amount = Number(expense.amount) || 0;
    total += amount;
    count += 1;
    topExpense = !topExpense || amount > topExpense.amount ? expense : topExpense;
    categories.set(category, {
      category,
      total: (categories.get(category)?.total || 0) + amount,
      count: (categories.get(category)?.count || 0) + 1
    });
    paymentMethods.set(paymentMethod, {
      paymentMethod,
      total: (paymentMethods.get(paymentMethod)?.total || 0) + amount,
      count: (paymentMethods.get(paymentMethod)?.count || 0) + 1
    });
  }

  const sortedCategories = [...categories.values()].sort((a, b) => b.total - a.total);
  const topCategory = sortedCategories[0]
    ? { ...sortedCategories[0], share: Math.round((sortedCategories[0].total / total) * 100) }
    : null;
  const dailyAverage = elapsedDays > 0 ? total / elapsedDays : 0;

  return {
    total,
    count,
    averageExpense: count > 0 ? total / count : 0,
    dailyAverage,
    projectedTotal: roundToThousand(dailyAverage * monthLength),
    topCategory,
    topExpense,
    categories: sortedCategories,
    paymentMethods: [...paymentMethods.values()].sort((a, b) => b.total - a.total)
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

function buildCategoryDeltas(currentCategories, previousCategories) {
  const previous = new Map(previousCategories.map((item) => [item.category, item.total]));

  return currentCategories
    .map((item) => {
      const previousTotal = previous.get(item.category) || 0;
      return {
        category: item.category,
        total: item.total,
        delta: item.total - previousTotal,
        percent: getPercentChange(item.total, previousTotal)
      };
    })
    .filter((item) => item.total > 0 || item.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 4);
}

function buildBudgetRows(categories) {
  return categories.slice(0, 3).map((item, index) => {
    const multiplier = index === 0 ? 1.15 : 0.9;
    const minimum = index === 0 ? 30000 : 12000;
    const limit = roundToThousand(Math.max(minimum, item.total * multiplier));
    return { ...item, limit };
  });
}

function getInsights(current, previous) {
  if (current.total === 0 && previous.total === 0) {
    return ["Cuando cargues gastos, Payly va a detectar tus patrones del mes."];
  }

  const insights = [];
  const percent = getPercentChange(current.total, previous.total);
  if (previous.total > 0) {
    insights.push(`Vas ${formatPercent(percent)} contra el periodo anterior.`);
  }

  if (current.topCategory) {
    insights.push(`${getCategoryLabel(current.topCategory.category)} concentra el ${current.topCategory.share}% del gasto.`);
  }

  if (current.topExpense) {
    insights.push(`Tu mayor gasto fue ${current.topExpense.description}: ${formatCurrency(current.topExpense.amount)}.`);
  }

  if (current.projectedTotal > current.total && current.count > 0) {
    insights.push(`A este ritmo cerrarias el mes cerca de ${formatCurrency(current.projectedTotal)}.`);
  }

  return insights.slice(0, 4);
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
  return Math.max(0, Math.ceil(value / 1000) * 1000);
}
