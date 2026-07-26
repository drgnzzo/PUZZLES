const CACHE_NAME = 'puzzles-shell-1.6.0-editorial-security';
const SHELL_FILES = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './assets/logo-puzzles-header.png',
  './assets/logo-puzzles-icon.png',
  './assets/puzzles_logo.png',
  './assets/puzzles_logo_mark.png',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-maskable-512.png',
  './assets/apple-touch-icon.png',
  './assets/banner-01-editorial.png',
  './assets/banner-02-botellas.png',
  './assets/banner-03-editorial.png',
  './assets/banner-04-botellas.png',
  './assets/banner-05-editorial.png',
  './assets/banner-06-botellas.png',
  './assets/puzzles-app-v1.6.0.css',
  './assets/puzzles-app-v1.6.0.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(SHELL_FILES.map(file => cache.add(file))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html').then(value => value || caches.match('./offline.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    })
  );
});
