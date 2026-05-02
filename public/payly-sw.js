self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const payload = readPushPayload(event);
  const title = payload.title || "Payly";
  const options = {
    body: payload.body || "Che, cargá tus gastos de hoy.",
    badge: "/icon-192.png",
    icon: "/icon-192.png",
    tag: payload.tag || "payly-expense-reminder",
    data: {
      url: payload.url || "/nueva-carga"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/nueva-carga";

  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
      const existingClient = clients.find((client) => client.url.includes(targetUrl));
      if (existingClient) {
        return existingClient.focus();
      }

      return self.clients.openWindow(targetUrl);
    })
  );
});

function readPushPayload(event) {
  try {
    return event.data?.json() || {};
  } catch {
    return {};
  }
}
