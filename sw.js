// Optimist · Wetter — Service Worker (v3)
// HTML/Navigation: network-first  -> online IMMER neueste App, offline letzter Stand
// sonstige App-Dateien:           stale-while-revalidate
// Wetterdaten (APIs):             network-first
const SHELL = "optimist-shell-v3";
const DATA  = "optimist-data-v3";
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

  // Wetterdaten: network-first
  if (DATA_HOSTS.test(url.hostname)) {
    e.respondWith(
      fetch(req).then(res => { const c = res.clone(); caches.open(DATA).then(x => x.put(req, c)); return res; })
        .catch(() => caches.match(req))
    );
    return;
  }

  if (url.origin === location.origin) {
    // HTML/Seitenaufruf: network-first
    if (req.mode === "navigate" || req.destination === "document") {
      e.respondWith(
        fetch(req).then(res => { const c = res.clone(); caches.open(SHELL).then(x => x.put(req, c)); return res; })
          .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
      );
      return;
    }
    // übrige eigene Dateien: stale-while-revalidate
    e.respondWith(
      caches.match(req).then(cached => {
        const net = fetch(req).then(res => { const c = res.clone(); caches.open(SHELL).then(x => x.put(req, c)); return res; }).catch(() => cached);
        return cached || net;
      })
    );
  }
});
