/* ==========================================================================
   Service Worker – macht die Seite offline-fähig (PWA).

   Strategie:
   - App-Shell (HTML/CSS/JS/Icon) beim Installieren cachen.
   - Anfragen zuerst aus dem Cache bedienen, Netz als Fallback (cache-first).
   - Neue Assets (Bilder/Videos/Audio) werden nach dem ersten Laden mitgecacht.

   WICHTIG: Bei Änderungen an den Dateien die CACHE-Version hochzählen,
   damit Besucher die neue Version bekommen.
   ========================================================================== */

const CACHE = 'himmel-v1';

// Kern-Dateien der App (relativ, damit es auf GitHub Pages im Unterordner läuft)
const CORE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './manifest.json',
  './assets/icons/icon.svg',
];

// Installieren: App-Shell cachen
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

// Aktivieren: alte Caches aufräumen
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Abrufen: cache-first, sonst Netzwerk (und dann in den Cache legen)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // nur erfolgreiche, gleich-origin Antworten cachen
        if (res.ok && new URL(req.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached); // offline & nicht im Cache -> nichts zu tun
    })
  );
});
