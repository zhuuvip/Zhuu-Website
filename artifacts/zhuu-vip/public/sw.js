const CACHE_NAME = "zhuuvip-v2";

self.addEventListener("install", (e) => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request)),
  );
});

// Web Push
self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data?.json() || {};
  } catch {
    data = {};
  }

  const title = data.title || "ZhuuVIP";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.message || "",
      icon: data.icon || "/favicon.ico",
      badge: data.badge || "/favicon.ico",
      data: {
        link: data.link || "/notifications",
      },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const link = event.notification?.data?.link || "/notifications";

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate(link);
            return client.focus();
          }
        }

        return self.clients.openWindow(link);
      }),
  );
});
