// Basic offline-first service worker
const CACHE = 'listen-pwa-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  // Network-first for HTML, cache-first for others
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
      return r;
    }).catch(() => caches.match('./index.html')));
  } else {
    e.respondWith(caches.match(request).then(cached => cached || fetch(request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(request, copy));
      return r;
    })));
  }
});
