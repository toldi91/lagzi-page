const CACHE_NAME = "lagzi-cache-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./js/main.js",
  "./js/i18n.js",
  "./js/i18n-data.js",
  "./i18n/i18n.json",
  "./css/global.css",
  "./css/animations.css",
  "./css/hero.css",
  "./css/nav.css",
  "./css/sections.css",
  "./css/helyszin.css",
  "./css/menetrend.css",
  "./css/naszajandek.css",
  "./css/gallery.css",
  "./css/countdown.css",
  "./css/dresscode.css",
  "./css/menu.css",
  "./css/rsvp.css",
  "./css/footer.css",
  "./css/i18n.css",
  "./fonts/alex-brush/AlexBrush-Regular.ttf",
  "./fonts/amsterdam-handwriting/Amsterdam_Handwriting.ttf"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const request = event.request;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        return response;
      });
    })
  );
});
