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
      .select("id, monthly_income, currency, reminder_enabled, reminder_mode, reminder_time, reminder_timezone, reminder_tone, last_reminder_sent_at, updated_at")
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
  } catch (error) {
    logProfileError(error);
    return { profile: localProfile, source: "local" };
  }

  return { profile: localProfile, source: "local" };
}

export async function upsertUserProfile(profileInput = {}) {
  const currentProfile = loadLocalProfile();
  const profile = normalizeProfile({ ...currentProfile, ...profileInput, updatedAt: new Date().toISOString() });
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
      .select("id, monthly_income, currency, reminder_enabled, reminder_mode, reminder_time, reminder_timezone, reminder_tone, last_reminder_sent_at, updated_at")
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
      reminder_enabled: profile.reminderEnabled,
      reminder_mode: profile.reminderMode,
      reminder_time: profile.reminderTime,
      reminder_timezone: profile.reminderTimezone,
      reminder_tone: profile.reminderTone,
      updated_at: profile.updatedAt
    };

    const query = existing?.id
      ? supabase.from("user_profiles").update(payload).eq("id", existing.id)
      : supabase.from("user_profiles").insert(payload);

    const { data, error } = await query
      .select("id, monthly_income, currency, reminder_enabled, reminder_mode, reminder_time, reminder_timezone, reminder_tone, last_reminder_sent_at, updated_at")
      .single();
    if (error) {
      throw error;
    }

    const remoteProfile = fromRemoteProfile(data);
    saveLocalProfile(remoteProfile);
    return { profile: remoteProfile, source: "remote" };
  } catch (error) {
    logProfileError(error);
    return { profile, source: "local" };
  }
}

export function updateMonthlyIncome(amount) {
  return upsertUserProfile({ monthlyIncome: amount, currency: "ARS" });
}

export function updateReminderSettings({ enabled, mode, time, timezone, tone }) {
  return upsertUserProfile({
    reminderEnabled: Boolean(enabled),
    reminderMode: mode === "all_day" ? "all_day" : "exact_time",
    reminderTime: normalizeTime(time),
    reminderTimezone: timezone || getBrowserTimezone(),
    reminderTone: normalizeTone(tone)
  });
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
    reminderEnabled: Boolean(profile.reminderEnabled),
    reminderMode: profile.reminderMode === "all_day" ? "all_day" : "exact_time",
    reminderTime: normalizeTime(profile.reminderTime),
    reminderTimezone: profile.reminderTimezone || getBrowserTimezone(),
    reminderTone: normalizeTone(profile.reminderTone),
    lastReminderSentAt: typeof profile.lastReminderSentAt === "string" ? profile.lastReminderSentAt : "",
    updatedAt: typeof profile.updatedAt === "string" ? profile.updatedAt : ""
  };
}

function fromRemoteProfile(profile) {
  return normalizeProfile({
    monthlyIncome: profile.monthly_income,
    currency: profile.currency,
    reminderEnabled: profile.reminder_enabled,
    reminderMode: profile.reminder_mode,
    reminderTime: profile.reminder_time,
    reminderTimezone: profile.reminder_timezone,
    reminderTone: profile.reminder_tone,
    lastReminderSentAt: profile.last_reminder_sent_at,
    updatedAt: profile.updated_at
  });
}

function normalizeTime(time) {
  return /^\d{2}:\d{2}$/.test(String(time || "")) ? time : "20:00";
}

function normalizeTone(tone) {
  if (tone === "cercano") {
    return "tranqui";
  }

  return ["tranqui", "picante", "corto"].includes(tone) ? tone : "tranqui";
}

function getBrowserTimezone() {
  if (typeof Intl === "undefined") {
    return "America/Argentina/Buenos_Aires";
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Argentina/Buenos_Aires";
}

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}

function logProfileError(error) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("No se pudo sincronizar user_profiles.", error?.message || error);
  }
}
