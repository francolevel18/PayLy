import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getNotificationPermission, scheduleDailyExpenseReminder } from "../../lib/notificationReminders";
import { loadCreditCards } from "../../lib/cardsRepository";
import { isSupabaseConfigured } from "../../lib/supabaseClient";
import { isToday, loadExpenses, saveExpenses } from "../../lib/expensesStorage";
import { getCurrentExpenseLocation } from "../../lib/locationCapture";
import { loadRemoteParserLearning } from "../../lib/expensesRepository";
import { applyLocalParserLearning } from "../../lib/parserLearningStorage";
import { resolveNearbyPlace } from "../../lib/placeResolver";
import { loadPreferences, savePreferences } from "../../lib/userPreferences";
import { useAuth } from "../../hooks/useAuth";
import { useExpenseParser } from "./useExpenseParser";
import { buildCategorySummary, getFirstName, getTodayInsight, getTopPaymentMethod } from "./captureStats";
import { syncInitialExpenses } from "./syncInitialExpenses";

export function useExpenseCaptureState() {
  const router = useRouter();
  const auth = useAuth();
  const { isSessionLoading, user } = auth;
  const initialSyncUserRef = useRef(null);
  const [input, setInput] = useState("");
  const [category, setCategory] = useState(undefined);
  const [paymentMethod, setPaymentMethod] = useState(undefined);
  const [creditCardId, setCreditCardId] = useState(null);
  const [creditCards, setCreditCards] = useState([]);
  const [cardsError, setCardsError] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? "checking" : "local");
  const [syncError, setSyncError] = useState("");
  const [lastSavedExpense, setLastSavedExpense] = useState(null);
  const [lastActionMessage, setLastActionMessage] = useState("");
  const [editingExpense, setEditingExpense] = useState(null);
  const [editError, setEditError] = useState("");
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  const [swipedExpenseId, setSwipedExpenseId] = useState(null);
  const [selectedFilter, setSelectedFilter] = useState(undefined);
  const [activePanel, setActivePanel] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activePicker, setActivePicker] = useState(null);
  const [preferences, setPreferences] = useState({
    locationEnabled: false,
    notificationsEnabled: false,
    reminderHour: 20,
    swipeSaveEnabled: true,
    vibrationEnabled: true
  });
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [locationSuggestion, setLocationSuggestion] = useState(null);

  const suggestedCategory = category ?? locationSuggestion?.category;
  const preview = useExpenseParser(input, { category: suggestedCategory, paymentMethod });
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

  useEffect(() => {
    applyLocalParserLearning();
    setPreferences(loadPreferences());
    setNotificationPermission(getNotificationPermission());
    setExpenses(loadExpenses());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      savePreferences(preferences);
    }
  }, [isLoaded, preferences]);

  useEffect(() => {
    if (!isLoaded || isSessionLoading) {
      return;
    }

    if (!isSupabaseConfigured || !user) {
      initialSyncUserRef.current = null;
      setSyncStatus("local");
      setSyncError("");
      if (isSupabaseConfigured && !user) {
        router.replace("/");
      }
      return;
    }

    if (initialSyncUserRef.current === user.id) {
      return;
    }

    initialSyncUserRef.current = user.id;
    setSyncStatus("syncing");
    setSyncError("");
    syncInitialExpenses(expenses, user.id)
      .then(async (remoteExpenses) => {
        loadRemoteParserLearning().catch(() => null);
        if (remoteExpenses) {
          setExpenses(remoteExpenses);
        }
        setSyncStatus("synced");
      })
      .catch((error) => {
        initialSyncUserRef.current = null;
        setSyncStatus("error");
        setSyncError(error?.message || "No se pudo sincronizar.");
      });
  }, [expenses, isLoaded, isSessionLoading, router, user]);

  useEffect(() => {
    if (isLoaded) {
      saveExpenses(expenses);
    }
  }, [expenses, isLoaded]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    let isCancelled = false;
    loadCreditCards(expenses)
      .then((cards) => {
        if (!isCancelled) {
          setCreditCards(cards);
          setCardsError("");
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setCardsError(error?.message || "No se pudieron cargar las tarjetas.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [expenses, isLoaded, user?.id]);

  useEffect(() => {
    if (selectedFilter && !todayExpenses.some((expense) => expense.category === selectedFilter)) {
      setSelectedFilter(undefined);
    }
  }, [selectedFilter, todayExpenses]);

  useEffect(() => {
    const cleanup = scheduleDailyExpenseReminder({
      enabled: preferences.notificationsEnabled,
      hasExpensesToday: () => todayExpenses.length > 0,
      hour: preferences.reminderHour,
      name: getFirstName(user)
    });

    return cleanup;
  }, [preferences.notificationsEnabled, preferences.reminderHour, todayExpenses.length, user]);

  useEffect(() => {
    let isCancelled = false;

    async function loadPlaceSuggestion() {
      if (!preferences.locationEnabled) {
        setLocationSuggestion(null);
        return;
      }

      const location = await getCurrentExpenseLocation(2200);
      const place = await resolveNearbyPlace(location);
      if (!isCancelled) {
        setLocationSuggestion(place);
      }
    }

    loadPlaceSuggestion();

    return () => {
      isCancelled = true;
    };
  }, [preferences.locationEnabled]);

  return {
    auth,
    state: {
      activePanel,
      activePicker,
      canSave,
      cardsError,
      categorySummary,
      creditCardId,
      creditCards,
      expenses,
      editError,
      editingExpense,
      input,
      isMenuOpen,
      isEditingExpense,
      lastActionMessage,
      lastSavedExpense,
      locationSuggestion,
      notificationPermission,
      preferences,
      preview,
      selectedFilter,
      swipedExpenseId,
      syncError,
      syncStatus,
      todayExpenses,
      todayInsight,
      todayTotal,
      topCategory,
      topExpense,
      topPaymentMethod,
      visibleExpenses
    },
    setters: {
      setActivePanel,
      setActivePicker,
      setCategory,
      setCardsError,
      setCreditCardId,
      setCreditCards,
      setEditError,
      setEditingExpense,
      setExpenses,
      setInput,
      setIsEditingExpense,
      setIsMenuOpen,
      setLastActionMessage,
      setLastSavedExpense,
      setNotificationPermission,
      setPaymentMethod,
      setPreferences,
      setSelectedFilter,
      setSwipedExpenseId,
      setSyncError,
      setSyncStatus
    }
  };
}
