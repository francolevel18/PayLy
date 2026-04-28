"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ExpenseHistorySheet, { QuickMenu } from "./ExpenseCapture/ExpenseHistorySheet";
import ExpenseInput from "./ExpenseCapture/ExpenseInput";
import ExpensePreview from "./ExpenseCapture/ExpensePreview";
import NavigationDock from "./ExpenseCapture/NavigationDock";
import Timeline from "./ExpenseCapture/Timeline";
import {
  categories,
  formatCurrency,
  getCategoryLabel,
  getPaymentMethodLabel,
  useExpenseParser
} from "./ExpenseCapture/useExpenseParser";
import {
  deleteRemoteExpense,
  learnFromExpenseCorrection,
  loadRemoteExpenses,
  migrateLocalExpenses,
  saveRemoteExpense
} from "../lib/expensesRepository";
import {
  clearExpenses,
  hasMigratedExpenses,
  isToday,
  loadExpenses,
  markExpensesMigrated,
  saveExpenses
} from "../lib/expensesStorage";
import { isSupabaseConfigured } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";

export default function ExpenseCapture() {
  const router = useRouter();
  const { isSessionLoading, signOut, user } = useAuth();
  const [input, setInput] = useState("");
  const [category, setCategory] = useState(undefined);
  const [paymentMethod, setPaymentMethod] = useState(undefined);
  const [expenses, setExpenses] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? "checking" : "local");
  const [syncError, setSyncError] = useState("");
  const [lastSavedExpense, setLastSavedExpense] = useState(null);
  const [swipedExpenseId, setSwipedExpenseId] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState(undefined);
  const [activePanel, setActivePanel] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activePicker, setActivePicker] = useState(null);

  const inputRef = useRef(null);
  const captureRef = useRef(null);
  const todayRef = useRef(null);
  const undoTimer = useRef(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const saveSwipeStart = useRef(0);

  const preview = useExpenseParser(input, { category, paymentMethod });
  const todayExpenses = useMemo(() => expenses.filter((expense) => isToday(expense.createdAt)), [expenses]);
  const todayTotal = todayExpenses.reduce((total, expense) => total + expense.amount, 0);
  const topExpense = todayExpenses.reduce((top, expense) => (!top || expense.amount > top.amount ? expense : top), null);
  const categorySummary = useMemo(() => buildCategorySummary(todayExpenses), [todayExpenses]);
  const topCategory = categorySummary.reduce((top, item) => (!top || item.total > top.total ? item : top), null);
  const topPaymentMethod = getTopPaymentMethod(todayExpenses);
  const visibleExpenses = selectedFilter
    ? todayExpenses.filter((expense) => expense.category === selectedFilter)
    : todayExpenses;
  const todayInsight = getTodayInsight(todayExpenses, topExpense);
  const canSave = preview.amount > 0;

  const clearUndo = useCallback(() => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }

    setLastSavedExpense(null);
  }, []);

  useEffect(() => {
    const localExpenses = loadExpenses();
    setExpenses(localExpenses);
    setIsLoaded(true);

    return () => clearUndo();
  }, [clearUndo]);

  useEffect(() => {
    if (!isLoaded || isSessionLoading) {
      return;
    }

    if (!isSupabaseConfigured || !user) {
      setSyncStatus("local");
      setSyncError("");
      if (isSupabaseConfigured && !user) {
        router.replace("/");
      }
      return;
    }

    setSyncStatus("syncing");
    setSyncError("");
    syncInitialExpenses(expenses, user.id)
      .then((remoteExpenses) => {
        if (remoteExpenses) {
          setExpenses(remoteExpenses);
        }
        setSyncStatus("synced");
      })
      .catch((error) => {
        setSyncStatus("error");
        setSyncError(error?.message || "No se pudo sincronizar.");
      });
  }, [isLoaded, isSessionLoading, router, user?.id]);

  useEffect(() => {
    if (isLoaded) {
      saveExpenses(expenses);
    }
  }, [expenses, isLoaded]);

  useEffect(() => {
    if (selectedFilter && !todayExpenses.some((expense) => expense.category === selectedFilter)) {
      setSelectedFilter(undefined);
    }
  }, [selectedFilter, todayExpenses]);

  function handleSave() {
    if (!canSave) {
      inputRef.current?.focus();
      return;
    }

    const expense = {
      id: crypto.randomUUID(),
      ...preview,
      rawText: input.trim(),
      createdAt: new Date().toISOString()
    };

    setExpenses((current) => [expense, ...current]);
    if (user) {
      setSyncStatus("syncing");
      setSyncError("");
    }
    saveRemoteExpense(expense)
      .then((savedExpense) => {
        if (savedExpense) {
          setSyncStatus("synced");
        }
      })
      .catch((error) => {
        setSyncStatus("error");
        setSyncError(error?.message || "No se pudo guardar en Supabase.");
      });
    learnFromExpenseCorrection(expense.rawText, expense).catch(() => {});
    navigator.vibrate?.(10);
    setInput("");
    setCategory(undefined);
    setPaymentMethod(undefined);
    setActivePicker(null);
    clearUndo();
    setLastSavedExpense(expense);
    undoTimer.current = setTimeout(() => setLastSavedExpense(null), 4000);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleUndo() {
    if (!lastSavedExpense) {
      return;
    }

    setExpenses((current) => current.filter((expense) => expense.id !== lastSavedExpense.id));
    deleteRemoteExpense(lastSavedExpense.id).catch((error) => {
      setSyncStatus("error");
      setSyncError(error?.message || "No se pudo deshacer en Supabase.");
    });
    setInput(lastSavedExpense.rawText || "");
    setCategory(lastSavedExpense.category);
    setPaymentMethod(lastSavedExpense.paymentMethod);
    clearUndo();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleSubmit(event) {
    event.preventDefault();
    handleSave();
  }

  function handlePreviewSwipe(event) {
    if (event.target.closest("[data-preview-control]")) {
      return;
    }

    if (event.clientY - saveSwipeStart.current < -34) {
      handleSave();
    }
  }

  function handleDelete(id) {
    setExpenses((current) => current.filter((expense) => expense.id !== id));
    deleteRemoteExpense(id).catch((error) => {
      setSyncStatus("error");
      setSyncError(error?.message || "No se pudo borrar en Supabase.");
    });
    setSwipedExpenseId(null);
  }

  async function handleSignOut() {
    await signOut();
    setSyncStatus("local");
    setActivePanel(null);
  }

  function focusCapture() {
    setActivePanel(null);
    setIsMenuOpen(false);
    captureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function openPanel(panel) {
    setActivePanel(panel);
    setIsMenuOpen(false);
  }

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-32 pt-4 text-slate-950"
      onPointerDown={(event) => {
        if (!event.target.closest("[data-swipe-row]") && !event.target.closest("[data-picker]")) {
          setSwipedExpenseId(null);
          setActivePicker(null);
        }
      }}
    >
      <Header total={todayTotal} syncStatus={syncStatus} user={user} />

      <form ref={captureRef} onSubmit={handleSubmit} className="scroll-mt-4 space-y-4">
        <ExpenseInput ref={inputRef} value={input} onChange={setInput} />
        <ExpensePreview
          preview={preview}
          canSave={canSave}
          activePicker={activePicker}
          onTogglePicker={setActivePicker}
          onSelectCategory={setCategory}
          onSelectPaymentMethod={setPaymentMethod}
          onSwipeStart={(event) => {
            saveSwipeStart.current = event.clientY;
          }}
          onSwipeEnd={handlePreviewSwipe}
        />
        <button
          type="submit"
          disabled={!canSave}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#0066ff] text-base font-black text-white shadow-[0_14px_30px_rgba(0,102,255,0.28)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-400 disabled:shadow-none"
        >
          Guardar gasto
        </button>
      </form>

      {lastSavedExpense && <UndoToast expense={lastSavedExpense} onUndo={handleUndo} />}

      <TodaySection
        ref={todayRef}
        count={todayExpenses.length}
        total={todayTotal}
        insight={todayInsight}
        topExpense={topExpense}
        categorySummary={categorySummary}
        selectedFilter={selectedFilter}
        onFilter={(nextFilter) => setSelectedFilter((current) => (current === nextFilter ? undefined : nextFilter))}
        onClearFilter={() => setSelectedFilter(undefined)}
        expenses={visibleExpenses}
        swipedExpenseId={swipedExpenseId}
        pointerStart={pointerStart}
        onSwipe={setSwipedExpenseId}
        onDelete={handleDelete}
      />

      <NavigationDock
        onCapture={focusCapture}
        onMenu={() => setIsMenuOpen((current) => !current)}
        isMenuOpen={isMenuOpen}
      />

      {isMenuOpen && (
        <QuickMenu
          onProfile={() => openPanel("user")}
          onSettings={() => openPanel("settings")}
          onTimeline={() => openPanel("timeline")}
          onClose={() => setIsMenuOpen(false)}
        />
      )}

      {activePanel === "timeline" && <Timeline expenses={expenses} onClose={() => setActivePanel(null)} />}
      {activePanel === "accounts" && <AccountsPanel onClose={() => setActivePanel(null)} />}
      {activePanel === "user" && (
        <UserPanel
          onClose={() => setActivePanel(null)}
          onSignOut={handleSignOut}
          syncError={syncError}
          syncStatus={syncStatus}
          user={user}
        />
      )}
      {activePanel === "analysis" && (
        <AnalysisPanel
          total={todayTotal}
          count={todayExpenses.length}
          topCategory={topCategory}
          topExpense={topExpense}
          topPaymentMethod={topPaymentMethod}
          categorySummary={categorySummary}
          onClose={() => setActivePanel(null)}
        />
      )}
      {activePanel === "settings" && (
        <SettingsPanel
          onClose={() => setActivePanel(null)}
          syncStatus={syncStatus}
          onClearData={() => {
            clearExpenses();
            setExpenses([]);
            setSelectedFilter(undefined);
            setSwipedExpenseId(null);
          }}
        />
      )}

      {activePanel && !["accounts", "analysis", "settings", "timeline", "user"].includes(activePanel) && (
        <ExpenseHistorySheet
          mode={activePanel}
          count={todayExpenses.length}
          total={todayTotal}
          insight={todayInsight}
          topCategory={topCategory}
          topExpense={topExpense}
          categorySummary={categorySummary}
          selectedFilter={selectedFilter}
          onFilter={(nextFilter) => setSelectedFilter((current) => (current === nextFilter ? undefined : nextFilter))}
          onClearFilter={() => setSelectedFilter(undefined)}
          expenses={visibleExpenses}
          swipedExpenseId={swipedExpenseId}
          pointerStart={pointerStart}
          onSwipe={setSwipedExpenseId}
          onDelete={handleDelete}
          onClose={() => setActivePanel(null)}
        />
      )}
    </main>
  );
}

async function syncInitialExpenses(localExpenses, userId) {
  const remoteExpenses = await loadRemoteExpenses();
  if (remoteExpenses.length > 0) {
    saveExpenses(remoteExpenses);
    markExpensesMigrated(userId);
    return remoteExpenses;
  }

  if (!hasMigratedExpenses(userId)) {
    await migrateLocalExpenses(localExpenses);
    markExpensesMigrated(userId);
  }

  return null;
}

function AnalysisPanel({ total, count, topCategory, topExpense, topPaymentMethod, categorySummary, onClose }) {
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

function AccountsPanel({ onClose }) {
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

function UserPanel({ onClose, onSignOut, syncError, syncStatus, user }) {
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

function SettingsPanel({ onClose, onClearData, syncStatus }) {
  const [confirmClear, setConfirmClear] = useState(false);

  function handleClearData() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }

    onClearData();
    setConfirmClear(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f5f7fb]">
      <section className="mx-auto flex h-full w-full max-w-md flex-col px-4 pb-28 pt-4">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[#0066ff]">Configuracion</p>
            <h2 className="text-2xl font-black">Preferencias</h2>
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

        <div className="flex-1 space-y-2 overflow-y-auto">
          <SettingRow label="Moneda" value="ARS" />
          <SettingRow label="Guardado" value={getSyncStatusLabel(syncStatus)} />
          <SettingToggle label="Vibracion al guardar" enabled />
          <SettingToggle label="Swipe para guardar" enabled />

          <button
            type="button"
            onClick={handleClearData}
            className={[
              "mt-4 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-black transition active:scale-[0.98]",
              confirmClear ? "bg-red-500 text-white" : "bg-red-50 text-red-600"
            ].join(" ")}
          >
            {confirmClear ? "Tocar otra vez para borrar" : "Borrar datos locales"}
          </button>
        </div>
      </section>
    </div>
  );
}

function SettingRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
      <span className="font-black text-slate-950">{label}</span>
      <span className="text-sm font-bold text-slate-400">{value}</span>
    </div>
  );
}

function SettingToggle({ label, enabled }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm">
      <span className="font-black text-slate-950">{label}</span>
      <span className={["flex h-7 w-12 items-center rounded-full p-1", enabled ? "bg-[#0066ff]" : "bg-slate-200"].join(" ")}>
        <span className={["h-5 w-5 rounded-full bg-white shadow-sm", enabled ? "ml-5" : "ml-0"].join(" ")} />
      </span>
    </div>
  );
}

function Header({ total, syncStatus, user }) {
  return (
    <header className="mb-5 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-[#0066ff]">Payly</p>
          <SyncBadge status={syncStatus} user={user} />
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

function getSyncStatusLabel(status) {
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

function RecentPeek({ expenses }) {
  return (
    <section className="mt-2 rounded-3xl border border-white/70 bg-white/45 p-4 opacity-75 shadow-sm">
      <p className="mb-2 text-xs font-black uppercase text-slate-400">Recientes</p>
      {expenses.length === 0 ? (
        <p className="text-sm font-bold text-slate-400">Los ultimos gastos van a aparecer aca.</p>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-bold text-slate-500">{expense.description}</span>
              <span className="shrink-0 font-black text-slate-700">{formatCurrency(expense.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function UndoToast({ expense, onUndo }) {
  return (
    <div className="fixed bottom-24 left-4 right-4 z-50" aria-live="polite">
      <div className="mx-auto flex max-w-md items-center justify-between rounded-2xl bg-slate-950 px-4 py-3.5 text-white shadow-2xl">
        <p className="text-sm font-semibold">
          <span className="font-black">{formatCurrency(expense.amount)}</span> guardado
        </p>
        <button
          type="button"
          onClick={onUndo}
          className="rounded-lg px-3 py-1 text-sm font-bold text-[#66b3ff] transition active:bg-white/10"
        >
          Deshacer
        </button>
      </div>
    </div>
  );
}

const categoryBars = {
  food: "bg-emerald-500",
  health: "bg-rose-500",
  home: "bg-violet-500",
  leisure: "bg-fuchsia-500",
  market: "bg-amber-500",
  other: "bg-slate-400",
  services: "bg-cyan-500",
  transport: "bg-sky-500"
};

const TodaySection = forwardRef(function TodaySection(
  {
    count,
    total,
    insight,
    topExpense,
    categorySummary,
    selectedFilter,
    onFilter,
    onClearFilter,
    expenses,
    swipedExpenseId,
    pointerStart,
    onSwipe,
    onDelete
  },
  ref
) {
  return (
    <section ref={ref} className="mt-7 flex-1 scroll-mt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">Hoy</h2>
        <span className="max-w-[72%] rounded-full border border-slate-100 bg-white px-3 py-1 text-right text-sm font-bold text-slate-600 shadow-sm">
          {formatCurrency(total)} en {count} {count === 1 ? "gasto" : "gastos"}
        </span>
      </div>

      {count === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/70 px-4 py-10 text-center text-sm font-semibold text-slate-500">
          Todavia no cargaste gastos hoy.
        </p>
      ) : (
        <>
          <p className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-bold text-[#0052cc]">
            {insight}
          </p>
          <CategorySummary items={categorySummary} selected={selectedFilter} onSelect={onFilter} />
          {selectedFilter && (
            <button type="button" onClick={onClearFilter} className="mt-2 text-xs font-black text-[#0066ff]">
              Ver todos los gastos
            </button>
          )}
          <ul className="mt-3 space-y-2">
            {expenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                isTop={expense.id === topExpense?.id}
                isSwiped={swipedExpenseId === expense.id}
                pointerStart={pointerStart}
                onSwipe={onSwipe}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
});

function CategorySummary({ items, selected, onSelect }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {items.map((item) => (
        <button
          type="button"
          onClick={() => onSelect(item.category)}
          key={item.category}
          className={[
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold shadow-sm transition active:scale-95",
            selected === item.category
              ? "border-[#0066ff] bg-[#0066ff] text-white"
              : "border-slate-100 bg-white text-slate-600"
          ].join(" ")}
        >
          {getCategoryLabel(item.category)} {formatCurrency(item.total)}
        </button>
      ))}
    </div>
  );
}

function ExpenseRow({ expense, isTop, isSwiped, pointerStart, onSwipe, onDelete }) {
  return (
    <li
      data-swipe-row
      className={[
        "relative overflow-hidden rounded-xl bg-red-500",
        isTop ? "shadow-[0_8px_28px_rgba(0,102,255,0.14)]" : "shadow-[0_4px_20px_rgba(15,23,42,0.04)]"
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => onDelete(expense.id)}
        className="absolute inset-y-0 right-0 flex w-16 items-center justify-center text-white"
        aria-label="Eliminar gasto"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M6 7h12M9 7V5h6v2m-7 3 1 9h6l1-9" />
        </svg>
      </button>
      <div
        onPointerDown={(event) => {
          pointerStart.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerCancel={() => onSwipe(null)}
        onPointerUp={(event) => {
          const deltaX = event.clientX - pointerStart.current.x;
          const deltaY = event.clientY - pointerStart.current.y;
          onSwipe(deltaX < -36 && Math.abs(deltaX) > Math.abs(deltaY) + 12 ? expense.id : null);
        }}
        className={[
          "flex touch-pan-y items-center justify-between rounded-xl border border-slate-100/80 bg-white px-4 py-3.5 transition-transform",
          isSwiped ? "-translate-x-16" : "translate-x-0"
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={[
              "h-9 shrink-0 rounded-full",
              isTop ? "w-2 bg-[#0066ff]" : "w-1.5",
              isTop ? "" : categoryBars[expense.category] ?? categoryBars.other
            ].join(" ")}
          />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{expense.description}</p>
            <p className="text-[13px] font-medium text-slate-500">
              {getCategoryLabel(expense.category)} - {getPaymentMethodLabel(expense.paymentMethod)}
            </p>
          </div>
        </div>
        <p className="ml-3 shrink-0 text-[15px] font-bold">{formatCurrency(expense.amount)}</p>
      </div>
    </li>
  );
}

function buildCategorySummary(expenses) {
  return categories
    .map((category) => ({
      category,
      total: expenses
        .filter((expense) => expense.category === category)
        .reduce((total, expense) => total + expense.amount, 0)
    }))
    .filter((item) => item.total > 0);
}

function getTopPaymentMethod(expenses) {
  const totals = expenses.reduce((result, expense) => {
    result[expense.paymentMethod] = (result[expense.paymentMethod] || 0) + 1;
    return result;
  }, {});

  return Object.entries(totals).reduce((top, [paymentMethod, count]) => {
    if (!top || count > top.count) {
      return { paymentMethod, count };
    }

    return top;
  }, null);
}

function getTodayInsight(todayExpenses, topExpense) {
  if (todayExpenses.length === 1) {
    return `Primer gasto del dia: ${formatCurrency(todayExpenses[0].amount)}`;
  }

  return topExpense ? `Mayor gasto: ${topExpense.description} ${formatCurrency(topExpense.amount)}` : "";
}
