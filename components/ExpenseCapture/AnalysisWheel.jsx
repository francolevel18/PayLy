import { useEffect, useMemo, useState } from "react";
import { formatAutoInsight, loadRemoteAutoInsights } from "../../lib/autoInsights";
import { defaultBudgets, getCurrentBudgetMonth, loadBudgets } from "../../lib/budgetsRepository";
import { computeFinancialRadarState } from "../../lib/financialRadar";
import {
  buildFutureInstallmentSchedule,
  loadRemoteFutureInstallments,
  summarizeNextMonthInstallments
} from "../../lib/futureInstallments";
import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";

const categoryMeta = {
  food: { icon: "CO", tone: "border-[#0066ff] text-[#0052cc] shadow-[0_0_28px_rgba(0,102,255,0.18)]" },
  transport: { icon: "TR", tone: "border-slate-200 text-slate-600" },
  market: { icon: "SU", tone: "border-slate-200 text-slate-600" },
  health: { icon: "SA", tone: "border-slate-200 text-slate-600" },
  services: { icon: "SE", tone: "border-slate-200 text-slate-600" },
  other: { icon: "OT", tone: "border-orange-300 bg-orange-50 text-orange-700 shadow-[0_0_24px_rgba(249,115,22,0.14)]" },
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

export default function AnalysisWheel({ creditCards = [], expenses, onClose, onConfigureIncome, profile, embedded = false }) {
  const [activePeriod, setActivePeriod] = useState("current");
  const [customDraft, setCustomDraft] = useState(() => getDefaultCustomRange());
  const [customRange, setCustomRange] = useState(() => getDefaultCustomRange());
  const [customError, setCustomError] = useState("");
  const [isCustomSheetOpen, setIsCustomSheetOpen] = useState(false);
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [budgets, setBudgets] = useState(defaultBudgets);
  const [budgetSource, setBudgetSource] = useState("default");
  const [remoteInstallmentRows, setRemoteInstallmentRows] = useState([]);
  const [remoteAutoInsights, setRemoteAutoInsights] = useState([]);

  const monthlyIncome = Number(profile?.monthlyIncome) || 0;
  const current = useMemo(() => analyzeCurrentMonth(expenses), [expenses]);
  const previous = useMemo(() => analyzeMonth(expenses, -1), [expenses]);
  const custom = useMemo(() => analyzeRange(expenses, customRange.from, customRange.to), [expenses, customRange]);
  const selected = activePeriod === "custom" ? custom : current;
  const isCustom = activePeriod === "custom";
  const nodes = buildNodes(selected.categories);
  const selectedCategory = nodes.find((node) => node.total > 0) || nodes[0];
  const percentChange = getPercentChange(selected.total, previous.total);
  const budgetRows = buildBudgetRows(selected.categories, budgets);
  const monthlyBudget = budgetSource === "default" ? 0 : getMonthlyBudgetTotal(budgets);
  const localInstallmentSchedule = useMemo(() => buildFutureInstallmentSchedule(expenses), [expenses]);
  const installmentSchedule = useMemo(
    () => (remoteInstallmentRows.length > 0 ? mergeInstallmentSchedules(localInstallmentSchedule, remoteInstallmentRows) : localInstallmentSchedule),
    [localInstallmentSchedule, remoteInstallmentRows]
  );
  const installmentsWall = useMemo(
    () => buildInstallmentsWall(installmentSchedule, monthlyIncome, creditCards),
    [creditCards, installmentSchedule, monthlyIncome]
  );
  const localInsights = getInsights(selected, previous, { isCustom, monthlyIncome });
  const remoteInsightMessages = useMemo(
    () => remoteAutoInsights.map(formatAutoInsight).filter(Boolean),
    [remoteAutoInsights]
  );
  const insights = !isCustom && remoteInsightMessages.length > 0 ? remoteInsightMessages : localInsights;
  const visibleInsights = showAllInsights ? insights : insights.slice(0, 3);
  const oxygen = !isCustom && monthlyIncome > 0 ? getOxygenDay(current, monthlyIncome) : null;
  const radarState = useMemo(
    () =>
      computeFinancialRadarState({
        currentSpent: current.total,
        monthlyBudget,
        monthlyIncome,
        nextMonthInstallments: installmentsWall.nextMonthInstallmentsTotal,
        projectedTotal: current.projectedTotal
      }),
    [current.projectedTotal, current.total, installmentsWall.nextMonthInstallmentsTotal, monthlyBudget, monthlyIncome]
  );

  useEffect(() => {
    let isCancelled = false;

    loadBudgets(getCurrentBudgetMonth()).then((result) => {
      if (!isCancelled) {
        setBudgets(result.budgets);
        setBudgetSource(result.source);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    loadRemoteFutureInstallments(6).then((result) => {
      if (!isCancelled) {
        setRemoteInstallmentRows(result.rows);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    loadRemoteAutoInsights().then((result) => {
      if (!isCancelled) {
        setRemoteAutoInsights(result.insights);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  function openCustomSheet() {
    setCustomDraft(customRange);
    setCustomError("");
    setIsCustomSheetOpen(true);
  }

  function applyCustomRange() {
    const validation = validateCustomRange(customDraft);
    if (validation) {
      setCustomError(validation);
      return;
    }

    setCustomRange(customDraft);
    setActivePeriod("custom");
    setShowAllInsights(false);
    setCustomError("");
    setIsCustomSheetOpen(false);
  }

  const content = (
    <main className="flex flex-col px-1 pt-3">
      <PeriodControl
        value={activePeriod}
        onCurrent={() => {
          setActivePeriod("current");
          setShowAllInsights(false);
        }}
        onCustom={openCustomSheet}
      />

      <RadarHero
        analysis={selected}
        current={current}
        isCustom={isCustom}
        isPrivate={isPrivate}
        monthlyBudget={monthlyBudget}
        monthlyIncome={monthlyIncome}
        onConfigureIncome={onConfigureIncome}
        onTogglePrivacy={() => setIsPrivate((currentValue) => !currentValue)}
        radarState={radarState}
        nextMonthInstallmentsTotal={installmentsWall.nextMonthInstallmentsTotal}
      />

      <section className="mt-3 grid grid-cols-2 gap-2">
        <MetricCard label="Promedio diario" value={maskAmount(formatCurrency(selected.dailyAverage), isPrivate)} detail={isCustom ? "en el periodo" : "este mes"} />
        <MetricCard label="Proyeccion cierre" value={isCustom ? "Periodo" : maskAmount(formatCurrency(selected.projectedTotal), isPrivate)} detail={isCustom ? `${selected.count} movimientos` : "si seguis asi"} />
        <MetricCard
          label="Categoria principal"
          value={selected.topCategory ? getCategoryLabel(selected.topCategory.category) : "Sin datos"}
          detail={selected.topCategory ? `${selected.topCategory.share}% del total` : "todavia"}
        />
        <MetricCard
          label="Mayor gasto"
          value={selected.topExpense ? maskAmount(formatCurrency(selected.topExpense.amount), isPrivate) : "$0"}
          detail={selected.topExpense?.description || "sin gastos"}
        />
      </section>

      <CategoryOrbit analysis={selected} isPrivate={isPrivate} nodes={nodes} percentChange={percentChange} selectedCategory={selectedCategory} />

      <InsightsBlock
        insights={visibleInsights}
        hasMore={insights.length > 3 && !showAllInsights}
        onShowMore={() => setShowAllInsights(true)}
      />

      {oxygen ? <OxygenBlock oxygen={oxygen} /> : null}
      {installmentsWall.installmentsCount > 0 ? <InstallmentsBlock installmentsWall={installmentsWall} isPrivate={isPrivate} /> : null}

      <PaymentMethodsBlock methods={selected.paymentMethods} total={selected.total} isPrivate={isPrivate} />
      <BudgetLimitsBlock rows={budgetRows} isPrivate={isPrivate} />
    </main>
  );

  if (embedded) {
    return <section className="rounded-[1.75rem] bg-[#faf8ff] px-3 pb-6 pt-2 text-slate-950">{content}</section>;
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[#f5f7fb] text-slate-950">
      <section className="mx-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition active:scale-95"
            aria-label="Cerrar radar de gastos"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <h2 className="text-xl font-black text-[#0052cc]">Radar de gastos</h2>
          <span className="h-10 w-10" aria-hidden="true" />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
          {content}
        </div>
      </section>
      {isCustomSheetOpen ? (
        <CustomRangeSheet
          draft={customDraft}
          error={customError}
          onApply={applyCustomRange}
          onChange={setCustomDraft}
          onClose={() => setIsCustomSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}

function PeriodControl({ value, onCurrent, onCustom }) {
  return (
    <div className="grid grid-cols-2 rounded-full border border-slate-200 bg-[#eaf1ff] p-1 shadow-inner">
      <button
        type="button"
        onClick={onCurrent}
        className={["h-11 rounded-full text-sm font-black transition active:scale-95", value === "current" ? "bg-white text-[#0052cc] shadow-sm" : "text-slate-500"].join(" ")}
      >
        Este mes
      </button>
      <button
        type="button"
        onClick={onCustom}
        className={["h-11 rounded-full text-sm font-black transition active:scale-95", value === "custom" ? "bg-white text-[#0052cc] shadow-sm" : "text-slate-500"].join(" ")}
      >
        Personalizado
      </button>
    </div>
  );
}

function RadarHero({ analysis, current, isCustom, isPrivate, monthlyBudget, monthlyIncome, nextMonthInstallmentsTotal, onConfigureIncome, onTogglePrivacy, radarState }) {
  const consumedPercent = isCustom ? "No aplica" : formatSharePercent(radarState.currentRatio);
  const realAvailableBalance = monthlyIncome > 0 ? monthlyIncome - current.total - nextMonthInstallmentsTotal : 0;
  const referenceValue = radarState.referenceAmount > 0 ? formatCurrency(radarState.referenceAmount) : "Configurar";

  if (monthlyIncome <= 0 && !isCustom) {
    return (
      <section className="mt-4 rounded-[1.7rem] border border-blue-100 bg-white p-5 shadow-[0_18px_46px_rgba(15,23,42,0.08)]">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xl font-black text-slate-950">Radar financiero</p>
            <p className="mt-1 text-sm font-bold leading-5 text-slate-500">
              Configura tu ingreso estimado para afinar la lectura del mes.
            </p>
          </div>
          <button
            type="button"
            onClick={onTogglePrivacy}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-sm font-black text-slate-500"
            aria-label={isPrivate ? "Mostrar montos" : "Ocultar montos"}
          >
            {isPrivate ? "Ver" : "Priv"}
          </button>
        </div>
        <p className="mb-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold leading-5 text-slate-500">
          {monthlyBudget > 0
            ? `Mientras tanto, Payly usa tus presupuestos como referencia: ${formatCurrency(monthlyBudget)}.`
            : "Mientras tanto, Payly muestra el gasto y la proyeccion sin bloquear el Radar."}
        </p>
        <button
          type="button"
          onClick={onConfigureIncome}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#0066ff] text-sm font-black text-white shadow-[0_14px_30px_rgba(0,102,255,0.22)] transition active:scale-[0.98]"
        >
          Configurar ingreso
        </button>
      </section>
    );
  }

  return (
    <section className="mt-4 overflow-hidden rounded-[1.7rem] bg-slate-950 p-5 text-white shadow-[0_22px_52px_rgba(15,23,42,0.22)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white/55">Radar financiero</p>
          <h3 className="mt-1 text-2xl font-black">{isCustom ? "Analisis del periodo" : radarState.label}</h3>
        </div>
        <button
          type="button"
          onClick={onTogglePrivacy}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white transition active:scale-95"
          aria-label={isPrivate ? "Mostrar montos" : "Ocultar montos"}
        >
          {isPrivate ? "Ver" : "Priv"}
        </button>
      </div>
      <p className="mt-3 text-sm font-semibold leading-5 text-white/70">
        {isCustom ? "Lectura simple del rango elegido, sin proyeccion mensual fuerte." : radarState.message}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <HeroStat label="Total gastado" value={maskAmount(formatCurrency(analysis.total), isPrivate)} />
        <HeroStat label={isCustom ? "Promedio por gasto" : radarState.referenceLabel} value={isCustom ? maskAmount(formatCurrency(analysis.averageExpense), isPrivate) : maskAmount(referenceValue, isPrivate)} />
        <HeroStat label={radarState.referenceKind === "budget" ? "Presupuesto usado" : "Ingreso consumido"} value={consumedPercent} />
        <HeroStat label="Proyeccion" value={isCustom ? "No aplica" : maskAmount(formatCurrency(current.projectedTotal), isPrivate)} />
      </div>
      {!isCustom && monthlyIncome > 0 ? (
        <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-white/8 px-3 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase text-white/45">Saldo real estimado</p>
            <p className="mt-1 text-lg font-black text-white">{maskAmount(formatCurrency(realAvailableBalance), isPrivate)}</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/80">
            incluye cuotas
          </span>
        </div>
      ) : null}
      {!isCustom ? <p className="mt-4 text-sm font-bold leading-5 text-white/72">{radarState.action}</p> : null}
    </section>
  );
}

function HeroStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/8 px-3 py-3">
      <p className="text-[11px] font-black uppercase text-white/45">{label}</p>
      <p className="mt-1 truncate text-base font-black text-white">{value}</p>
    </div>
  );
}

function MetricCard({ label, value, detail }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 truncate text-base font-black text-slate-950">{value}</p>
      <p className="mt-1 truncate text-xs font-bold text-slate-500">{detail}</p>
    </div>
  );
}

function CategoryOrbit({ analysis, isPrivate, nodes, percentChange, selectedCategory }) {
  return (
    <section className="relative mx-auto mt-8 aspect-square w-[86%]">
      <div className="absolute left-1/2 top-1/2 h-[68%] w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-slate-200" />
      <div className="absolute left-1/2 top-1/2 z-10 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-white bg-[#1f7aff] text-center text-white shadow-[0_14px_32px_rgba(0,102,255,0.18)] transition active:scale-95">
        <span className="text-xs font-bold uppercase text-white/75">Categorias</span>
        <strong className="mt-2 text-[24px] font-black leading-none">{maskAmount(formatCurrency(analysis.total), isPrivate)}</strong>
        <span className="mt-2 rounded-full bg-white/18 px-2.5 py-1 text-[11px] font-black">
          {formatPercent(percentChange)} vs mes anterior
        </span>
      </div>
      {nodes.map((node, index) => (
        <CategoryNode key={node.category} node={node} position={nodePositions[index]} selected={node.category === selectedCategory.category} />
      ))}
    </section>
  );
}

function CategoryNode({ node, position, selected }) {
  const meta = categoryMeta[node.category] || categoryMeta.other;
  const size = selected ? "h-20 w-20" : "h-16 w-16";

  return (
    <div className={["absolute z-20", position].join(" ")}>
      <button
        type="button"
        className={["flex flex-col items-center justify-center rounded-full border bg-white text-center shadow-md transition active:scale-90", size, selected ? meta.tone : "border-slate-200 text-slate-600"].join(" ")}
      >
        <span className={selected ? "text-lg font-black" : "text-sm font-black"}>{meta.icon}</span>
        <span className="mt-1 max-w-[62px] truncate text-[10px] font-black">{getCategoryLabel(node.category)}</span>
      </button>
    </div>
  );
}

function InsightsBlock({ hasMore, insights, onShowMore }) {
  return (
    <section className="mt-8 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eaf1ff] text-[#0052cc]">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.3" d="M4 17l5-5 4 4 7-8M16 8h4v4" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black">Insights</h3>
          <ul className="mt-2 space-y-2">
            {insights.map((insight) => (
              <li key={insight} className="text-sm font-semibold leading-5 text-slate-600">
                {insight}
              </li>
            ))}
          </ul>
          {hasMore ? (
            <button type="button" onClick={onShowMore} className="mt-3 text-sm font-black text-[#0052cc]">
              Ver mas
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function InstallmentsBlock({ installmentsWall, isPrivate }) {
  const statusTone = {
    normal: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    critical: "bg-red-50 text-red-600"
  }[installmentsWall.status];

  return (
    <section className="mt-4 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black">Cuotas proximas</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">
            {isPrivate ? getPrivateInstallmentsMessage(installmentsWall) : installmentsWall.message}
          </p>
        </div>
        <span className={["shrink-0 rounded-full px-3 py-1 text-xs font-black", statusTone].join(" ")}>
          {installmentsWall.incomeImpactPercentage ? `${installmentsWall.incomeImpactPercentage}%` : "Sin ingreso"}
        </span>
      </div>
      <div className="rounded-2xl bg-slate-50 px-4 py-3">
        <p className="text-[11px] font-black uppercase text-slate-400">Mes proximo</p>
        <p className="mt-1 text-xl font-black text-slate-950">
          {maskAmount(formatCurrency(installmentsWall.nextMonthInstallmentsTotal), isPrivate)} comprometidos
        </p>
        <p className="mt-1 text-xs font-bold text-slate-500">
          {installmentsWall.installmentsCount} cuotas activas
          {installmentsWall.affectedCards.length > 0 ? ` · ${installmentsWall.affectedCards.join(", ")}` : ""}
        </p>
      </div>
    </section>
  );
}

function OxygenBlock({ oxygen }) {
  return (
    <section className="mt-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-lg font-black">Dia de oxigeno</p>
      <p className="mt-2 text-sm font-semibold leading-5 text-slate-600">{oxygen.message}</p>
    </section>
  );
}

function PaymentMethodsBlock({ isPrivate, methods, total }) {
  return (
    <section className="mt-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-black">Medios de pago</h3>
      {methods.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500">Todavia no hay medios para analizar.</p>
      ) : (
        <div className="space-y-3">
          {methods.map((method) => (
            <PaymentMethodRow key={method.paymentMethod} method={method} total={total} isPrivate={isPrivate} />
          ))}
        </div>
      )}
    </section>
  );
}

function PaymentMethodRow({ isPrivate, method, total }) {
  const percent = total > 0 ? Math.round((method.total / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-black text-slate-800">{getPaymentMethodLabel(method.paymentMethod)}</span>
        <span className="font-black text-slate-950">{maskAmount(formatCurrency(method.total), isPrivate)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eaf1ff]">
          <div className="h-full rounded-full bg-[#0066ff]" style={{ width: `${Math.max(percent, 5)}%` }} />
        </div>
        <span className="w-12 text-right text-xs font-black text-slate-500">{percent}%</span>
      </div>
    </div>
  );
}

function BudgetLimitsBlock({ isPrivate, rows }) {
  return (
    <section className="mt-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-black">Limites de presupuesto</h3>
      {rows.length === 0 ? (
        <p className="text-sm font-semibold text-slate-500">Carga gastos este mes para ver limites sugeridos.</p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <BudgetRow key={row.category} row={row} isPrivate={isPrivate} />
          ))}
        </div>
      )}
    </section>
  );
}

function BudgetRow({ isPrivate, row }) {
  const isOver = row.total > row.limit;
  const percent = row.limit > 0 ? Math.min((row.total / row.limit) * 100, 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm font-black">
        <span>{getCategoryLabel(row.category)}</span>
        <span className={isOver ? "text-red-600" : "text-[#0052cc]"}>
          {maskAmount(formatCurrency(row.total), isPrivate)} / {maskAmount(formatCurrency(row.limit), isPrivate)}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#eaf1ff]">
        <div className={["h-full rounded-full", isOver ? "bg-orange-500" : "bg-[#0066ff]"].join(" ")} style={{ width: `${Math.max(percent, 5)}%` }} />
      </div>
    </div>
  );
}

function CustomRangeSheet({ draft, error, onApply, onChange, onClose }) {
  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar rango personalizado" />
      <section className="payly-bottom-sheet absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[2rem] bg-[#f5f7fb] px-4 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Personalizado</p>
            <h3 className="text-2xl font-black">Elegir periodo</h3>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-black text-slate-500 shadow-sm" aria-label="Cerrar">
            x
          </button>
        </div>
        <p className="mb-3 rounded-2xl bg-blue-50 px-4 py-3 text-xs font-bold leading-5 text-[#0052cc]">
          Para cuidar el rendimiento, el periodo maximo es de 90 dias.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <DateField label="Desde" value={draft.from} onChange={(value) => onChange({ ...draft, from: value })} />
          <DateField label="Hasta" value={draft.to} onChange={(value) => onChange({ ...draft, to: value })} />
        </div>
        {error ? <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p> : null}
        <button type="button" onClick={onApply} className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-[#0066ff] text-sm font-black text-white shadow-[0_14px_30px_rgba(0,102,255,0.22)] transition active:scale-[0.98]">
          Aplicar
        </button>
      </section>
    </div>
  );
}

function DateField({ label, onChange, value }) {
  return (
    <label className="block rounded-2xl bg-white p-3 shadow-sm">
      <span className="mb-2 block text-xs font-black uppercase text-slate-400">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl bg-slate-50 px-3 text-sm font-black text-slate-950 outline-none focus:ring-2 focus:ring-blue-100" />
    </label>
  );
}

function analyzeCurrentMonth(expenses) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthLength = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return analyzeExpenses(expenses, start, end, Math.max(now.getDate(), 1), monthLength);
}

function analyzeMonth(expenses, offset) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  const monthLength = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  return analyzeExpenses(expenses, start, end, monthLength, monthLength);
}

function analyzeRange(expenses, fromValue, toValue) {
  const start = parseDateInput(fromValue);
  const end = parseDateInput(toValue);
  end.setDate(end.getDate() + 1);
  const elapsedDays = Math.max(1, Math.ceil((end - start) / dayMs));
  return analyzeExpenses(expenses, start, end, elapsedDays, elapsedDays);
}

function analyzeExpenses(expenses, start, end, elapsedDays, projectedDays) {
  const categories = new Map();
  const paymentMethods = new Map();
  let total = 0;
  let topExpense = null;
  let count = 0;

  for (const expense of expenses) {
    const date = getExpenseDate(expense);
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
    projectedTotal: roundToThousand(dailyAverage * projectedDays),
    topCategory,
    topExpense,
    categories: sortedCategories,
    paymentMethods: [...paymentMethods.values()].sort((a, b) => b.total - a.total)
  };
}

const dayMs = 24 * 60 * 60 * 1000;

function buildNodes(categories) {
  const byCategory = new Map(categories.map((item) => [item.category, item.total]));
  const ranked = [...categories.map((item) => item.category), ...fallbackCategories]
    .filter((category, index, all) => all.indexOf(category) === index)
    .slice(0, 6);

  return ranked.map((category) => ({ category, total: byCategory.get(category) || 0 }));
}

function buildBudgetRows(categories, budgets = defaultBudgets) {
  return categories.slice(0, 4).map((item) => ({
    ...item,
    limit: budgets[item.category] || roundToThousand(Math.max(12000, item.total * 1.1))
  }));
}

function getInsights(current, previous, { isCustom }) {
  if (current.total === 0 && previous.total === 0) {
    return ["Cuando cargues gastos, Payly va a detectar tus patrones del periodo."];
  }

  const insights = [];
  if (current.topCategory) {
    insights.push(`${getCategoryLabel(current.topCategory.category)} concentra el ${current.topCategory.share}% del gasto.`);
  }

  if (current.topExpense) {
    insights.push(`Tu mayor gasto fue ${current.topExpense.description}: ${formatCurrency(current.topExpense.amount)}.`);
  }

  if (!isCustom && current.projectedTotal > current.total && current.count > 0) {
    insights.push(`A este ritmo cerrarias el mes cerca de ${formatCurrency(current.projectedTotal)}.`);
  } else if (previous.total > 0) {
    insights.push(`Vas ${formatPercent(getPercentChange(current.total, previous.total))} contra el mes anterior.`);
  }

  const topPaymentMethod = current.paymentMethods[0];
  if (topPaymentMethod) {
    insights.push(`${getPaymentMethodLabel(topPaymentMethod.paymentMethod)} es el medio con mas peso en este periodo.`);
  }

  return insights;
}

function buildInstallmentsWall(schedule, monthlyIncome, creditCards = []) {
  const summary = summarizeNextMonthInstallments(schedule, monthlyIncome, creditCards);
  const amountText = formatCurrency(summary.nextMonthInstallmentsTotal);
  const message =
    monthlyIncome <= 0
      ? `El mes que viene arrancas con ${amountText} comprometidos en cuotas.`
      : summary.status === "critical"
        ? `Atencion: el mes que viene ya arranca con ${amountText} comprometidos en cuotas (${summary.incomeImpactPercentage}% de tu ingreso).`
        : summary.status === "warning"
          ? `El mes que viene ya tenes ${amountText} comprometidos en cuotas (${summary.incomeImpactPercentage}% de tu ingreso).`
          : `El mes que viene arrancas con ${amountText} comprometidos en cuotas.`;

  return {
    ...summary,
    message,
    schedule
  };
}

function mergeInstallmentSchedules(localSchedule, remoteRows) {
  const rowsByMonth = new Map();

  for (const row of remoteRows) {
    rowsByMonth.set(String(row.month).slice(0, 7), {
      month: row.month,
      committedAmount: Number(row.committedAmount) || 0,
      installmentsCount: 0,
      creditCardIds: []
    });
  }

  for (const row of localSchedule) {
    const key = String(row.month).slice(0, 7);
    if (!rowsByMonth.has(key)) {
      rowsByMonth.set(key, row);
    }
  }

  return [...rowsByMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function getOxygenDay(current, monthlyIncome) {
  if (!current.dailyAverage) {
    return { message: "Con tu ritmo actual, llegas a fin de mes dentro de tu ingreso estimado." };
  }

  const now = new Date();
  const monthLength = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const reachableDay = Math.floor(monthlyIncome / current.dailyAverage);

  if (reachableDay >= monthLength) {
    return { message: "Con tu ritmo actual, llegas a fin de mes dentro de tu ingreso estimado." };
  }

  const neededDaily = monthlyIncome / monthLength;
  const reduction = current.dailyAverage > 0 ? Math.max(0, Math.round((1 - neededDaily / current.dailyAverage) * 100)) : 0;
  return { message: `A este ritmo, llegarias hasta el dia ${Math.max(1, reachableDay)}. Para llegar comodo, reduci un ${reduction}% tu gasto diario.` };
}

function validateCustomRange(range) {
  const from = parseDateInput(range.from);
  const to = parseDateInput(range.to);
  const today = startOfDay(new Date());
  const oldest = new Date(today);
  oldest.setDate(oldest.getDate() - 90);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return "Elegí una fecha desde y una fecha hasta.";
  }
  if (from > to) {
    return "La fecha desde no puede ser posterior a la fecha hasta.";
  }
  if (from < oldest) {
    return "Solo se puede consultar hasta 90 dias hacia atras.";
  }
  if (to > today) {
    return "La fecha hasta no puede ser futura.";
  }

  const rangeDays = Math.ceil((to - from) / dayMs) + 1;
  if (rangeDays > 90) {
    return "El rango maximo permitido es de 90 dias.";
  }
  if (rangeDays < 3) {
    return "Para que el analisis sea util, elegi al menos 3 dias.";
  }

  return "";
}

function getDefaultCustomRange() {
  const to = startOfDay(new Date());
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(to) };
}

function getExpenseDate(expense) {
  return new Date(expense.spentAt || expense.spent_at || expense.createdAt || expense.created_at);
}

function parseDateInput(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function toDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function getPercentChange(current, previous) {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function formatSharePercent(value) {
  if (value > 0 && value < 0.01) {
    return "<1%";
  }

  return `${Math.round(value * 100)}%`;
}

function getMonthlyBudgetTotal(budgets = {}) {
  return Object.values(budgets).reduce((total, amount) => total + Math.max(0, Number(amount) || 0), 0);
}

function formatPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function roundToThousand(value) {
  return Math.max(0, Math.ceil(value / 1000) * 1000);
}

function getPrivateInstallmentsMessage(installmentsWall) {
  if (!installmentsWall.incomeImpactPercentage) {
    return "El mes que viene tenes cuotas comprometidas.";
  }

  if (installmentsWall.status === "critical") {
    return `Atencion: el mes que viene ya arranca con cuotas comprometidas (${installmentsWall.incomeImpactPercentage}% de tu ingreso).`;
  }

  if (installmentsWall.status === "warning") {
    return `El mes que viene ya tenes cuotas comprometidas (${installmentsWall.incomeImpactPercentage}% de tu ingreso).`;
  }

  return "El mes que viene arrancas con cuotas comprometidas.";
}

function maskAmount(value, isPrivate) {
  return isPrivate ? "\u2022\u2022\u2022\u2022" : value;
}
