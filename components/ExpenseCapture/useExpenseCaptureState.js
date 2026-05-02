import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getNotificationPermission, scheduleDailyExpenseReminder } from "../../lib/notificationReminders";
import { loadCreditCards } from "../../lib/cardsRepository";
import { isSupabaseConfigured } from "../../lib/supabaseClient";
import { isToday, loadExpenses, saveExpenses } from "../../lib/expensesStorage";
import { getCurrentExpenseLocation } from "../../lib/locationCapture";
import { loadRemoteParserLearning, retryPendingExpenses } from "../../lib/expensesRepository";
import { applyLocalParserLearning } from "../../lib/parserLearningStorage";
import { ensurePushSubscription, getPushReadiness } from "../../lib/pushNotifications";
import { resolveNearbyPlace } from "../../lib/placeResolver";
import { loadUserProfile } from "../../lib/profileRepository";
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
  const [syncMetrics, setSyncMetrics] = useState({
    lastSyncedAt: "",
    pendingCount: 0,
    remoteCount: 0
  });
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
    reminderMode: "scheduled",
    reminderTime: "20:00",
    reminderTone: "tranqui",
    swipeSaveEnabled: true,
    vibrationEnabled: true
  });
  const [userProfile, setUserProfile] = useState({ monthlyIncome: 0, currency: "ARS", updatedAt: "" });
  const [profileSource, setProfileSource] = useState("local");
  const [profileError, setProfileError] = useState("");
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [notificationPushStatus, setNotificationPushStatus] = useState("idle");
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
      .then(async (result) => {
        loadRemoteParserLearning().catch(() => null);
        if (result?.expenses) {
          setExpenses(result.expenses);
        }
        setSyncMetrics((current) => ({
          ...current,
          lastSyncedAt: new Date().toISOString(),
          pendingCount: result?.metrics?.pendingCount || 0,
          remoteCount: result?.metrics?.remoteCount || 0
        }));
        setSyncStatus("synced");
      })
      .catch((error) => {
        initialSyncUserRef.current = null;
        setSyncStatus("error");
        setSyncError(error?.message || "No se pudo sincronizar.");
      });
  }, [expenses, isLoaded, isSessionLoading, router, user]);

  useEffect(() => {
    if (!isLoaded || !user || !isSupabaseConfigured || syncStatus !== "synced") {
      return;
    }

    const pendingExpenses = expenses.filter((expense) => ["pending", "error"].includes(expense.syncState));
    if (pendingExpenses.length === 0) {
      setSyncMetrics((current) => ({ ...current, pendingCount: 0 }));
      return;
    }

    let isCancelled = false;
    setSyncStatus("syncing");
    retryPendingExpenses(pendingExpenses)
      .then((result) => {
        if (isCancelled) {
          return;
        }

        const now = new Date().toISOString();
        setExpenses((current) =>
          current.map((expense) => {
            if (result.syncedIds.includes(expense.id)) {
              return { ...expense, syncState: "synced", lastSyncError: "", syncedAt: now };
            }
            const failure = result.failed.find((item) => item.id === expense.id);
            return failure ? { ...expense, syncState: "error", lastSyncError: failure.message } : expense;
          })
        );
        setSyncMetrics((current) => ({
          ...current,
          lastSyncedAt: result.syncedIds.length > 0 ? now : current.lastSyncedAt,
          pendingCount: result.failed.length
        }));
        setSyncStatus(result.failed.length > 0 ? "error" : "synced");
        setSyncError(result.failed[0]?.message || "");
      })
      .catch((error) => {
        if (!isCancelled) {
          setSyncStatus("error");
          setSyncError(error?.message || "No se pudo reintentar la sincronizacion.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [expenses, isLoaded, syncStatus, user]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const pendingCount = expenses.filter((expense) => ["pending", "error"].includes(expense.syncState)).length;
    console.info("[Payly sync]", {
      user_id: user?.id || null,
      local_expenses: expenses.length,
      remote_expenses: syncMetrics.remoteCount,
      pending_sync: pendingCount,
      last_error: syncError || null,
      last_success_at: syncMetrics.lastSyncedAt || null
    });
  }, [expenses.length, syncError, syncMetrics.lastSyncedAt, syncMetrics.remoteCount, user?.id]);

  useEffect(() => {
    if (isLoaded) {
      saveExpenses(expenses);
    }
  }, [expenses, isLoaded]);

  useEffect(() => {
    if (!isLoaded || isSessionLoading) {
      return;
    }

    let isCancelled = false;
    loadUserProfile()
      .then((result) => {
        if (!isCancelled) {
          setUserProfile(result.profile);
          setProfileSource(result.source);
          setProfileError("");
          setPreferences((current) => ({
            ...current,
            notificationsEnabled: result.profile.reminderEnabled || current.notificationsEnabled,
            reminderMode: result.profile.reminderMode === "all_day" ? "allDay" : "scheduled",
            reminderTime: result.profile.reminderTime || current.reminderTime,
            reminderTone: result.profile.reminderTone || current.reminderTone,
            reminderHour: Number((result.profile.reminderTime || current.reminderTime || "20:00").split(":")[0]) || current.reminderHour
          }));
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setProfileError(error?.message || "No se pudo cargar el perfil.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isLoaded, isSessionLoading, user?.id]);

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
      mode: preferences.reminderMode,
      name: getFirstName(user),
      time: preferences.reminderTime,
      tone: preferences.reminderTone
    });

    return cleanup;
  }, [preferences.notificationsEnabled, preferences.reminderHour, preferences.reminderMode, preferences.reminderTime, preferences.reminderTone, todayExpenses.length, user]);

  useEffect(() => {
    if (!isLoaded || !preferences.notificationsEnabled || notificationPermission !== "granted") {
      return;
    }

    const canReconnectPush = ["idle", "subscribed_local", "push_error"].includes(notificationPushStatus);
    if (getPushReadiness() !== "ready" || notificationPushStatus === "subscribed_remote" || !canReconnectPush) {
      return;
    }

    let isCancelled = false;
    setNotificationPushStatus("connecting");
    ensurePushSubscription()
      .then((result) => {
        if (!isCancelled) {
          setNotificationPushStatus(result.status);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setNotificationPushStatus(error?.message || "push_error");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [isLoaded, notificationPermission, notificationPushStatus, preferences.notificationsEnabled, user?.id]);

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
      notificationPushStatus,
      preferences,
      profileError,
      profileSource,
      preview,
      selectedFilter,
      swipedExpenseId,
      syncError,
      syncMetrics,
      syncStatus,
      todayExpenses,
      todayInsight,
      todayTotal,
      topCategory,
      topExpense,
      topPaymentMethod,
      userProfile,
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
      setNotificationPushStatus,
      setPaymentMethod,
      setPreferences,
      setProfileError,
      setProfileSource,
      setSelectedFilter,
      setSwipedExpenseId,
      setSyncError,
      setSyncMetrics,
      setSyncStatus,
      setUserProfile
    }
  };
}
