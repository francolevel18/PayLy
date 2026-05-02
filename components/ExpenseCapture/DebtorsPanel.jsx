import { useEffect, useMemo, useState } from "react";
import { createDebt, loadDebts, markDebtAsPaid } from "../../lib/debtsRepository";
import { createDebtor, loadDebtors } from "../../lib/debtorsRepository";
import DebtRegister from "./DebtRegister";
import DebtsTimeline from "./DebtsTimeline";
import { formatCurrency } from "./useExpenseParser";

export default function DebtorsPanel({ onClose }) {
  const [debtors, setDebtors] = useState([]);
  const [debts, setDebts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isCancelled = false;

    async function loadData() {
      setIsLoading(true);
      setError("");
      try {
        const [nextDebtors, nextDebts] = await Promise.all([loadDebtors(), loadDebts()]);
        if (!isCancelled) {
          setDebtors(nextDebtors);
          setDebts(nextDebts);
        }
      } catch (loadError) {
        if (!isCancelled) {
          setError(loadError?.message || "No se pudieron cargar los deudores.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isCancelled = true;
    };
  }, []);

  const pendingDebts = debts.filter((debt) => debt.status === "pending");
  const totalPending = pendingDebts.reduce((total, debt) => total + debt.amount, 0);
  const debtorSummary = useMemo(() => buildDebtorSummary(pendingDebts), [pendingDebts]);

  async function handleCreateDebt(payload) {
    setIsSaving(true);
    setError("");
    try {
      let debtorId = payload.debtorId;
      let debtor = debtors.find((item) => item.id === debtorId) || null;
      if (!debtorId && payload.debtor?.name) {
        debtor = await createDebtor(payload.debtor);
        debtorId = debtor.id;
        setDebtors((current) => [debtor, ...current.filter((item) => item.id !== debtor.id)]);
      }

      const debt = await createDebt({
        debtorId,
        amount: payload.amount,
        description: payload.description,
        dueDate: null
      });
      setDebts((current) => [{ ...debt, debtor: debt.debtor || debtor }, ...current]);
    } catch (createError) {
      setError(createError?.message || "No se pudo guardar la deuda.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkPaid(id) {
    const previousDebt = debts.find((debt) => debt.id === id);
    if (!previousDebt) {
      return;
    }

    setDebts((current) =>
      current.map((debt) => (debt.id === id ? { ...debt, status: "paid", paidAt: new Date().toISOString() } : debt))
    );
    const paidDebt = await markDebtAsPaid(id);
    if (paidDebt) {
      setDebts((current) =>
        current.map((debt) => (debt.id === id ? { ...paidDebt, debtor: paidDebt.debtor || previousDebt.debtor } : debt))
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7fb]">
      <section className="payly-full-panel mx-auto flex w-full max-w-md flex-col px-4 pt-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Payly</p>
            <h2 className="text-2xl font-black text-slate-950">Deudores</h2>
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pb-4 pr-1">
          <section className="rounded-[1.7rem] bg-slate-950 p-4 text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
            <p className="text-xs font-bold text-slate-400">Total a cobrar</p>
            <p className="mt-1 text-4xl font-black leading-none">{formatCurrency(totalPending)}</p>
            <p className="mt-2 text-sm font-semibold text-slate-400">
              {pendingDebts.length} {pendingDebts.length === 1 ? "deuda pendiente" : "deudas pendientes"}
            </p>
          </section>

          {debtorSummary.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {debtorSummary.map((item) => (
                <span key={item.debtorId} className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm">
                  {item.name} · {formatCurrency(item.total)}
                </span>
              ))}
            </div>
          )}

          <DebtRegister debtors={debtors} isSaving={isSaving} onCreate={handleCreateDebt} />

          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}
          {isLoading ? (
            <p className="rounded-2xl bg-white px-4 py-6 text-center text-sm font-bold text-slate-400">Cargando deudores...</p>
          ) : (
            <DebtsTimeline debts={debts} onMarkPaid={handleMarkPaid} />
          )}
        </div>
      </section>
    </div>
  );
}

function buildDebtorSummary(debts) {
  const groups = new Map();
  for (const debt of debts) {
    const key = debt.debtorId;
    const current = groups.get(key) || {
      debtorId: key,
      name: debt.debtor?.name || "Deudor",
      total: 0
    };
    current.total += debt.amount;
    groups.set(key, current);
  }

  return [...groups.values()].sort((a, b) => b.total - a.total);
}
