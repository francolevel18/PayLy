import { useEffect, useState } from "react";
import {
  categories,
  formatCurrency,
  getCategoryLabel,
  getPaymentMethodLabel,
  paymentMethods
} from "./useExpenseParser";

export default function ExpenseEditSheet({ error, expense, isSaving, onCancel, onDelete, onSave }) {
  const [draft, setDraft] = useState(() => buildDraft(expense));

  useEffect(() => {
    setDraft(buildDraft(expense));
  }, [expense]);

  if (!expense) {
    return null;
  }

  const amount = Number(draft.amount);
  const canSave = Number.isFinite(amount) && amount > 0 && draft.description.trim();

  function submit(event) {
    event.preventDefault();
    if (!canSave || isSaving) {
      return;
    }

    onSave({
      ...expense,
      amount,
      description: draft.description.trim(),
      rawText: draft.rawText.trim() || expense.rawText || draft.description.trim(),
      category: draft.category,
      paymentMethod: draft.paymentMethod,
      creditCardId: draft.paymentMethod === "credit" ? expense.creditCardId || null : null,
      installments: expense.installments || 1,
      installmentNumber: expense.installmentNumber || null,
      statementMonth: expense.statementMonth || null,
      createdAt: new Date(draft.createdAt).toISOString()
    });
  }

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onCancel} aria-label="Cancelar edicion" />
      <form
        onSubmit={submit}
        className="absolute inset-x-0 bottom-0 mx-auto max-h-[88vh] max-w-md overflow-y-auto rounded-t-[2rem] bg-[#f5f7fb] px-4 pb-8 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Editar gasto</p>
            <h2 className="text-2xl font-black">{formatCurrency(amount || expense.amount)}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white font-black text-slate-500 shadow-sm"
            aria-label="Cerrar"
          >
            x
          </button>
        </div>

        <div className="space-y-3">
          <EditField label="Monto">
            <input
              type="number"
              min="0"
              step="0.01"
              value={draft.amount}
              onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-base font-black text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
            />
          </EditField>

          <EditField label="Descripcion">
            <input
              type="text"
              value={draft.description}
              onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-base font-bold text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
            />
          </EditField>

          <EditField label="Categoria">
            <OptionGrid
              options={categories}
              selected={draft.category}
              getLabel={getCategoryLabel}
              onSelect={(category) => setDraft((current) => ({ ...current, category }))}
            />
          </EditField>

          <EditField label="Medio de pago">
            <OptionGrid
              options={paymentMethods}
              selected={draft.paymentMethod}
              getLabel={getPaymentMethodLabel}
              onSelect={(paymentMethod) => setDraft((current) => ({ ...current, paymentMethod }))}
            />
          </EditField>

          <EditField label="Fecha y hora">
            <input
              type="datetime-local"
              value={draft.createdAt}
              onChange={(event) => setDraft((current) => ({ ...current, createdAt: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-sm font-black text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
            />
          </EditField>

          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!canSave || isSaving}
            className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#0066ff] text-sm font-black text-white shadow-[0_14px_30px_rgba(0,102,255,0.22)] transition active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => onDelete(expense.id)}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-red-50 text-sm font-black text-red-600 transition active:scale-[0.98] disabled:opacity-50"
          >
            Eliminar gasto
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-white text-sm font-black text-slate-500 shadow-sm transition active:scale-[0.98] disabled:opacity-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

function EditField({ children, label }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function OptionGrid({ getLabel, onSelect, options, selected }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className={[
            "rounded-full border px-3 py-2 text-xs font-black transition active:scale-95",
            selected === option
              ? "border-[#0066ff] bg-[#0066ff] text-white"
              : "border-white bg-white text-slate-500 shadow-sm"
          ].join(" ")}
        >
          {getLabel(option)}
        </button>
      ))}
    </div>
  );
}

function buildDraft(expense) {
  return {
    amount: expense?.amount ? String(expense.amount) : "",
    description: expense?.description || "",
    rawText: expense?.rawText || "",
    category: expense?.category || "other",
    paymentMethod: expense?.paymentMethod || "cash",
    creditCardId: expense?.creditCardId || null,
    createdAt: toDateTimeLocal(expense?.createdAt)
  };
}

function toDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}
