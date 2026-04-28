import { formatCurrency } from "./useExpenseParser";

export default function UndoToast({ expense, message, onUndo }) {
  return (
    <div className="fixed bottom-24 left-4 right-4 z-50" aria-live="polite">
      <div className="animate-toastUp mx-auto flex max-w-md items-center justify-between rounded-2xl bg-slate-950 px-4 py-3.5 text-white shadow-2xl">
        <p className="text-sm font-semibold">
          {message || (
            <>
              <span className="font-black">{formatCurrency(expense.amount)}</span> guardado
            </>
          )}
        </p>
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="rounded-lg px-3 py-1 text-sm font-bold text-[#66b3ff] transition active:bg-white/10"
          >
            Deshacer
          </button>
        )}
      </div>
    </div>
  );
}
