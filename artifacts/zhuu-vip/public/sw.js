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
  // Hanya tangani GET. POST/PUT/DELETE (API, upload, SSE chat) dibiarkan langsung ke network.
  if (e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request).catch(async () => {
      const cached = await caches.match(e.request);
      // respondWith() wajib menerima Response; jangan pernah kirim undefined.
      return cached || Response.error();
    }),
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
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/icon-192.png",
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
