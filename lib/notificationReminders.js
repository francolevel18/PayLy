const reminderMessages = [
  "Che, {nombre}, no te olvides de cargar tus gastos de hoy",
  "Che, {nombre}, no te cuelgues con lo que gastaste hoy, que despues no te acordas",
  "Epa, {nombre}, la billetera esta llorando y no me contaste por que. Carga tus gastos de hoy."
];

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

export function getNextReminderTime(hour) {
  const reminderHour = normalizeReminderHour(hour);
  const now = new Date();
  const next = new Date(now);
  next.setHours(reminderHour, 0, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

export function scheduleDailyExpenseReminder({ enabled, hasExpensesToday, hour = 20, name }) {
  if (!enabled || !isNotificationSupported() || Notification.permission !== "granted") {
    return () => {};
  }

  const timer = window.setTimeout(() => {
    if (!hasExpensesToday()) {
      new Notification("Payly", {
        body: pickReminderMessage(name),
        tag: "payly-daily-expense-reminder"
      });
    }
  }, getNextReminderTime(hour).getTime() - Date.now());

  return () => window.clearTimeout(timer);
}

export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function normalizeReminderHour(hour) {
  return Number(hour) === 21 ? 21 : 20;
}

function pickReminderMessage(name) {
  const safeName = name || "che";
  const index = new Date().getDate() % reminderMessages.length;
  return reminderMessages[index].replace("{nombre}", safeName);
}
