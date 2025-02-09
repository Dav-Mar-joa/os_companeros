const CACHE_NAME = 'os-companeros-v1';  // Utilise un nom de cache unique pour chaque version

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/css/styles.css',
        '/assets/icons/icon192.png',  // Vérifie que l'icône existe à cet emplacement
        '/assets/icons/icon512.png'   // Vérifie que l'icône existe à cet emplacement
      ]);
    })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request).then(function(fetchedResponse) {
        // Cache la nouvelle ressource pour les requêtes suivantes
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, fetchedResponse.clone());
        });
        return fetchedResponse;
      });
    })
  );
});
