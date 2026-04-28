import { useEffect, useRef } from "react";
import {
  deleteRemoteExpense,
  learnFromExpenseCorrection,
  saveRemoteExpense,
  updateRemoteExpense
} from "../../lib/expensesRepository";
import { clearExpenses } from "../../lib/expensesStorage";
import { getCurrentExpenseLocation, isLocationSupported } from "../../lib/locationCapture";
import { getNextReminderTime, isNotificationSupported, requestNotificationPermission } from "../../lib/notificationReminders";
import { resolveNearbyPlace } from "../../lib/placeResolver";

export function useExpenseActions({ auth, refs, state, setters }) {
  const { signOut, user } = auth;
  const { captureRef, inputRef, saveSwipeStart } = refs;
  const undoTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) {
        clearTimeout(undoTimer.current);
      }
    };
  }, []);

  function clearUndo() {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }

    setters.setLastSavedExpense(null);
  }

  async function handleSave() {
    if (!state.canSave) {
      inputRef.current?.focus();
      return;
    }

    const location = state.preferences.locationEnabled ? await getCurrentExpenseLocation() : null;
    const nearbyPlace = state.preferences.locationEnabled
      ? state.locationSuggestion || (await resolveNearbyPlace(location))
      : null;
    const description =
      state.preview.description === "Gasto rapido" && nearbyPlace?.name
        ? nearbyPlace.name
        : state.preview.description;

    const expense = {
      id: crypto.randomUUID(),
      ...state.preview,
      description,
      rawText: state.input.trim(),
      createdAt: new Date().toISOString(),
      creditCardId: state.preview.paymentMethod === "credit" ? state.creditCardId : null,
      installments: 1,
      installmentNumber: null,
      statementMonth: getStatementMonth(new Date()),
      location: location ? { ...location, place: nearbyPlace } : null
    };

    setters.setExpenses((current) => [expense, ...current]);
    if (user) {
      setters.setSyncStatus("syncing");
      setters.setSyncError("");
    }
    saveRemoteExpense(expense)
      .then((savedExpense) => {
        if (savedExpense) {
          setters.setSyncStatus("synced");
        }
      })
      .catch((error) => {
        setters.setSyncStatus("error");
        setters.setSyncError(error?.message || "No se pudo guardar en Supabase.");
      });
    learnFromExpenseCorrection(expense.rawText, expense).catch(() => {});
    if (state.preferences.vibrationEnabled) {
      navigator.vibrate?.(10);
    }
    setters.setInput("");
    setters.setCategory(undefined);
    setters.setPaymentMethod(undefined);
    setters.setCreditCardId(null);
    setters.setActivePicker(null);
    clearUndo();
    setters.setLastActionMessage("");
    setters.setLastSavedExpense(expense);
    undoTimer.current = setTimeout(() => setters.setLastSavedExpense(null), 4000);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleUndo() {
    if (!state.lastSavedExpense) {
      return;
    }

    setters.setExpenses((current) => current.filter((expense) => expense.id !== state.lastSavedExpense.id));
    deleteRemoteExpense(state.lastSavedExpense.id).catch((error) => {
      setters.setSyncStatus("error");
      setters.setSyncError(error?.message || "No se pudo deshacer en Supabase.");
    });
    setters.setInput(state.lastSavedExpense.rawText || "");
    setters.setCategory(state.lastSavedExpense.category);
    setters.setPaymentMethod(state.lastSavedExpense.paymentMethod);
    setters.setCreditCardId(state.lastSavedExpense.creditCardId || null);
    clearUndo();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleSubmit(event) {
    event.preventDefault();
    handleSave();
  }

  async function toggleNotifications() {
    if (state.preferences.notificationsEnabled) {
      setters.setPreferences((current) => ({ ...current, notificationsEnabled: false }));
      return;
    }

    const permission = await requestNotificationPermission();
    setters.setNotificationPermission(permission);
    if (permission === "granted") {
      setters.setPreferences((current) => ({ ...current, notificationsEnabled: true }));
    }
  }

  function setReminderHour(hour) {
    setters.setPreferences((current) => ({ ...current, reminderHour: Number(hour) === 21 ? 21 : 20 }));
  }

  function toggleSwipeSave() {
    setters.setPreferences((current) => ({ ...current, swipeSaveEnabled: !current.swipeSaveEnabled }));
  }

  function toggleVibration() {
    setters.setPreferences((current) => ({ ...current, vibrationEnabled: !current.vibrationEnabled }));
  }

  function toggleLocation() {
    if (!isLocationSupported()) {
      return;
    }

    setters.setPreferences((current) => ({ ...current, locationEnabled: !current.locationEnabled }));
  }

  function handlePreviewSwipe(event) {
    if (!state.preferences.swipeSaveEnabled) {
      return;
    }

    if (event.target.closest("[data-preview-control]")) {
      return;
    }

    if (event.clientY - saveSwipeStart.current < -34) {
      handleSave();
    }
  }

  function handleDelete(id) {
    setters.setExpenses((current) => current.filter((expense) => expense.id !== id));
    deleteRemoteExpense(id).catch((error) => {
      setters.setSyncStatus("error");
      setters.setSyncError(error?.message || "No se pudo borrar en Supabase.");
    });
    setters.setSwipedExpenseId(null);
  }

  function openEditExpense(expense) {
    setters.setEditError("");
    setters.setEditingExpense(expense);
  }

  function closeEditExpense() {
    if (state.isEditingExpense) {
      return;
    }

    setters.setEditError("");
    setters.setEditingExpense(null);
  }

  async function saveEditedExpense(expense) {
    const previousExpense = state.expenses.find((item) => item.id === expense.id);
    if (!previousExpense) {
      setters.setEditError("No se encontro el gasto para editar.");
      return;
    }

    setters.setIsEditingExpense(true);
    setters.setEditError("");
    const nextExpense = {
      ...previousExpense,
      ...expense
    };

    setters.setExpenses((current) => current.map((item) => (item.id === nextExpense.id ? nextExpense : item)));
    try {
      await updateRemoteExpense(nextExpense);
      await learnFromExpenseCorrection(previousExpense.rawText || nextExpense.rawText, nextExpense);
      setters.setLastActionMessage("Gasto actualizado");
      setters.setLastSavedExpense(nextExpense);
      undoTimer.current = setTimeout(() => setters.setLastSavedExpense(null), 2500);
      setters.setEditingExpense(null);
      setters.setSyncStatus(user ? "synced" : "local");
    } catch (error) {
      setters.setExpenses((current) => current.map((item) => (item.id === previousExpense.id ? previousExpense : item)));
      setters.setEditError(error?.message || "No se pudo actualizar el gasto.");
      setters.setSyncStatus("error");
      setters.setSyncError(error?.message || "No se pudo actualizar el gasto.");
    } finally {
      setters.setIsEditingExpense(false);
    }
  }

  async function deleteEditedExpense(id) {
    const previousExpense = state.expenses.find((item) => item.id === id);
    if (!previousExpense) {
      return;
    }

    setters.setIsEditingExpense(true);
    setters.setEditError("");
    setters.setExpenses((current) => current.filter((expense) => expense.id !== id));
    try {
      await deleteRemoteExpense(id);
      setters.setLastActionMessage("Gasto eliminado");
      setters.setLastSavedExpense(previousExpense);
      undoTimer.current = setTimeout(() => setters.setLastSavedExpense(null), 2500);
      setters.setEditingExpense(null);
      setters.setSyncStatus(user ? "synced" : "local");
    } catch (error) {
      setters.setExpenses((current) =>
        [...current, previousExpense].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      );
      setters.setEditError(error?.message || "No se pudo eliminar el gasto.");
      setters.setSyncStatus("error");
      setters.setSyncError(error?.message || "No se pudo eliminar el gasto.");
    } finally {
      setters.setIsEditingExpense(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setters.setSyncStatus("local");
    setters.setActivePanel(null);
  }

  function focusCapture() {
    setters.setActivePanel(null);
    setters.setIsMenuOpen(false);
    captureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function openPanel(panel) {
    setters.setActivePanel(panel);
    setters.setIsMenuOpen(false);
  }

  function captureCardConsumption(cardId) {
    setters.setPaymentMethod("credit");
    setters.setCreditCardId(cardId);
    setters.setActivePanel(null);
    setters.setIsMenuOpen(false);
    captureRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function clearLocalData() {
    clearExpenses();
    setters.setExpenses([]);
    setters.setSelectedFilter(undefined);
    setters.setSwipedExpenseId(null);
  }

  return {
    clearLocalData,
    closeEditExpense,
    captureCardConsumption,
    deleteEditedExpense,
    focusCapture,
    handleDelete,
    handlePreviewSwipe,
    handleSave,
    handleSignOut,
    handleSubmit,
    handleUndo,
    nextReminderTime:
      state.preferences.notificationsEnabled && state.notificationPermission === "granted"
        ? getNextReminderTime(state.preferences.reminderHour)
        : null,
    notificationSupported: isNotificationSupported(),
    locationSupported: isLocationSupported(),
    openPanel,
    openEditExpense,
    saveEditedExpense,
    setReminderHour,
    toggleLocation,
    toggleNotifications,
    toggleSwipeSave,
    toggleVibration
  };
}

function getStatementMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}
