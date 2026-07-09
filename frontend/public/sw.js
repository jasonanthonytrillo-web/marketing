const CACHE_NAME = 'elevate-pos-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 PWA: Caching critical assets');
      return cache.addAll(ASSETS_TO_CACHE);
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
});

// Fetch Event - Network First with Cache Fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip caching for API calls to ensure real-time data
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful responses
        if (response && response.status === 200 && response.type === 'basic') {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, resClone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) return cachedResponse;

        // If not in cache and network failed, we must return a valid Response (e.g. 404)
        return new Response('Network error occurred', {
          status: 408,
          statusText: 'Network error occurred',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
        });
      })
  );
});

// Push Notification Event
self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'New Update';
  const options = {
    body: data.body || 'Your order has been updated.',
    icon: '/hb_logo.jpg',
    badge: '/hb_logo.jpg',
    data: data.url // Useful for redirects on click
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
