import { formatCurrency, getCategoryLabel, getPaymentMethodLabel } from "./useExpenseParser";
import { getSyncStatusLabel } from "./Header";

export function AnalysisPanel({ total, count, topCategory, topExpense, topPaymentMethod, categorySummary, onClose }) {
  const maxCategoryTotal = Math.max(...categorySummary.map((item) => item.total), 1);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar analisis" />
      <section className="absolute inset-x-0 bottom-0 mx-auto max-h-[82vh] max-w-md overflow-y-auto rounded-t-[2rem] bg-[#f5f7fb] px-4 pb-28 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Analisis</p>
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
      <section className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[2rem] bg-[#f5f7fb] px-4 pb-28 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]">
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

export function UserPanel({ onClose, onSignOut, syncError, syncStatus, user }) {
  const isSignedIn = Boolean(user);
  const email = user?.email || "Invitado";
  const initial = email.slice(0, 1).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Cerrar usuario" />
      <section className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[2rem] bg-[#f5f7fb] px-4 pb-28 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]">
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
