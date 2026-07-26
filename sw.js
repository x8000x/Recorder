// Bumping this version string forces the browser to fetch fresh copies
// of everything below next time you deploy an update.
var CACHE_NAME = 'retro-sound-cache-v1';

// Files needed to run the app itself. Add your own audio file paths here
// too (e.g. 'testsound.mp3') so they're available with zero internet.
var CORE_ASSETS = [
  './',
  'index.html',
  'styles.css',
  'script.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Cache-first: serve from cache instantly if we have it, otherwise fetch
// from the network and store a copy for next time (so previously played
// tracks keep working offline too).
self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          // No cache and no network — nothing we can do for this request.
        });
    })
  );
});
