import { formatCurrency } from "./useExpenseParser";

export default function DebtsTimeline({ debts, onMarkPaid }) {
  if (debts.length === 0) {
    return (
      <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm font-semibold text-slate-500">
        Todavia no registraste deudas.
      </p>
    );
  }

  return (
    <section className="space-y-3">
      {debts.map((debt) => (
        <DebtCard key={debt.id} debt={debt} onMarkPaid={onMarkPaid} />
      ))}
    </section>
  );
}

function DebtCard({ debt, onMarkPaid }) {
  const debtorName = debt.debtor?.name || "Deudor";
  const isPaid = debt.status === "paid";
  const whatsappUrl = getWhatsappUrl(debt);

  return (
    <article className="animate-quickIn rounded-[1.35rem] bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black text-slate-950">{debtorName}</p>
          <p className="truncate text-sm font-bold text-slate-400">{debt.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={["text-lg font-black", isPaid ? "text-emerald-600" : "text-slate-950"].join(" ")}>
            {formatCurrency(debt.amount)}
          </p>
          <p className="text-xs font-black text-slate-400">{isPaid ? "Cobrada" : "Pendiente"}</p>
        </div>
      </div>

      {!isPaid && (
        <div className="grid grid-cols-2 gap-2">
          <a
            href={whatsappUrl || undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!whatsappUrl}
            className={[
              "flex h-11 items-center justify-center rounded-2xl text-sm font-black transition active:scale-[0.98]",
              whatsappUrl ? "bg-emerald-50 text-emerald-600" : "pointer-events-none bg-slate-100 text-slate-400"
            ].join(" ")}
          >
            WhatsApp
          </a>
          <button
            type="button"
            onClick={() => onMarkPaid(debt.id)}
            className="flex h-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white transition active:scale-[0.98]"
          >
            Marcar cobrada
          </button>
        </div>
      )}
    </article>
  );
}

function getWhatsappUrl(debt) {
  const phone = String(debt.debtor?.phone || "").replace(/[^\d]/g, "");
  if (!phone) {
    return "";
  }

  const debtorName = debt.debtor?.name || "";
  const message = `Che ${debtorName}, no te cuelgues con los ${formatCurrency(debt.amount)} de ${debt.description}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
