const CACHE_NAME = 'volleyball-scoreboard-v10';
const ASSETS = [
  '/mobile.html',
  '/css/mobile.css',
  '/js/mobile.js',
  '/js/db-config.js',
  '/js/db-interface.js',
  '/js/auth.js',
  '/js/common.js',
  '/js/jquery-3.4.1.min.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.all(
        ASSETS.map(function(url) {
          return cache.add(url).catch(function() {});
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Кэшируем только GET-запросы по схемам http/https.
  // Запросы со схемами chrome-extension:, blob:, data: и т.п. (например,
  // от браузерных расширений) в Cache Store не поддерживаются и дают
  // "Failed to execute 'put' on 'Cache'" — просто пропускаем их без перехвата.
  var url = new URL(event.request.url);
  if (event.request.method !== 'GET' || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
    return; // не вызываем respondWith — браузер обработает запрос сам
  }

  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response && response.status === 200 && response.type === 'basic') {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone).catch(function() {});
        });
      }
      return response;
    }).catch(function() {
      // Если сети нет и ресурса нет в кэше, caches.match() вернёт undefined,
      // и respondWith() упадёт с TypeError: Failed to convert value to 'Response'.
      // Всегда возвращаем валидный Response, чтобы сервис-воркер не выходил из строя.
      return caches.match(event.request) || new Response(
        '<html><body>Временно недоступно: нет сети и нет кэша.</body></html>',
        { status: 503, statusText: 'Service Unavailable', headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    })
  );
});
