import { isSupabaseConfigured, supabase } from "./supabaseClient";

const localCardsKey = "payly.creditCards";

export async function loadCreditCards(expenses = []) {
  const remoteCards = await loadRemoteCreditCards();
  const cards = remoteCards.length > 0 ? remoteCards : loadLocalCreditCards();
  return cards.map((card) => buildCardSummary(card, expenses));
}

export function loadLocalCreditCards() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = JSON.parse(window.localStorage.getItem(localCardsKey)) || [];
    return normalizeCards(saved);
  } catch {
    return [];
  }
}

export function saveLocalCreditCards(cards) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(localCardsKey, JSON.stringify(normalizeCards(cards)));
  } catch {
    // localStorage can fail in private mode or when quota is full.
  }
}

export async function createCreditCard(card) {
  const normalized = normalizeCard({ ...card, id: card.id || crypto.randomUUID() });
  if (!isSupabaseConfigured) {
    saveLocalCreditCards([normalized, ...loadLocalCreditCards()]);
    return normalized;
  }

  const userId = await getUserId();
  if (!userId) {
    saveLocalCreditCards([normalized, ...loadLocalCreditCards()]);
    return normalized;
  }

  const { data, error } = await supabase
    .from("credit_cards")
    .insert(toRemoteCard(normalized, userId))
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return fromRemoteCard(data);
}

export async function updateCreditCard(card) {
  const normalized = normalizeCard(card);
  if (!isSupabaseConfigured) {
    saveLocalCreditCards(loadLocalCreditCards().map((item) => (item.id === normalized.id ? normalized : item)));
    return normalized;
  }

  const userId = await getUserId();
  if (!userId) {
    saveLocalCreditCards(loadLocalCreditCards().map((item) => (item.id === normalized.id ? normalized : item)));
    return normalized;
  }

  const { data, error } = await supabase
    .from("credit_cards")
    .update(toRemoteCard(normalized, userId))
    .eq("id", normalized.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return fromRemoteCard(data);
}

export async function deleteCreditCard(id) {
  if (!isSupabaseConfigured) {
    saveLocalCreditCards(loadLocalCreditCards().filter((card) => card.id !== id));
    return;
  }

  const userId = await getUserId();
  if (!userId) {
    saveLocalCreditCards(loadLocalCreditCards().filter((card) => card.id !== id));
    return;
  }

  const { error } = await supabase.from("credit_cards").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

export function loadCardMovements(expenses, cardId) {
  return expenses.filter((expense) => expense.creditCardId === cardId);
}

export function getCardSummary(card, expenses) {
  return buildCardSummary(card, expenses);
}

async function loadRemoteCreditCards() {
  if (!isSupabaseConfigured) {
    return [];
  }

  const userId = await getUserId();
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("credit_cards")
    .select("id, name, brand, bank_name, last_four, credit_limit, closing_day, due_day, is_active, created_at, updated_at")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return normalizeCards((data || []).map(fromRemoteCard));
}

function buildCardSummary(card, expenses) {
  const today = new Date();
  const cardExpenses = expenses.filter((expense) => expense.creditCardId === card.id);
  const currentBalance = cardExpenses
    .filter((expense) => isInCurrentStatement(expense.createdAt, card.closingDay, today))
    .reduce((total, expense) => total + expense.amount, 0);
  const availableLimit = Math.max(card.creditLimit - currentBalance, 0);
  const usagePercentage = card.creditLimit > 0 ? Math.min(Math.round((currentBalance / card.creditLimit) * 100), 100) : 0;
  const daysToClose = getDaysUntilDay(card.closingDay, today);
  const daysToDue = getDaysUntilDay(card.dueDay, today);

  return {
    ...card,
    currentBalance,
    availableLimit,
    usagePercentage,
    status: daysToClose === 0 ? "cerrada" : "abierta",
    daysToClose,
    daysToDue
  };
}

function isInCurrentStatement(value, closingDay, today) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const start = new Date(today.getFullYear(), today.getMonth(), Math.min(closingDay, 28) + 1);
  if (today.getDate() <= closingDay) {
    start.setMonth(start.getMonth() - 1);
  }
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  return date >= start && date < end;
}

function getDaysUntilDay(day, today) {
  const target = new Date(today.getFullYear(), today.getMonth(), Math.min(day, 28));
  if (target < today) {
    target.setMonth(target.getMonth() + 1);
  }

  return Math.max(0, Math.ceil((target - today) / (24 * 60 * 60 * 1000)));
}

function normalizeCards(cards) {
  if (!Array.isArray(cards)) {
    return [];
  }

  return cards.map(normalizeCard).filter(Boolean);
}

function normalizeCard(card) {
  if (!card || typeof card !== "object") {
    return null;
  }

  return {
    id: typeof card.id === "string" && card.id ? card.id : crypto.randomUUID(),
    name: typeof card.name === "string" && card.name ? card.name : "Tarjeta",
    brand: ["visa", "mastercard", "amex", "other"].includes(card.brand) ? card.brand : "other",
    bankName: typeof card.bankName === "string" ? card.bankName : "",
    lastFour: typeof card.lastFour === "string" ? card.lastFour : "",
    creditLimit: Number(card.creditLimit) || 0,
    closingDay: normalizeDay(card.closingDay, 20),
    dueDay: normalizeDay(card.dueDay, 10),
    isActive: card.isActive !== false,
    createdAt: typeof card.createdAt === "string" ? card.createdAt : new Date().toISOString(),
    updatedAt: typeof card.updatedAt === "string" ? card.updatedAt : new Date().toISOString()
  };
}

function normalizeDay(value, fallback) {
  const day = Number(value);
  if (!Number.isFinite(day)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(day), 1), 28);
}

function fromRemoteCard(card) {
  return {
    id: card.id,
    name: card.name,
    brand: card.brand,
    bankName: card.bank_name,
    lastFour: card.last_four,
    creditLimit: card.credit_limit,
    closingDay: card.closing_day,
    dueDay: card.due_day,
    isActive: card.is_active,
    createdAt: card.created_at,
    updatedAt: card.updated_at
  };
}

function toRemoteCard(card, userId) {
  return {
    id: card.id,
    user_id: userId,
    name: card.name,
    brand: card.brand,
    bank_name: card.bankName,
    last_four: card.lastFour,
    credit_limit: card.creditLimit,
    closing_day: card.closingDay,
    due_day: card.dueDay,
    is_active: card.isActive,
    updated_at: new Date().toISOString()
  };
}

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}
