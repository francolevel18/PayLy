import { formatCurrency } from "./useExpenseParser";

export default function Header({ total, syncStatus, user }) {
  return (
    <header className="mb-5 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-[#0066ff]">Payly</p>
          <SyncBadge status={syncStatus} user={user} />
          <span className="text-[11px] font-black text-slate-400">{formatShortDate(new Date())}</span>
        </div>
        <h1 className="text-[28px] font-black leading-tight">Nuevo gasto</h1>
      </div>
      <div className="rounded-xl bg-slate-950 px-3 py-2 text-right text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)]">
        <p className="text-xs font-semibold text-slate-400">Hoy</p>
        <p className="text-sm font-black">{formatCurrency(total)}</p>
      </div>
    </header>
  );
}

function SyncBadge({ status, user }) {
  const isSynced = status === "synced";
  const label = user ? getSyncStatusLabel(status) : "Local";

  return (
    <span
      className={[
        "rounded-full px-2 py-0.5 text-[11px] font-black",
        isSynced ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "numeric"
  }).format(date);
}

export function getSyncStatusLabel(status) {
  if (status === "checking") {
    return "Revisando sesion";
  }
  if (status === "syncing") {
    return "Sincronizando";
  }
  if (status === "synced") {
    return "Sincronizado";
  }
  if (status === "error") {
    return "Sin conexion";
  }

  return "Local";
}
