self.addEventListener('install', function(event) {
  self.skipWaiting(); // Forcer l'installation immédiate
  event.waitUntil(
    caches.open('v1').then(function(cache) {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/icons/icon192C.png',
        '/assets/icons/icon512C.png',
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
