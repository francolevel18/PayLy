import { categories } from "./expenseParser.js";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const localBudgetsKey = "payly.budgets.v1";

export const defaultBudgets = {
  food: 80000,
  market: 120000,
  transport: 50000,
  home: 140000,
  health: 45000,
  services: 60000,
  leisure: 90000,
  other: 40000
};

export function getCurrentBudgetMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export async function loadBudgets(periodMonth = getCurrentBudgetMonth()) {
  const localBudgets = loadLocalBudgets(periodMonth);
  const localSource = hasStoredBudgets(periodMonth) ? "local" : "default";
  if (!isSupabaseConfigured) {
    return { budgets: localBudgets, source: localSource };
  }

  const userId = await getUserId();
  if (!userId) {
    return { budgets: localBudgets, source: localSource };
  }

  try {
    const { data, error } = await supabase
      .from("budgets")
      .select("category_key, amount")
      .eq("user_id", userId)
      .eq("period_month", periodMonth)
      .eq("is_active", true);

    if (error) {
      throw error;
    }

    const remoteBudgets = normalizeBudgets(
      (data || []).reduce((result, budget) => {
        result[budget.category_key] = budget.amount;
        return result;
      }, {})
    );

    if ((data || []).length > 0) {
      saveLocalBudgets(remoteBudgets, periodMonth);
      return { budgets: remoteBudgets, source: "remote" };
    }
  } catch {
    return { budgets: localBudgets, source: localSource };
  }

  return { budgets: localBudgets, source: localSource };
}

export async function saveBudget(categoryKey, amount, periodMonth = getCurrentBudgetMonth()) {
  if (!categories.includes(categoryKey)) {
    throw new Error("Categoria invalida para presupuesto.");
  }

  const safeAmount = Math.max(0, Number(amount) || 0);
  const localBudgets = {
    ...loadLocalBudgets(periodMonth),
    [categoryKey]: safeAmount
  };
  saveLocalBudgets(localBudgets, periodMonth);

  if (!isSupabaseConfigured) {
    return { budgets: localBudgets, source: "local" };
  }

  const userId = await getUserId();
  if (!userId) {
    return { budgets: localBudgets, source: "local" };
  }

  try {
    await saveRemoteBudget({ amount: safeAmount, categoryKey, periodMonth, userId });

    return { budgets: localBudgets, source: "remote" };
  } catch {
    return { budgets: localBudgets, source: "local" };
  }
}

async function saveRemoteBudget({ amount, categoryKey, periodMonth, userId }) {
  const { data: existing, error: selectError } = await supabase
    .from("budgets")
    .select("id")
    .eq("user_id", userId)
    .eq("category_key", categoryKey)
    .eq("period_month", periodMonth)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  const payload = {
    user_id: userId,
    category_key: categoryKey,
    amount,
    currency: "ARS",
    period_month: periodMonth,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  const query = existing?.id
    ? supabase.from("budgets").update(payload).eq("id", existing.id)
    : supabase.from("budgets").insert(payload);

  const { error } = await query;
  if (error) {
    throw error;
  }
}

function loadLocalBudgets(periodMonth) {
  if (typeof window === "undefined") {
    return defaultBudgets;
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(localBudgetsKey) || "{}");
    if (hasBudgetShape(stored)) {
      return normalizeBudgets(stored);
    }

    return normalizeBudgets(stored?.[periodMonth] || {});
  } catch {
    return defaultBudgets;
  }
}

function saveLocalBudgets(budgets, periodMonth) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(localBudgetsKey) || "{}");
    const next = hasBudgetShape(stored) ? {} : stored;
    next[periodMonth] = normalizeBudgets(budgets);
    window.localStorage.setItem(localBudgetsKey, JSON.stringify(next));
  } catch {
    // Local fallback can fail in private mode.
  }
}

function normalizeBudgets(budgets) {
  return categories.reduce((result, category) => {
    result[category] = Math.max(0, Number(budgets?.[category] ?? defaultBudgets[category] ?? 0) || 0);
    return result;
  }, {});
}

function hasBudgetShape(value) {
  return Boolean(value && typeof value === "object" && categories.some((category) => category in value));
}

function hasStoredBudgets(periodMonth) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const stored = JSON.parse(window.localStorage.getItem(localBudgetsKey) || "{}");
    return hasBudgetShape(stored) || hasBudgetShape(stored?.[periodMonth]);
  } catch {
    return false;
  }
}

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}
