import { disablePushSubscription, savePushSubscription } from "./pushSubscriptionsRepository";
import { pickReminderMessage } from "./reminderMessages";

const serviceWorkerPath = "/payly-sw.js";
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function isPushNotificationSupported() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getPushReadiness() {
  if (typeof window === "undefined") {
    return "unavailable";
  }

  if (!window.isSecureContext) {
    return "needs_https";
  }

  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return "unsupported";
  }

  if (!vapidPublicKey) {
    return "missing_vapid_key";
  }

  return "ready";
}

export async function ensurePushSubscription() {
  const readiness = getPushReadiness();
  if (readiness !== "ready") {
    return { status: readiness, source: "local" };
  }

  const registration = await registerPaylyServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      userVisibleOnly: true
    }));

  const result = await savePushSubscription(subscription, {
    userAgent: navigator.userAgent
  });

  return { status: result.source === "remote" ? "subscribed_remote" : "subscribed_local", subscription };
}

export async function disableCurrentPushSubscription() {
  if (!isPushNotificationSupported()) {
    await disablePushSubscription(null);
    return { status: "unsupported" };
  }

  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await subscription.unsubscribe();
  }

  await disablePushSubscription(subscription);
  return { status: "disabled" };
}

export async function showServiceWorkerTestNotification(name, tone = "cercano") {
  if (!("Notification" in window)) {
    return { ok: false, reason: "unsupported" };
  }
  if (Notification.permission !== "granted") {
    return { ok: false, reason: Notification.permission || "permission_missing" };
  }
  if (!("serviceWorker" in navigator)) {
    return { ok: false, reason: "service_worker_unsupported" };
  }

  const registration = await registerPaylyServiceWorker();
  await navigator.serviceWorker.ready;
  await registration.showNotification("Payly", {
    body: pickReminderMessage({ name, tone }),
    badge: "/icon-192.png",
    icon: "/icon-192.png",
    tag: "payly-test-expense-reminder",
    requireInteraction: false,
    data: { url: "/nueva-carga" }
  });
  return { ok: true, reason: "service_worker" };
}

async function registerPaylyServiceWorker() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) {
    return existing;
  }

  return navigator.serviceWorker.register(serviceWorkerPath, { scope: "/" });
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}
