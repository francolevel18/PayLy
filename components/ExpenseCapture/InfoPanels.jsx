import { useEffect, useState } from "react";
import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";
import { getSyncStatusLabel } from "./Header";

export function AnalysisPanel({ total, count, topCategory, topExpense, topPaymentMethod, categorySummary, onClose }) {
  const maxCategoryTotal = Math.max(...categorySummary.map((item) => item.total), 1);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar radar de gastos" />
      <section className="payly-bottom-sheet absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[2rem] bg-[#f5f7fb] px-4 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Radar de gastos</p>
            <h2 className="text-2xl font-black">Pulso del dia</h2>
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

        <section className="rounded-2xl bg-slate-950 p-4 text-white shadow-[0_18px_45px_rgba(15,23,42,0.18)]">
          <p className="text-xs font-bold text-slate-400">Total de hoy</p>
          <p className="mt-1 text-4xl font-black leading-none">{formatCurrency(total)}</p>
          <p className="mt-2 text-sm font-semibold text-slate-400">
            {count} {count === 1 ? "gasto registrado" : "gastos registrados"}
          </p>
        </section>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MetricCard label="Categoria top" value={topCategory ? getCategoryLabel(topCategory.category) : "Sin datos"} />
          <MetricCard label="Medio top" value={topPaymentMethod ? getPaymentMethodLabel(topPaymentMethod.paymentMethod) : "Sin datos"} />
          <MetricCard label="Mayor gasto" value={topExpense ? formatCurrency(topExpense.amount) : "$0"} />
          <MetricCard label="Promedio" value={count ? formatCurrency(total / count) : "$0"} />
        </div>

        <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-black text-slate-950">Categorias</h3>
          {categorySummary.length === 0 ? (
            <p className="text-sm font-semibold text-slate-400">Todavia no hay datos para analizar.</p>
          ) : (
            <div className="space-y-3">
              {categorySummary.map((item) => (
                <div key={item.category}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-700">{getCategoryLabel(item.category)}</span>
                    <span className="font-black text-slate-950">{formatCurrency(item.total)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#0066ff]"
                      style={{ width: `${Math.max((item.total / maxCategoryTotal) * 100, 8)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase text-slate-400">{label}</p>
      <p className="mt-1 truncate text-base font-black text-slate-950">{value}</p>
    </div>
  );
}

export function AccountsPanel({ onClose }) {
  const accounts = [
    { name: "Efectivo", detail: "Caja diaria", tone: "bg-emerald-500" },
    { name: "Debito", detail: "Banco principal", tone: "bg-sky-500" },
    { name: "Credito", detail: "Tarjeta personal", tone: "bg-violet-500" },
    { name: "MercadoPago", detail: "Transferencias y QR", tone: "bg-[#0066ff]" }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar cuentas" />
      <section className="payly-bottom-sheet absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[2rem] bg-[#f5f7fb] px-4 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Mis cuentas</p>
            <h2 className="text-2xl font-black">Medios de pago</h2>
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
        <ul className="space-y-2">
          {accounts.map((account) => (
            <li key={account.name} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
              <span className={["h-10 w-1.5 rounded-full", account.tone].join(" ")} />
              <div>
                <p className="font-black text-slate-950">{account.name}</p>
                <p className="text-sm font-semibold text-slate-400">{account.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function UserPanel({ onClose, onMonthlyIncomeChange, onSignOut, profile, profileError, profileSource, syncError, syncStatus, user }) {
  const isSignedIn = Boolean(user);
  const email = user?.email || "Invitado";
  const initial = email.slice(0, 1).toUpperCase();
  const [incomeDraft, setIncomeDraft] = useState(String(profile?.monthlyIncome || ""));
  const monthlyIncome = Number(profile?.monthlyIncome) || 0;

  useEffect(() => {
    setIncomeDraft(String(profile?.monthlyIncome || ""));
  }, [profile?.monthlyIncome]);

  async function handleIncomeSubmit(event) {
    event.preventDefault();
    await onMonthlyIncomeChange?.(incomeDraft);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar usuario" />
      <section className="payly-bottom-sheet absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[2rem] bg-[#f5f7fb] px-4 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Mi usuario</p>
            <h2 className="text-2xl font-black">{isSignedIn ? "Cuenta activa" : "Modo local"}</h2>
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

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0066ff] text-lg font-black text-white">
              {initial}
            </span>
            <div>
              <p className="font-black text-slate-950">{email}</p>
              <p className="text-sm font-semibold text-slate-400">{getSyncStatusLabel(syncStatus)}</p>
            </div>
          </div>

          {syncError && (
            <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
              {syncError}
            </p>
          )}

          <form onSubmit={handleIncomeSubmit} className="mb-3 rounded-2xl bg-slate-50 p-3">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-950">Ingreso estimado</p>
                <p className="text-xs font-bold text-slate-400">
                  {monthlyIncome > 0 ? `${formatCurrency(monthlyIncome)} por mes` : "Activa el Radar financiero completo"}
                </p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-400">
                {profileSource === "remote" ? "Sync" : "Local"}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={incomeDraft}
                onChange={(event) => setIncomeDraft(event.target.value)}
                placeholder="Ej: 650000"
                className="min-w-0 flex-1 rounded-2xl border border-slate-100 bg-white px-4 text-sm font-black text-slate-950 outline-none focus:border-[#0066ff]"
              />
              <button
                type="submit"
                className="h-11 rounded-2xl bg-[#0066ff] px-4 text-sm font-black text-white transition active:scale-[0.98]"
              >
                Guardar
              </button>
            </div>
            <p className="mt-2 text-xs font-semibold leading-4 text-slate-400">
              No vamos a filtrar esta informacion. Solo se usa para darte una mejor lectura.
            </p>
            {profileError ? <p className="mt-2 text-xs font-bold text-red-600">{profileError}</p> : null}
          </form>

          {isSignedIn ? (
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white shadow-[0_14px_30px_rgba(15,23,42,0.18)] transition active:scale-[0.98]"
            >
              Cerrar sesion
            </button>
          ) : (
            <a
              href="/login"
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#0066ff] text-sm font-black text-white shadow-[0_14px_30px_rgba(0,102,255,0.22)] transition active:scale-[0.98]"
            >
              Iniciar sesion
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-slate-50 text-sm font-black text-slate-500 transition active:scale-[0.98]"
          >
            Continuar sin cuenta
          </button>
        </section>
      </section>
    </div>
  );
}
