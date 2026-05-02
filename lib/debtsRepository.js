import { loadLocalDebtors } from "./debtorsRepository";
import { isSupabaseConfigured, supabase } from "./supabaseClient";

const localDebtsKey = "payly.debts.v1";

export async function loadDebts() {
  const localDebts = attachLocalDebtors(loadLocalDebts());
  if (!isSupabaseConfigured) {
    return localDebts;
  }

  const userId = await getUserId();
  if (!userId) {
    return localDebts;
  }

  try {
    const { data, error } = await supabase
      .from("debts")
      .select("id, debtor_id, amount, description, due_date, status, paid_at, created_at, updated_at, debtors(id, name, phone, avatar_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const debts = normalizeDebts((data || []).map(fromRemoteDebt));
    saveLocalDebts(debts);
    return debts;
  } catch {
    return localDebts;
  }
}

export async function createDebt({ debtorId, amount, description, dueDate = null }) {
  const debt = normalizeDebt({
    id: crypto.randomUUID(),
    debtorId,
    amount,
    description,
    dueDate,
    status: "pending",
    paidAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const localDebts = [debt, ...loadLocalDebts().filter((item) => item.id !== debt.id)];
  saveLocalDebts(localDebts);

  if (!isSupabaseConfigured) {
    return attachLocalDebtor(debt);
  }

  const userId = await getUserId();
  if (!userId) {
    return attachLocalDebtor(debt);
  }

  try {
    const { data, error } = await supabase
      .from("debts")
      .insert(toRemoteDebt(debt, userId))
      .select("id, debtor_id, amount, description, due_date, status, paid_at, created_at, updated_at, debtors(id, name, phone, avatar_url)")
      .single();

    if (error) {
      throw error;
    }

    return normalizeDebt(fromRemoteDebt(data));
  } catch {
    return attachLocalDebtor(debt);
  }
}

export async function updateDebt(debt) {
  const normalized = normalizeDebt({ ...debt, updatedAt: new Date().toISOString() });
  saveLocalDebts(loadLocalDebts().map((item) => (item.id === normalized.id ? normalized : item)));

  if (!isSupabaseConfigured) {
    return attachLocalDebtor(normalized);
  }

  const userId = await getUserId();
  if (!userId) {
    return attachLocalDebtor(normalized);
  }

  try {
    const { data, error } = await supabase
      .from("debts")
      .update(toRemoteDebt(normalized, userId))
      .eq("id", normalized.id)
      .select("id, debtor_id, amount, description, due_date, status, paid_at, created_at, updated_at, debtors(id, name, phone, avatar_url)")
      .single();

    if (error) {
      throw error;
    }

    return normalizeDebt(fromRemoteDebt(data));
  } catch {
    return attachLocalDebtor(normalized);
  }
}

export async function markDebtAsPaid(id) {
  const paidAt = new Date().toISOString();
  const localDebt = loadLocalDebts().find((debt) => debt.id === id);
  if (!localDebt) {
    return null;
  }

  const nextDebt = { ...localDebt, status: "paid", paidAt, updatedAt: paidAt };
  saveLocalDebts(loadLocalDebts().map((debt) => (debt.id === id ? nextDebt : debt)));

  if (!isSupabaseConfigured) {
    return attachLocalDebtor(nextDebt);
  }

  const userId = await getUserId();
  if (!userId) {
    return attachLocalDebtor(nextDebt);
  }

  try {
    const { data, error } = await supabase
      .from("debts")
      .update({ status: "paid", paid_at: paidAt, updated_at: paidAt })
      .eq("id", id)
      .select("id, debtor_id, amount, description, due_date, status, paid_at, created_at, updated_at, debtors(id, name, phone, avatar_url)")
      .single();

    if (error) {
      throw error;
    }

    return normalizeDebt(fromRemoteDebt(data));
  } catch {
    return attachLocalDebtor(nextDebt);
  }
}

export async function deleteDebt(id) {
  saveLocalDebts(loadLocalDebts().filter((debt) => debt.id !== id));

  if (!isSupabaseConfigured) {
    return;
  }

  const userId = await getUserId();
  if (!userId) {
    return;
  }

  try {
    const { error } = await supabase.from("debts").delete().eq("id", id);
    if (error) {
      throw error;
    }
  } catch {
    // Local fallback already applied.
  }
}

export function loadLocalDebts() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return normalizeDebts(JSON.parse(window.localStorage.getItem(localDebtsKey) || "[]"));
  } catch {
    return [];
  }
}

function saveLocalDebts(debts) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(localDebtsKey, JSON.stringify(normalizeDebts(debts)));
  } catch {
    // Local fallback can fail in private mode.
  }
}

function normalizeDebts(debts) {
  if (!Array.isArray(debts)) {
    return [];
  }

  return debts.map(normalizeDebt).filter(Boolean).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function normalizeDebt(debt) {
  if (!debt || typeof debt !== "object") {
    return null;
  }

  const amount = Number(debt.amount);
  if (!Number.isFinite(amount) || amount <= 0 || !debt.debtorId) {
    return null;
  }

  return {
    id: typeof debt.id === "string" && debt.id ? debt.id : crypto.randomUUID(),
    debtorId: debt.debtorId,
    amount,
    description: String(debt.description || "Deuda").trim() || "Deuda",
    dueDate: typeof debt.dueDate === "string" && debt.dueDate ? debt.dueDate : null,
    status: debt.status === "paid" ? "paid" : "pending",
    paidAt: typeof debt.paidAt === "string" && debt.paidAt ? debt.paidAt : null,
    createdAt: typeof debt.createdAt === "string" ? debt.createdAt : new Date().toISOString(),
    updatedAt: typeof debt.updatedAt === "string" ? debt.updatedAt : new Date().toISOString(),
    debtor: debt.debtor || null
  };
}

function attachLocalDebtors(debts) {
  return debts.map(attachLocalDebtor);
}

function attachLocalDebtor(debt) {
  const debtor = loadLocalDebtors().find((item) => item.id === debt.debtorId);
  return debtor ? { ...debt, debtor } : debt;
}

function fromRemoteDebt(debt) {
  return {
    id: debt.id,
    debtorId: debt.debtor_id,
    amount: debt.amount,
    description: debt.description,
    dueDate: debt.due_date,
    status: debt.status,
    paidAt: debt.paid_at,
    createdAt: debt.created_at,
    updatedAt: debt.updated_at,
    debtor: debt.debtors
      ? {
          id: debt.debtors.id,
          name: debt.debtors.name,
          phone: debt.debtors.phone,
          avatarUrl: debt.debtors.avatar_url
        }
      : null
  };
}

function toRemoteDebt(debt, userId) {
  return {
    id: debt.id,
    user_id: userId,
    debtor_id: debt.debtorId,
    amount: debt.amount,
    description: debt.description,
    due_date: debt.dueDate,
    status: debt.status,
    paid_at: debt.paidAt,
    updated_at: new Date().toISOString()
  };
}

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}
