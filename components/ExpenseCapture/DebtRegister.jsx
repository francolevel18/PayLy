import { useMemo, useState } from "react";
import { formatCurrency } from "./useExpenseParser";

export default function DebtRegister({ debtors, isSaving, onCreate }) {
  const [input, setInput] = useState("");
  const [selectedDebtorId, setSelectedDebtorId] = useState("");
  const [isCreatingDebtor, setIsCreatingDebtor] = useState(false);
  const [newDebtor, setNewDebtor] = useState({ name: "", phone: "" });
  const preview = useMemo(() => parseDebtInput(input), [input]);
  const canSave = preview.amount > 0 && (selectedDebtorId || newDebtor.name.trim());

  function submit(event) {
    event.preventDefault();
    if (!canSave || isSaving) {
      return;
    }

    onCreate({
      debtorId: selectedDebtorId,
      debtor: isCreatingDebtor ? newDebtor : null,
      amount: preview.amount,
      description: preview.description
    }).then(() => {
      setInput("");
      setNewDebtor({ name: "", phone: "" });
      setIsCreatingDebtor(false);
      setSelectedDebtorId("");
    });
  }

  return (
    <section className="rounded-[1.7rem] bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)]">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <p className="mb-2 text-xs font-black uppercase text-slate-400">Registrar deuda</p>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ej: 1500 pizza"
            className="h-14 w-full rounded-2xl border border-slate-100 bg-slate-50 px-4 text-lg font-black text-slate-950 outline-none transition focus:border-[#0066ff] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
          />
          <p className="mt-2 text-sm font-bold text-slate-500">
            Detectado: <span className="text-slate-950">{formatCurrency(preview.amount)}</span>
            <span className="text-slate-300"> · </span>
            <span className="text-slate-950">{preview.description}</span>
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {debtors.map((debtor) => (
            <button
              key={debtor.id}
              type="button"
              onClick={() => {
                setSelectedDebtorId(debtor.id);
                setIsCreatingDebtor(false);
              }}
              className={[
                "shrink-0 rounded-full border px-3 py-2 text-xs font-black transition active:scale-95",
                selectedDebtorId === debtor.id && !isCreatingDebtor
                  ? "border-[#0066ff] bg-[#0066ff] text-white"
                  : "border-slate-100 bg-slate-50 text-slate-500"
              ].join(" ")}
            >
              {debtor.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setIsCreatingDebtor(true);
              setSelectedDebtorId("");
            }}
            className={[
              "shrink-0 rounded-full border px-3 py-2 text-xs font-black transition active:scale-95",
              isCreatingDebtor ? "border-slate-950 bg-slate-950 text-white" : "border-slate-100 bg-slate-50 text-slate-500"
            ].join(" ")}
          >
            + Nuevo
          </button>
        </div>

        {isCreatingDebtor && (
          <div className="animate-quickIn grid grid-cols-[1fr_0.9fr] gap-2">
            <input
              value={newDebtor.name}
              onChange={(event) => setNewDebtor((current) => ({ ...current, name: event.target.value }))}
              placeholder="Nombre"
              className="h-11 rounded-xl border border-slate-100 bg-slate-50 px-3 text-sm font-black outline-none focus:border-[#0066ff]"
            />
            <input
              value={newDebtor.phone}
              onChange={(event) => setNewDebtor((current) => ({ ...current, phone: event.target.value }))}
              placeholder="WhatsApp"
              inputMode="tel"
              className="h-11 rounded-xl border border-slate-100 bg-slate-50 px-3 text-sm font-black outline-none focus:border-[#0066ff]"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={!canSave || isSaving}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#0066ff] text-sm font-black text-white shadow-[0_14px_30px_rgba(0,102,255,0.22)] transition active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
        >
          {isSaving ? "Guardando..." : "Guardar deuda"}
        </button>
      </form>
    </section>
  );
}

export function parseDebtInput(input) {
  const text = String(input || "").trim();
  const amountMatch = text.match(/\$?\s*\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?/);
  const amount = parseAmount(amountMatch?.[0]);
  const description = text.replace(amountMatch?.[0] || "", "").replace(/\s+/g, " ").trim();

  return {
    amount,
    description: description || "Deuda"
  };
}

function parseAmount(rawAmount) {
  const clean = String(rawAmount || "").replace(/[^\d.,]/g, "");
  if (!clean) {
    return 0;
  }

  if (clean.includes(",") && clean.includes(".")) {
    const decimalSeparator = clean.lastIndexOf(",") > clean.lastIndexOf(".") ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return Number(clean.replaceAll(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  if (clean.includes(".")) {
    const parts = clean.split(".");
    return parts.at(-1)?.length === 3 ? Number(parts.join("")) : Number(clean);
  }

  if (clean.includes(",")) {
    const parts = clean.split(",");
    return parts.at(-1)?.length === 3 ? Number(parts.join("")) : Number(clean.replace(",", "."));
  }

  return Number(clean);
}
