self.addEventListener('install', function(event) {
  self.skipWaiting(); // Forcer l'installation immédiate
  event.waitUntil(
    caches.open('v1').then(function(cache) {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/css/styles.css',
        '/assets/icons/icon192C.png',
        '/assets/icons/icon512C.png'
      ]);
    })
  );
});
