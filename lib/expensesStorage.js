import { categories, paymentMethods } from "./expenseParser.js";

const storageKey = "payly.expenses";
const migrationKeyPrefix = "payly.migrated.";

export function loadExpenses() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = window.localStorage.getItem(storageKey);
    return normalizeExpenses(saved ? JSON.parse(saved) : []);
  } catch {
    return [];
  }
}

export function saveExpenses(expenses) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(normalizeExpenses(expenses)));
  } catch {
    // localStorage can fail in private mode or when quota is full.
  }
}

export function clearExpenses() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // localStorage can fail in private mode.
  }
}

export function hasMigratedExpenses(userId) {
  if (typeof window === "undefined" || !userId) {
    return false;
  }

  try {
    return window.localStorage.getItem(`${migrationKeyPrefix}${userId}`) === "true";
  } catch {
    return false;
  }
}

export function markExpensesMigrated(userId) {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    window.localStorage.setItem(`${migrationKeyPrefix}${userId}`, "true");
  } catch {
    // localStorage can fail in private mode or when quota is full.
  }
}

export function isToday(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function normalizeExpenses(expenses) {
  if (!Array.isArray(expenses)) {
    return [];
  }

  return expenses
    .map(normalizeExpense)
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function normalizeExpense(expense) {
  if (!expense || typeof expense !== "object") {
    return null;
  }

  const amount = Number(expense.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const createdAt = new Date(expense.createdAt);
  const category = categories.includes(expense.category) ? expense.category : "other";
  const paymentMethod = paymentMethods.includes(expense.paymentMethod) ? expense.paymentMethod : "cash";

  return {
    id: typeof expense.id === "string" && expense.id ? expense.id : crypto.randomUUID(),
    amount,
    category,
    paymentMethod,
    description: typeof expense.description === "string" && expense.description ? expense.description : "Gasto rapido",
    rawText: typeof expense.rawText === "string" ? expense.rawText : "",
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date().toISOString() : createdAt.toISOString()
  };
}
