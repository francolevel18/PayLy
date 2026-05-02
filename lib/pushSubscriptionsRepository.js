import { isSupabaseConfigured, supabase } from "./supabaseClient";

const localPushSubscriptionKey = "payly.pushSubscription.v1";

export async function savePushSubscription(subscription, metadata = {}) {
  const normalized = normalizeSubscription(subscription);
  saveLocalPushSubscription(normalized);

  if (!isSupabaseConfigured) {
    return { source: "local" };
  }

  const userId = await getUserId();
  if (!userId) {
    return { source: "local" };
  }

  try {
    const payload = {
      user_id: userId,
      endpoint: normalized.endpoint,
      p256dh: normalized.keys?.p256dh || "",
      auth: normalized.keys?.auth || "",
      user_agent: metadata.userAgent || "",
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const { data: existing, error: selectError } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("endpoint", normalized.endpoint)
      .limit(1)
      .maybeSingle();

    if (selectError) {
      throw selectError;
    }

    await writePushSubscription(existing?.id, payload, normalized);

    return { source: "remote" };
  } catch (error) {
    logPushSubscriptionError(error);
    return { source: "local" };
  }
}

export async function disablePushSubscription(subscription) {
  const normalized = subscription ? normalizeSubscription(subscription) : loadLocalPushSubscription();
  clearLocalPushSubscription();

  if (!normalized?.endpoint || !isSupabaseConfigured) {
    return { source: "local" };
  }

  const userId = await getUserId();
  if (!userId) {
    return { source: "local" };
  }

  try {
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("endpoint", normalized.endpoint);

    if (error) {
      throw error;
    }

    return { source: "remote" };
  } catch (error) {
    logPushSubscriptionError(error);
    return { source: "local" };
  }
}

export function loadLocalPushSubscription() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return JSON.parse(window.localStorage.getItem(localPushSubscriptionKey) || "null");
  } catch {
    return null;
  }
}

function saveLocalPushSubscription(subscription) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(localPushSubscriptionKey, JSON.stringify(subscription));
  } catch {
    // Local fallback can fail in private mode.
  }
}

function clearLocalPushSubscription() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(localPushSubscriptionKey);
  } catch {
    // Local fallback can fail in private mode.
  }
}

function normalizeSubscription(subscription) {
  if (!subscription) {
    return null;
  }

  return typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;
}

async function writePushSubscription(existingId, payload, normalizedSubscription) {
  const query = existingId
    ? supabase.from("push_subscriptions").update(payload).eq("id", existingId)
    : supabase.from("push_subscriptions").insert(payload);

  const { error } = await query;
  if (!error) {
    return;
  }

  if (isMissingColumnError(error)) {
    const compatiblePayload = getCompatiblePayload(payload, normalizedSubscription, error);
    const fallbackQuery = existingId
      ? supabase.from("push_subscriptions").update(compatiblePayload).eq("id", existingId)
      : supabase.from("push_subscriptions").insert(compatiblePayload);
    const { error: fallbackError } = await fallbackQuery;
    if (!fallbackError) {
      return;
    }
    throw fallbackError;
  }

  throw error;
}

function isMissingColumnError(error) {
  return error?.code === "PGRST204" || error?.code === "42703";
}

function getCompatiblePayload(payload, normalizedSubscription, error) {
  const message = error?.message || "";
  const nextPayload = { ...payload };

  if (message.includes("'subscription'")) {
    delete nextPayload.subscription;
  }
  if (message.includes("'p256dh'")) {
    delete nextPayload.p256dh;
  }
  if (message.includes("'auth'")) {
    delete nextPayload.auth;
  }

  if (!("p256dh" in nextPayload) && normalizedSubscription?.keys?.p256dh && !message.includes("'p256dh'")) {
    nextPayload.p256dh = normalizedSubscription.keys.p256dh;
  }
  if (!("auth" in nextPayload) && normalizedSubscription?.keys?.auth && !message.includes("'auth'")) {
    nextPayload.auth = normalizedSubscription.keys.auth;
  }

  return nextPayload;
}

async function getUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}

function logPushSubscriptionError(error) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("Push subscription remoto no disponible.", error?.message || error);
  }
}
