import { isSupabaseConfigured, supabase } from "./supabaseClient";

const localProfileKey = "payly.userProfile.v1";

export async function loadUserProfile() {
  const localProfile = loadLocalProfile();
  if (!isSupabaseConfigured) {
    return { profile: localProfile, source: "local" };
  }

  const userId = await getUserId();
  if (!userId) {
    return { profile: localProfile, source: "local" };
  }

  try {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, monthly_income, currency, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      const profile = fromRemoteProfile(data);
      saveLocalProfile(profile);
      return { profile, source: "remote" };
    }
  } catch {
    return { profile: localProfile, source: "local" };
  }

  return { profile: localProfile, source: "local" };
}

export async function upsertUserProfile({ monthlyIncome = 0, currency = "ARS" }) {
  const profile = normalizeProfile({ monthlyIncome, currency, updatedAt: new Date().toISOString() });
  saveLocalProfile(profile);

  if (!isSupabaseConfigured) {
    return { profile, source: "local" };
  }

  const userId = await getUserId();
  if (!userId) {
    return { profile, source: "local" };
  }

  try {
    const { data: existing, error: selectError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    const payload = {
      user_id: userId,
      monthly_income: profile.monthlyIncome,
      currency: profile.currency,
      updated_at: profile.updatedAt
    };

    const query = existing?.id
      ? supabase.from("user_profiles").update(payload).eq("id", existing.id)
      : supabase.from("user_profiles").insert(payload);

    const { data, error } = await query.select("id, monthly_income, currency, updated_at").single();
    if (error) {
      throw error;
    }

    const remoteProfile = fromRemoteProfile(data);
    saveLocalProfile(remoteProfile);
    return { profile: remoteProfile, source: "remote" };
  } catch {
    return { profile, source: "local" };
  }
}

export function updateMonthlyIncome(amount) {
  return upsertUserProfile({ monthlyIncome: amount, currency: "ARS" });
}

function loadLocalProfile() {
  if (typeof window === "undefined") {
    return normalizeProfile();
  }

  try {
    return normalizeProfile(JSON.parse(window.localStorage.getItem(localProfileKey) || "{}"));
  } catch {
    return normalizeProfile();
  }
}

function saveLocalProfile(profile) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(localProfileKey, JSON.stringify(normalizeProfile(profile)));
  } catch {
    // Local fallback can fail in private mode.
  }
}

function normalizeProfile(profile = {}) {
  return {
    monthlyIncome: Math.max(0, Number(profile.monthlyIncome) || 0),
    currency: typeof profile.currency === "string" && profile.currency ? profile.currency : "ARS",
    updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : ""
  };
}

function fromRemoteProfile(profile) {
  return normalizeProfile({
    monthlyIncome: profile.monthly_income,
    currency: profile.currency,
    updatedAt: profile.updated_at
  });
}

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}
