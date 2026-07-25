const CACHE_NAME = 'puzzles-shell-v1.5.8-r2';

const SHELL_FILES = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './assets/logo-puzzles-header.png',
  './assets/logo-puzzles-icon.png',
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
  './assets/puzzles-app-v1.5.8.css',
  './assets/puzzles-app-v1.5.8.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        const copy = response.clone();

        caches
          .open(CACHE_NAME)
          .then(cache => cache.put(request, copy));

        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then(cached =>
            cached ||
            (
              request.mode === 'navigate'
                ? caches.match('./offline.html')
                : Response.error()
            )
          )
      )
  );
});
