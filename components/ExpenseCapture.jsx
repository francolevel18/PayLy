"use client";

import { useRef } from "react";
import ExpenseHistorySheet, { QuickMenu } from "./ExpenseCapture/ExpenseHistorySheet";
import CardsPanel from "./ExpenseCapture/CardsPanel";
import ExpenseEditSheet from "./ExpenseCapture/ExpenseEditSheet";
import ExpenseInput from "./ExpenseCapture/ExpenseInput";
import ExpensePreview from "./ExpenseCapture/ExpensePreview";
import Header from "./ExpenseCapture/Header";
import { AccountsPanel, AnalysisPanel, UserPanel } from "./ExpenseCapture/InfoPanels";
import NavigationDock from "./ExpenseCapture/NavigationDock";
import SettingsPanel from "./ExpenseCapture/SettingsPanel";
import Timeline from "./ExpenseCapture/Timeline";
import TodaySection from "./ExpenseCapture/TodaySection";
import UndoToast from "./ExpenseCapture/UndoToast";
import SwipeToSave from "./ExpenseCapture/SwipeToSave";
import { getCategoryLabel, getPaymentMethodLabel } from "./ExpenseCapture/useExpenseParser";
import { useExpenseActions } from "./ExpenseCapture/useExpenseActions";
import { useExpenseCaptureState } from "./ExpenseCapture/useExpenseCaptureState";

const sheetPanels = ["accounts", "analysis", "settings", "timeline", "user"];

export default function ExpenseCapture() {
  const inputRef = useRef(null);
  const captureRef = useRef(null);
  const todayRef = useRef(null);
  const pointerStart = useRef({ x: 0, y: 0 });
  const saveSwipeStart = useRef(0);

  const { auth, state, setters } = useExpenseCaptureState();
  const actions = useExpenseActions({
    auth,
    refs: { captureRef, inputRef, saveSwipeStart },
    state,
    setters
  });

  return (
    <main
      className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-32 pt-4 text-slate-950"
      onPointerDown={(event) => {
        if (!event.target.closest("[data-swipe-row]") && !event.target.closest("[data-picker]")) {
          setters.setSwipedExpenseId(null);
          setters.setActivePicker(null);
        }
      }}
    >
      <Header total={state.todayTotal} syncStatus={state.syncStatus} user={auth.user} />

      <form ref={captureRef} onSubmit={actions.handleSubmit} className="scroll-mt-4 space-y-4">
        <ExpenseInput ref={inputRef} value={state.input} onChange={setters.setInput} />
        <SmartReadout preview={state.preview} locationSuggestion={state.locationSuggestion} />
        {state.creditCardId && (
          <SelectedCardHint
            card={state.creditCards.find((card) => card.id === state.creditCardId)}
            onClear={() => setters.setCreditCardId(null)}
          />
        )}
        <ExpensePreview
          preview={state.preview}
          onSelectCategory={setters.setCategory}
          onSelectPaymentMethod={setters.setPaymentMethod}
        />
        <SwipeToSave disabled={!state.canSave} onComplete={actions.handleSave} />
      </form>

      {state.lastSavedExpense && (
        <UndoToast
          expense={state.lastSavedExpense}
          message={state.lastActionMessage}
          onUndo={state.lastActionMessage ? undefined : actions.handleUndo}
        />
      )}

      <TodaySection
        ref={todayRef}
        count={state.todayExpenses.length}
        total={state.todayTotal}
        insight={state.todayInsight}
        topExpense={state.topExpense}
        categorySummary={state.categorySummary}
        selectedFilter={state.selectedFilter}
        onFilter={(nextFilter) =>
          setters.setSelectedFilter((current) => (current === nextFilter ? undefined : nextFilter))
        }
        onClearFilter={() => setters.setSelectedFilter(undefined)}
        expenses={state.visibleExpenses}
        swipedExpenseId={state.swipedExpenseId}
        pointerStart={pointerStart}
        onSwipe={setters.setSwipedExpenseId}
        onDelete={actions.handleDelete}
      />

      <NavigationDock
        onCapture={actions.focusCapture}
        onMenu={() => setters.setIsMenuOpen((current) => !current)}
        isMenuOpen={state.isMenuOpen}
      />

      {state.isMenuOpen && (
        <QuickMenu
          onProfile={() => actions.openPanel("user")}
          onSettings={() => actions.openPanel("settings")}
          onTimeline={() => actions.openPanel("timeline")}
          onCards={() => actions.openPanel("cards")}
          onClose={() => setters.setIsMenuOpen(false)}
        />
      )}

      {state.activePanel === "cards" && (
        <CardsPanel
          cards={state.creditCards}
          error={state.cardsError}
          expenses={state.expenses}
          onCaptureConsumption={actions.captureCardConsumption}
          onCardsChange={setters.setCreditCards}
          onClose={() => setters.setActivePanel(null)}
          onEditExpense={actions.openEditExpense}
        />
      )}
      {state.activePanel === "timeline" && (
        <Timeline
          expenses={state.expenses}
          onClose={() => setters.setActivePanel(null)}
          onEditExpense={actions.openEditExpense}
        />
      )}
      {state.activePanel === "accounts" && <AccountsPanel onClose={() => setters.setActivePanel(null)} />}
      {state.activePanel === "user" && (
        <UserPanel
          onClose={() => setters.setActivePanel(null)}
          onSignOut={actions.handleSignOut}
          syncError={state.syncError}
          syncStatus={state.syncStatus}
          user={auth.user}
        />
      )}
      {state.activePanel === "analysis" && (
        <AnalysisPanel
          total={state.todayTotal}
          count={state.todayExpenses.length}
          topCategory={state.topCategory}
          topExpense={state.topExpense}
          topPaymentMethod={state.topPaymentMethod}
          categorySummary={state.categorySummary}
          onClose={() => setters.setActivePanel(null)}
        />
      )}
      {state.activePanel === "settings" && (
        <SettingsPanel
          onClose={() => setters.setActivePanel(null)}
          syncStatus={state.syncStatus}
          preferences={state.preferences}
          notificationSupported={actions.notificationSupported}
          notificationPermission={state.notificationPermission}
          locationSupported={actions.locationSupported}
          nextReminderTime={actions.nextReminderTime}
          onReminderHourChange={actions.setReminderHour}
          onToggleSwipeSave={actions.toggleSwipeSave}
          onToggleVibration={actions.toggleVibration}
          onToggleNotifications={actions.toggleNotifications}
          onToggleLocation={actions.toggleLocation}
          onClearData={actions.clearLocalData}
        />
      )}

      {state.activePanel && ![...sheetPanels, "cards"].includes(state.activePanel) && (
        <ExpenseHistorySheet
          mode={state.activePanel}
          count={state.todayExpenses.length}
          total={state.todayTotal}
          insight={state.todayInsight}
          topCategory={state.topCategory}
          topExpense={state.topExpense}
          categorySummary={state.categorySummary}
          selectedFilter={state.selectedFilter}
          onFilter={(nextFilter) =>
            setters.setSelectedFilter((current) => (current === nextFilter ? undefined : nextFilter))
          }
          onClearFilter={() => setters.setSelectedFilter(undefined)}
          expenses={state.visibleExpenses}
          swipedExpenseId={state.swipedExpenseId}
          pointerStart={pointerStart}
          onSwipe={setters.setSwipedExpenseId}
          onDelete={actions.handleDelete}
          onClose={() => setters.setActivePanel(null)}
        />
      )}

      <ExpenseEditSheet
        error={state.editError}
        expense={state.editingExpense}
        isSaving={state.isEditingExpense}
        onCancel={actions.closeEditExpense}
        onDelete={actions.deleteEditedExpense}
        onSave={actions.saveEditedExpense}
      />
    </main>
  );
}

function SelectedCardHint({ card, onClear }) {
  if (!card) {
    return null;
  }

  return (
    <div className="-mt-2 flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 text-sm shadow-sm">
      <span className="min-w-0 truncate font-bold text-slate-600">
        Consumo en <span className="font-black text-[#0066ff]">{card.name}</span>
      </span>
      <button type="button" onClick={onClear} className="ml-3 shrink-0 text-xs font-black text-slate-400">
        Cambiar
      </button>
    </div>
  );
}

function SmartReadout({ preview, locationSuggestion }) {
  return (
    <div className="-mt-2 space-y-1 px-1">
      <p className="text-sm font-bold text-slate-500">
        Detectado: <span className="text-slate-950">{getCategoryLabel(preview.category)}</span>
        <span className="text-slate-300"> · </span>
        <span className="text-slate-950">{getPaymentMethodLabel(preview.paymentMethod)}</span>
      </p>
      {locationSuggestion && (
        <p className="truncate text-xs font-semibold text-slate-400">Cerca de {locationSuggestion.name}</p>
      )}
    </div>
  );
}
