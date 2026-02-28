const CACHE_NAME = "lagzi-cache-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./js/main.js",
  "./css/global.css",
  "./css/animations.css",
  "./css/hero.css",
  "./css/nav.css",
  "./css/sections.css",
  "./css/helyszin.css",
  "./css/menetrend.css",
  "./css/naszajandek.css",
  "./css/dresscode.css",
  "./css/menu.css",
  "./css/rsvp.css",
  "./css/footer.css",
  "./css/update.css",
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

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
