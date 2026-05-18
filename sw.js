// Debt Crusher service worker — offline-first cache
const VERSION = 'dc-v1.0.0';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/storage.js',
  './js/calc.js',
  './js/charts.js',
  './js/data.js',
  './js/screens.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  // network-first for HTML, cache-first for assets
  if (request.mode === 'navigate' || request.destination === 'document') {
    e.respondWith(
      fetch(request).then(r => {
        const copy = r.clone();
        caches.open(VERSION).then(c => c.put(request, copy));
        return r;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(request).then(cached => cached ||
      fetch(request).then(r => {
        const copy = r.clone();
        caches.open(VERSION).then(c => c.put(request, copy)).catch(()=>{});
        return r;
      }).catch(() => cached)
    )
  );
});
