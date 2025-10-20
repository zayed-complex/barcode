const CACHE_NAME = "attendance-login-v1";
const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/script.js",
  "/manifest.json",
  "/icons/logo1.png"
];

self.addEventListener("install", (event) => {
  console.log("🟢 Installing service worker...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener("activate", (event) => {
  console.log("⚙️ Activating service worker...");
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
