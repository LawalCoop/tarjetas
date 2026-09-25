// Cache "stale-while-revalidate": la tarjeta abre al toque y funciona sin señal.
const CACHE = "tarjetas-__VERSION__";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Páginas: primero red (siempre la última versión), caché si no hay señal.
  if (e.request.mode === "navigate") {
    e.respondWith(
      caches.open(CACHE).then((cache) =>
        fetch(e.request)
          .then((res) => {
            if (res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => cache.match(e.request, { ignoreSearch: true }))
      )
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(e.request);
      const net = fetch(e.request)
        .then((res) => {
          if (res.ok || res.type === "opaque") cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
