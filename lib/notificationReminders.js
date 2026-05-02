import { pickReminderMessage } from "./reminderMessages";

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) {
    return "unsupported";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  return Notification.requestPermission();
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) {
    return "unsupported";
  }

  return Notification.permission;
}

const allDayStartHour = 9;
const allDayEndHour = 22;
const allDayIntervalHours = 3;

export function getNextReminderTime({ hour, mode = "scheduled", time } = {}) {
  if (mode === "allDay") {
    return getNextAllDayReminderTime();
  }

  const { hours, minutes } = normalizeReminderTime(time, hour);
  const now = new Date();
  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

export function scheduleDailyExpenseReminder({ enabled, hasExpensesToday, hour = 20, mode = "scheduled", name, time, tone = "cercano" }) {
  if (!enabled || !isNotificationSupported() || Notification.permission !== "granted") {
    return () => {};
  }

  let timer = null;
  let isActive = true;

  function scheduleNext() {
    if (!isActive) {
      return;
    }

    timer = window.setTimeout(() => {
      if (!hasExpensesToday()) {
        new Notification("Payly", {
          body: pickReminderMessage({ name, tone }),
          tag: "payly-daily-expense-reminder"
        });
      }
      scheduleNext();
    }, getNextReminderTime({ hour, mode, time }).getTime() - Date.now());
  }

  scheduleNext();

  return () => {
    isActive = false;
    if (timer) {
      window.clearTimeout(timer);
    }
  };
}

export function showTestNotification(name, tone = "cercano") {
  if (!isNotificationSupported() || Notification.permission !== "granted") {
    return { ok: false, reason: "permission_missing" };
  }

  new Notification("Payly", {
    body: pickReminderMessage({ name, tone }),
    tag: "payly-test-expense-reminder"
  });
  return { ok: true, reason: "browser_notification" };
}

/*
  The browser Notification API only schedules while the app is open. Native push
  while closed would need a service worker + push subscription later.
*/

export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function normalizeReminderMode(mode) {
  return mode === "allDay" ? "allDay" : "scheduled";
}

export function normalizeReminderTime(time, fallbackHour = 20) {
  const match = String(time || "").match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return {
      hours: clamp(Number(match[1]), 0, 23),
      minutes: clamp(Number(match[2]), 0, 59)
    };
  }

  return {
    hours: clamp(Number(fallbackHour) || 20, 0, 23),
    minutes: 0
  };
}

function getNextAllDayReminderTime() {
  const now = new Date();
  const next = new Date(now);

  next.setHours(allDayStartHour, 0, 0, 0);
  while (next <= now && next.getHours() < allDayEndHour) {
    next.setHours(next.getHours() + allDayIntervalHours, 0, 0, 0);
  }

  if (next > now && next.getHours() <= allDayEndHour) {
    return next;
  }

  next.setDate(next.getDate() + 1);
  next.setHours(allDayStartHour, 0, 0, 0);
  return next;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.round(value), min), max);
}
