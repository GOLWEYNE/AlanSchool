// Minimal push-only service worker for Alan School. Deliberately does not
// do offline caching / PWA install prompts - its one job is receiving Web
// Push events while no tab is open and turning them into an OS
// notification, then routing a click on that notification back into the
// dashboard.

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Alan School", body: event.data.text() };
  }

  const { title, body, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title || "Alan School", {
      body: body || "",
      icon: "/Alan.png",
      badge: "/Alan.png",
      data: { url: url || "/dashboard" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })()
  );
});
