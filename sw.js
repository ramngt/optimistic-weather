// Optimist · Wetter — Service Worker
// Strategie:
//  - App-Dateien (HTML/Manifest): stale-while-revalidate (startet sofort, aktualisiert im Hintergrund)
//  - Wetterdaten (APIs): network-first (online IMMER frisch; offline letzte gespeicherte Antwort)
const SHELL = "optimist-shell-v2";
const DATA  = "optimist-data-v2";
const SHELL_FILES = ["./", "./index.html", "./manifest.webmanifest"];
const DATA_HOSTS = /(open-meteo\.com|api\.met\.no|bigdatacloud\.net)/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== DATA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // --- Wetterdaten: network-first ---
  if (DATA_HOSTS.test(url.hostname)) {
    e.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(DATA).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req))   // offline: letzte gespeicherte Antwort
    );
    return;
  }

  // --- App-Shell (eigene Herkunft): stale-while-revalidate ---
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req)
          .then(res => { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); return res; })
          .catch(() => cached);
        return cached || net;
      })
    );
  }
});
