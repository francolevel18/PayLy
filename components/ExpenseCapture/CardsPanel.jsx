import { useEffect, useState } from "react";
import {
  createCreditCard,
  deleteCreditCard,
  getCardSummary,
  loadCardMovements,
  updateCreditCard
} from "../../lib/cardsRepository";
import Timeline from "./Timeline";
import { formatCurrency } from "./useExpenseParser";

export default function CardsPanel({ cards, error, expenses, onCaptureConsumption, onCardsChange, onClose, onEditExpense }) {
  const [selectedCard, setSelectedCard] = useState(null);
  const [editingCard, setEditingCard] = useState(null);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [cardError, setCardError] = useState("");

  async function saveCard(card) {
    setIsSavingCard(true);
    setCardError("");
    try {
      const savedCard = card.id ? await updateCreditCard(card) : await createCreditCard(card);
      const summarized = getCardSummary(savedCard, expenses);
      onCardsChange(
        card.id
          ? cards.map((current) => (current.id === summarized.id ? summarized : current))
          : [summarized, ...cards]
      );
      setEditingCard(null);
    } catch (saveError) {
      setCardError(saveError?.message || "No se pudo guardar la tarjeta.");
    } finally {
      setIsSavingCard(false);
    }
  }

  async function removeCard(id) {
    setIsSavingCard(true);
    setCardError("");
    try {
      await deleteCreditCard(id);
      onCardsChange(cards.filter((card) => card.id !== id));
      setEditingCard(null);
      if (selectedCard?.id === id) {
        setSelectedCard(null);
      }
    } catch (deleteError) {
      setCardError(deleteError?.message || "No se pudo eliminar la tarjeta.");
    } finally {
      setIsSavingCard(false);
    }
  }

  if (selectedCard) {
    return (
      <Timeline
        expenses={loadCardMovements(expenses, selectedCard.id)}
        title={selectedCard.name}
        subtitle="Tarjeta"
        onClose={() => setSelectedCard(null)}
        onEditExpense={onEditExpense}
        actions={
          <button
            type="button"
            onClick={() => onCaptureConsumption(selectedCard.id)}
            className="flex h-10 items-center justify-center rounded-full bg-[#0066ff] px-4 text-xs font-black text-white shadow-[0_12px_26px_rgba(0,102,255,0.24)] transition active:scale-95"
          >
            Cargar consumo
          </button>
        }
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7fb]">
      <section className="payly-full-panel mx-auto flex w-full max-w-md flex-col px-4 pt-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Tarjetas</p>
            <h2 className="text-2xl font-black text-slate-950">Resumen</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingCard({})}
              className="flex h-10 items-center justify-center rounded-full bg-[#0066ff] px-4 text-xs font-black text-white shadow-[0_12px_26px_rgba(0,102,255,0.24)] transition active:scale-95"
            >
              Agregar
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

        {(error || cardError) && (
          <p className="mb-3 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
            {cardError || error}
          </p>
        )}

        {cards.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm font-semibold text-slate-500">
            Todavia no hay tarjetas configuradas.
          </p>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {cards.map((card) => (
              <CreditCardSummary
                key={card.id}
                card={card}
                onCapture={() => onCaptureConsumption(card.id)}
                onEdit={() => setEditingCard(card)}
                onOpen={() => setSelectedCard(card)}
              />
            ))}
          </div>
        )}
      </section>

      <CardFormSheet
        card={editingCard}
        error={cardError}
        isSaving={isSavingCard}
        onCancel={() => {
          if (!isSavingCard) {
            setCardError("");
            setEditingCard(null);
          }
        }}
        onDelete={removeCard}
        onSave={saveCard}
      />
    </div>
  );
}

function CreditCardSummary({ card, onCapture, onEdit, onOpen }) {
  return (
    <section className="rounded-3xl bg-slate-950 p-4 text-white shadow-[0_16px_38px_rgba(15,23,42,0.18)]">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase text-slate-400">{card.brand}</p>
            <h3 className="mt-1 truncate text-xl font-black">{card.name}</h3>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {card.bankName || "Banco"} {card.lastFour ? `terminada en ${card.lastFour}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200">
            {card.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Metric label="Saldo a pagar" value={formatCurrency(card.currentBalance)} />
          <Metric label="Disponible" value={formatCurrency(card.availableLimit)} />
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-400">
            <span>{card.usagePercentage}% usado</span>
            <span>{card.daysToClose} dias al cierre</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#66b3ff]" style={{ width: `${card.usagePercentage}%` }} />
          </div>
          <p className="mt-2 text-xs font-bold text-slate-400">{card.daysToDue} dias al vencimiento</p>
        </div>
      </button>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={onCapture}
          className="flex h-11 items-center justify-center rounded-2xl bg-white text-sm font-black text-[#0066ff] transition active:scale-[0.98]"
        >
          Cargar consumo
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex h-11 items-center justify-center rounded-2xl bg-white/10 px-4 text-xs font-black text-slate-200 transition active:scale-[0.98]"
        >
          Editar
        </button>
      </div>
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/10 px-3 py-2">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <p className="truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function CardFormSheet({ card, error, isSaving, onCancel, onDelete, onSave }) {
  const [draft, setDraft] = useState(() => buildCardDraft(card));

  useEffect(() => {
    setDraft(buildCardDraft(card));
  }, [card]);

  if (!card) {
    return null;
  }

  const isEditing = Boolean(card.id);
  const canSave = draft.name.trim() && Number(draft.creditLimit) >= 0;

  function submit(event) {
    event.preventDefault();
    if (!canSave || isSaving) {
      return;
    }

    onSave({
      ...card,
      name: draft.name.trim(),
      brand: draft.brand,
      bankName: draft.bankName.trim(),
      lastFour: draft.lastFour.trim().slice(-4),
      creditLimit: Number(draft.creditLimit) || 0,
      closingDay: Number(draft.closingDay) || 20,
      dueDay: Number(draft.dueDay) || 10,
      isActive: true
    });
  }

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/35 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onCancel} aria-label="Cancelar tarjeta" />
      <form
        onSubmit={submit}
        className="payly-bottom-sheet absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[2rem] bg-[#f5f7fb] px-4 pt-3 shadow-[0_-20px_55px_rgba(15,23,42,0.25)]"
      >
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Tarjeta</p>
            <h2 className="text-2xl font-black">{isEditing ? "Editar" : "Nueva tarjeta"}</h2>
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
          <CardField label="Nombre">
            <input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Visa Galicia"
              className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-base font-bold text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
            />
          </CardField>

          <div className="grid grid-cols-2 gap-2">
            <CardField label="Marca">
              <select
                value={draft.brand}
                onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-sm font-black text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
              >
                <option value="visa">Visa</option>
                <option value="mastercard">Mastercard</option>
                <option value="amex">Amex</option>
                <option value="other">Otra</option>
              </select>
            </CardField>
            <CardField label="Ultimos 4">
              <input
                value={draft.lastFour}
                inputMode="numeric"
                maxLength={4}
                onChange={(event) => setDraft((current) => ({ ...current, lastFour: event.target.value.replace(/\D/g, "") }))}
                className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-sm font-black text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
              />
            </CardField>
          </div>

          <CardField label="Banco">
            <input
              value={draft.bankName}
              onChange={(event) => setDraft((current) => ({ ...current, bankName: event.target.value }))}
              placeholder="Banco"
              className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-base font-bold text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
            />
          </CardField>

          <CardField label="Limite">
            <input
              type="number"
              min="0"
              value={draft.creditLimit}
              onChange={(event) => setDraft((current) => ({ ...current, creditLimit: event.target.value }))}
              className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-base font-black text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
            />
          </CardField>

          <div className="grid grid-cols-2 gap-2">
            <CardField label="Cierre">
              <input
                type="number"
                min="1"
                max="28"
                value={draft.closingDay}
                onChange={(event) => setDraft((current) => ({ ...current, closingDay: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-sm font-black text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
              />
            </CardField>
            <CardField label="Vencimiento">
              <input
                type="number"
                min="1"
                max="28"
                value={draft.dueDay}
                onChange={(event) => setDraft((current) => ({ ...current, dueDay: event.target.value }))}
                className="h-12 w-full rounded-2xl border border-white bg-white px-4 text-sm font-black text-slate-950 shadow-sm outline-none focus:border-[#0066ff]"
              />
            </CardField>
          </div>

          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!canSave || isSaving}
            className="flex h-[52px] w-full items-center justify-center rounded-2xl bg-[#0066ff] text-sm font-black text-white shadow-[0_14px_30px_rgba(0,102,255,0.22)] transition active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
          >
            {isSaving ? "Guardando..." : "Guardar tarjeta"}
          </button>
          {isEditing && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => onDelete(card.id)}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-red-50 text-sm font-black text-red-600 transition active:scale-[0.98] disabled:opacity-50"
            >
              Eliminar tarjeta
            </button>
          )}
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

function CardField({ children, label }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function buildCardDraft(card) {
  return {
    name: card?.name || "",
    brand: card?.brand || "visa",
    bankName: card?.bankName || "",
    lastFour: card?.lastFour || "",
    creditLimit: card?.creditLimit ? String(card.creditLimit) : "",
    closingDay: card?.closingDay ? String(card.closingDay) : "20",
    dueDay: card?.dueDay ? String(card.dueDay) : "10"
  };
}
