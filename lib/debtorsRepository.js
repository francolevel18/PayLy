import { isSupabaseConfigured, supabase } from "./supabaseClient";

const localDebtorsKey = "payly.debtors.v1";

export async function loadDebtors() {
  const localDebtors = loadLocalDebtors();
  if (!isSupabaseConfigured) {
    return localDebtors;
  }

  const userId = await getUserId();
  if (!userId) {
    return localDebtors;
  }

  try {
    const { data, error } = await supabase
      .from("debtors")
      .select("id, name, phone, avatar_url, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const debtors = normalizeDebtors((data || []).map(fromRemoteDebtor));
    saveLocalDebtors(debtors);
    return debtors;
  } catch {
    return localDebtors;
  }
}

export async function createDebtor({ name, phone = "", avatarUrl = "" }) {
  const debtor = normalizeDebtor({
    id: crypto.randomUUID(),
    name,
    phone,
    avatarUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const localDebtors = [debtor, ...loadLocalDebtors().filter((item) => item.id !== debtor.id)];
  saveLocalDebtors(localDebtors);

  if (!isSupabaseConfigured) {
    return debtor;
  }

  const userId = await getUserId();
  if (!userId) {
    return debtor;
  }

  try {
    const { data, error } = await supabase
      .from("debtors")
      .insert(toRemoteDebtor(debtor, userId))
      .select("id, name, phone, avatar_url, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return normalizeDebtor(fromRemoteDebtor(data));
  } catch {
    return debtor;
  }
}

export async function updateDebtor(debtor) {
  const normalized = normalizeDebtor({ ...debtor, updatedAt: new Date().toISOString() });
  saveLocalDebtors(loadLocalDebtors().map((item) => (item.id === normalized.id ? normalized : item)));

  if (!isSupabaseConfigured) {
    return normalized;
  }

  const userId = await getUserId();
  if (!userId) {
    return normalized;
  }

  try {
    const { data, error } = await supabase
      .from("debtors")
      .update(toRemoteDebtor(normalized, userId))
      .eq("id", normalized.id)
      .select("id, name, phone, avatar_url, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return normalizeDebtor(fromRemoteDebtor(data));
  } catch {
    return normalized;
  }
}

export async function deleteDebtor(id) {
  saveLocalDebtors(loadLocalDebtors().filter((debtor) => debtor.id !== id));

  if (!isSupabaseConfigured) {
    return;
  }

  const userId = await getUserId();
  if (!userId) {
    return;
  }

  try {
    const { error } = await supabase.from("debtors").delete().eq("id", id);
    if (error) {
      throw error;
    }
  } catch {
    // Local fallback already applied.
  }
}

export function loadLocalDebtors() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return normalizeDebtors(JSON.parse(window.localStorage.getItem(localDebtorsKey) || "[]"));
  } catch {
    return [];
  }
}

export function saveLocalDebtors(debtors) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(localDebtorsKey, JSON.stringify(normalizeDebtors(debtors)));
  } catch {
    // Local fallback can fail in private mode.
  }
}

function normalizeDebtors(debtors) {
  if (!Array.isArray(debtors)) {
    return [];
  }

  return debtors.map(normalizeDebtor).filter(Boolean);
}

function normalizeDebtor(debtor) {
  if (!debtor || typeof debtor !== "object") {
    return null;
  }

  const name = String(debtor.name || "").trim();
  if (!name) {
    return null;
  }

  return {
    id: typeof debtor.id === "string" && debtor.id ? debtor.id : crypto.randomUUID(),
    name,
    phone: normalizePhone(debtor.phone),
    avatarUrl: typeof debtor.avatarUrl === "string" ? debtor.avatarUrl : "",
    createdAt: typeof debtor.createdAt === "string" ? debtor.createdAt : new Date().toISOString(),
    updatedAt: typeof debtor.updatedAt === "string" ? debtor.updatedAt : new Date().toISOString()
  };
}

function fromRemoteDebtor(debtor) {
  return {
    id: debtor.id,
    name: debtor.name,
    phone: debtor.phone,
    avatarUrl: debtor.avatar_url,
    createdAt: debtor.created_at,
    updatedAt: debtor.updated_at
  };
}

function toRemoteDebtor(debtor, userId) {
  return {
    id: debtor.id,
    user_id: userId,
    name: debtor.name,
    phone: debtor.phone,
    avatar_url: debtor.avatarUrl || null,
    updated_at: new Date().toISOString()
  };
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}
