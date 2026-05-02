import { useEffect, useMemo, useState } from "react";
import { defaultBudgets, getCurrentBudgetMonth, loadBudgets, saveBudget } from "../../lib/budgetsRepository";
import { categories, formatCurrency, getCategoryLabel } from "./useExpenseParser";

const categoryTones = {
  food: { bg: "bg-orange-50", text: "text-orange-600", bar: "bg-orange-500", icon: "M7 3v8M11 3v8M7 7h4M9 11v10M17 3v18M15 3h4" },
  market: { bg: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-500", icon: "M6 8h12l-1 11H7L6 8ZM9 8a3 3 0 0 1 6 0" },
  transport: { bg: "bg-blue-50", text: "text-blue-600", bar: "bg-blue-500", icon: "M5 16h14M7 16l1-7h8l1 7M8 19h.01M16 19h.01" },
  home: { bg: "bg-violet-50", text: "text-violet-600", bar: "bg-violet-500", icon: "M4 11 12 4l8 7M6 10v10h12V10" },
  health: { bg: "bg-rose-50", text: "text-rose-600", bar: "bg-rose-500", icon: "M12 5v14M5 12h14" },
  services: { bg: "bg-sky-50", text: "text-sky-600", bar: "bg-sky-500", icon: "M5 12h14M7 7h10M9 17h6" },
  leisure: { bg: "bg-fuchsia-50", text: "text-fuchsia-600", bar: "bg-fuchsia-500", icon: "M5 8h14v10H5V8ZM8 5l2 3M14 5l2 3" },
  other: { bg: "bg-slate-100", text: "text-slate-600", bar: "bg-slate-500", icon: "M12 6v.01M12 12v.01M12 18v.01" }
};

const statusConfig = {
  controlled: { label: "Controlado", message: "Vas bien este mes", pill: "bg-emerald-50 text-emerald-600" },
  warning: { label: "Atencion", message: "Cuida este gasto", pill: "bg-amber-50 text-amber-600" },
  critical: { label: "Critico", message: "Estas cerca del limite", pill: "bg-orange-50 text-orange-600" },
  exceeded: { label: "Excedido", message: "Presupuesto excedido", pill: "bg-red-50 text-red-600" }
};

export default function BudgetsPanel({ expenses, onClose, onOpenTimeline }) {
  const [budgets, setBudgets] = useState(defaultBudgets);
  const [budgetSource, setBudgetSource] = useState("local");
  const [isPrivate, setIsPrivate] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const periodMonth = getCurrentBudgetMonth();

  useEffect(() => {
    let isCancelled = false;

    loadBudgets(periodMonth).then((result) => {
      if (!isCancelled) {
        setBudgets(result.budgets);
        setBudgetSource(result.source);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [periodMonth]);

  const budgetItems = useMemo(() => buildBudgetItems(expenses, budgets), [expenses, budgets]);
  const totalSpent = budgetItems.reduce((total, item) => total + item.spent, 0);
  const totalBudget = budgetItems.reduce((total, item) => total + item.budget, 0);
  const monthLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date());
  const topRisk = budgetItems.find((item) => item.status === "exceeded" || item.status === "critical");
  const overallPercent = getPercent(totalSpent, totalBudget);

  async function updateBudget(category, amount) {
    const nextBudgets = { ...budgets, [category]: amount };
    setBudgets(nextBudgets);
    setIsSavingBudget(true);
    const result = await saveBudget(category, amount, periodMonth);
    setBudgets(result.budgets);
    setBudgetSource(result.source);
    setIsSavingBudget(false);
    setEditingBudget(null);
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7fb]">
      <section className="payly-full-panel mx-auto flex w-full max-w-md flex-col px-4 pt-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Payly</p>
            <h2 className="text-2xl font-black text-slate-950">Presupuestos</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPrivate((current) => !current)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm transition duration-150 ease-out active:scale-95"
              aria-label={isPrivate ? "Mostrar montos" : "Ocultar montos"}
            >
              {isPrivate ? "••" : "$"}
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

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 pr-1">
          <section className="animate-quickIn rounded-[1.7rem] bg-white p-5 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full" style={{ background: getDonutBackground(overallPercent) }}>
              <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                <p className="text-sm font-bold text-slate-400">Gasto mensual</p>
                <p className="mt-1 text-3xl font-black text-slate-950">{maskAmount(formatCurrency(totalSpent), isPrivate)}</p>
                <p className="mt-1 text-xs font-black text-[#0066ff]">{overallPercent}% usado</p>
              </div>
            </div>
            <p className="mt-4 text-center text-sm font-bold text-slate-500">
              {topRisk ? `${getCategoryLabel(topRisk.category)} necesita atencion` : "Tu mes viene bajo control"}
            </p>
          </section>

          <div className="mt-6 mb-3 flex items-end justify-between gap-3">
            <div>
              <h3 className="text-2xl font-black text-slate-950">Mis Presupuestos</h3>
              <p className="text-sm font-semibold capitalize text-slate-500">
                {monthLabel} · {budgetSource === "remote" ? "Sincronizado" : "Guardado local"}
              </p>
            </div>
            <button type="button" onClick={onOpenTimeline} className="text-sm font-black text-[#0066ff]">
              Ver gastos
            </button>
          </div>

          <div className="space-y-3">
            {budgetItems.map((item) => (
              <BudgetCard
                key={item.category}
                item={item}
                isPrivate={isPrivate}
                onAdjust={() => setEditingBudget(item)}
              />
            ))}
          </div>
        </div>
      </section>

      <BudgetEditSheet
        item={editingBudget}
        isSaving={isSavingBudget}
        onCancel={() => setEditingBudget(null)}
        onSave={updateBudget}
      />
    </div>
  );
}

function BudgetCard({ item, isPrivate, onAdjust }) {
  const tone = categoryTones[item.category] || categoryTones.other;
  const status = statusConfig[item.status];
  const remaining = item.budget - item.spent;

  return (
    <article className="animate-quickIn overflow-hidden rounded-[1.35rem] border border-white bg-white shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className={["flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl", tone.bg, tone.text].join(" ")}>
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d={tone.icon} />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="truncate text-lg font-black text-slate-950">{getCategoryLabel(item.category)}</h4>
                <p className="mt-1 text-xs font-black text-slate-400">{status.message}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-black text-slate-950">{maskAmount(formatCurrency(item.spent), isPrivate)}</p>
                <p className="text-xs font-bold text-slate-400">de {maskAmount(formatCurrency(item.budget), isPrivate)}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={["h-full rounded-full transition-transform duration-150 ease-out", item.status === "exceeded" ? "bg-red-500" : tone.bar].join(" ")}
                  style={{ width: `${Math.min(item.percent, 100)}%` }}
                />
              </div>
              <span className="w-11 text-right text-xs font-black text-slate-950">{item.percent}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-50 px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-slate-700">
            {remaining >= 0
              ? `Quedan ${maskAmount(formatCurrency(remaining), isPrivate)} este mes`
              : `Te pasaste ${maskAmount(formatCurrency(Math.abs(remaining)), isPrivate)}`}
          </p>
          <span className={["rounded-full px-2.5 py-1 text-[11px] font-black", status.pill].join(" ")}>
            {status.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onAdjust}
          className="flex h-11 w-full items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-[0_12px_24px_rgba(15,23,42,0.16)] transition duration-150 ease-out active:scale-[0.98]"
        >
          Ajustar presupuesto
        </button>
      </div>
    </article>
  );
}

function BudgetEditSheet({ isSaving, item, onCancel, onSave }) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    setAmount(item ? String(item.budget) : "");
  }, [item]);

  if (!item) {
    return null;
  }

  const numericAmount = Number(amount);
  const canSave = Number.isFinite(numericAmount) && numericAmount >= 0;

  function submit(event) {
    event.preventDefault();
    if (canSave && !isSaving) {
      onSave(item.category, numericAmount);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onCancel} aria-label="Cancelar presupuesto" />
      <form
        onSubmit={submit}
        className="payly-bottom-sheet absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[2rem] bg-[#f5f7fb] px-4 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Presupuesto</p>
            <h2 className="text-2xl font-black">{getCategoryLabel(item.category)}</h2>
          </div>
          <button type="button" onClick={onCancel} className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-black text-slate-500 shadow-sm" aria-label="Cerrar">
            x
          </button>
        </div>
        <label className="block">
          <span className="mb-2 block text-xs font-black uppercase text-slate-400">Monto mensual</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-base font-black text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
          />
        </label>
        <button
          type="submit"
          disabled={!canSave || isSaving}
          className="mt-4 flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#0066ff] text-sm font-black text-white shadow-[0_14px_30px_rgba(0,102,255,0.22)] transition active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
        >
          {isSaving ? "Guardando..." : "Guardar presupuesto"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-500 shadow-sm transition active:scale-[0.98]"
        >
          Cancelar
        </button>
      </form>
    </div>
  );
}

function buildBudgetItems(expenses, budgets) {
  const monthExpenses = expenses.filter((expense) => isCurrentMonth(expense.createdAt));
  const spentByCategory = monthExpenses.reduce((result, expense) => {
    result[expense.category] = (result[expense.category] || 0) + expense.amount;
    return result;
  }, {});

  return categories
    .map((category) => {
      const spent = spentByCategory[category] || 0;
      const budget = Number(budgets[category]) || 0;
      const percent = getPercent(spent, budget);
      return {
        category,
        spent,
        budget,
        percent,
        status: getStatus(percent)
      };
    })
    .sort((a, b) => getStatusRank(b.status) - getStatusRank(a.status) || b.spent - a.spent);
}

function getStatus(percent) {
  if (percent > 100) {
    return "exceeded";
  }
  if (percent >= 86) {
    return "critical";
  }
  if (percent >= 61) {
    return "warning";
  }
  return "controlled";
}

function getStatusRank(status) {
  return { exceeded: 4, critical: 3, warning: 2, controlled: 1 }[status] || 0;
}

function getPercent(spent, budget) {
  if (!budget) {
    return spent > 0 ? 100 : 0;
  }

  return Math.round((spent / budget) * 100);
}

function getDonutBackground(percent) {
  const safePercent = Math.min(Math.max(percent, 0), 100);
  const color = percent > 100 ? "#ef4444" : percent >= 86 ? "#f97316" : percent >= 61 ? "#f59e0b" : "#0066ff";
  return `conic-gradient(${color} 0 ${safePercent}%, #e9edf5 ${safePercent}% 100%)`;
}

function isCurrentMonth(value) {
  const date = value ? new Date(value) : new Date();
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function maskAmount(value, isPrivate) {
  return isPrivate ? "••••" : value;
}
