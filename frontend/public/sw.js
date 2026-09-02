const CACHE_NAME = 'elevate-pos-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 PWA: Caching critical assets');
      return cache.addAll(ASSETS_TO_CACHE).then(async () => {
        try {
          const response = await fetch('/index.html');
          const html = await response.clone().text();
          await cache.put('/index.html', response);
          const assets = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
            .map(match => match[1])
            .filter(asset => asset.startsWith('/'));
          await Promise.allSettled(assets.map(asset => cache.add(asset)));
        } catch (error) {
          console.warn('Bundle pre-cache skipped:', error.message);
        }
      });
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Cache app assets first so refresh works offline.
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip caching for API calls to ensure real-time data
  if (event.request.url.includes('/api/')) {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cachedResponse = await caches.match(event.request);
    if (cachedResponse) return cachedResponse;

    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      if (event.request.mode === 'navigate') {
        const cachedIndex = await caches.match('/index.html');
        if (cachedIndex) return cachedIndex;
      }
      return new Response('Offline resource unavailable', { status: 503 });
    }
  })());
});

// Push Notification Event
self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'New Update';
  const options = {
    body: data.body || 'Your order has been updated.',
    icon: '/hb_logo.jpg',
    badge: '/hb_logo.jpg',
    data: data.url, // Useful for redirects on click
    requireInteraction: true,
    vibrate: [500, 200, 500]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Event
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Focus the exact same app session if it is running in background
      if (windowClients.length > 0) {
        let client = windowClients[0];
        // If there's a specific window that was focused recently, focus that
        for (let i = 0; i < windowClients.length; i++) {
          if (windowClients[i].focused) {
            client = windowClients[i];
            break;
          }
        }
        return client.focus();
      }
      // Otherwise open the app from scratch
      return clients.openWindow('/');
    })
  );
});
