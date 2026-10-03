// BJI Dawati Brothers - Advanced Offline PWA Service Worker
const CACHE_NAME = 'bji-dawati-v4';

// Core routes and assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/login',
  '/dashboard',
  '/dashboard/contacts',
  '/dashboard/organizations',
  '/dashboard/profile',
  '/manifest.webmanifest',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon-maskable-512x512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Determine if running under a subpath like /bji-dawati-brothers/
      const scopeUrl = new URL(self.registration.scope);
      const prefix = scopeUrl.pathname.replace(/\/$/, '');

      const urlsToCache = PRECACHE_ASSETS.map((path) => {
        return prefix ? `${prefix}${path}` : path;
      });

      // Cache sequentially with resilience so 1 missing asset does not abort install
      for (const url of urlsToCache) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            await cache.put(url, res);
          }
        } catch {
          // Ignore individual fetch failure during precache
        }
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Bypass Firebase Realtime Database, IdentityToolkit, Analytics, and WebSockets
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('firebasedatabase.app') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('google-analytics') ||
    url.hostname.includes('analytics.google.com') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:' ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Bypass local development server Next.js compilation / hot reload chunks
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    if (url.pathname.startsWith('/_next/')) {
      return;
    }
  }

  // Handle Offline state directly to avoid DevTools net::ERR_INTERNET_DISCONNECTED red errors
  const isOffline = !self.navigator.onLine;

  // 1. Navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    if (isOffline) {
      event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then(async (cached) => {
          if (cached) return cached;

          // Try dashboard or login shell fallback
          const scopeUrl = new URL(self.registration.scope);
          const prefix = scopeUrl.pathname.replace(/\/$/, '');
          const fallbacks = [
            `${prefix}/dashboard`,
            `${prefix}/dashboard/`,
            `${prefix}/dashboard/contacts`,
            `${prefix}/login`,
            `${prefix}/`,
            '/dashboard',
            '/login'
          ];

          for (const fb of fallbacks) {
            const match = await caches.match(fb, { ignoreSearch: true });
            if (match) return match;
          }

          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head><body style="background:#0f172a;color:#fff;font-family:sans-serif;padding:40px;text-align:center;"><h2>You are offline</h2><p>Data is stored locally in IndexedDB. Please reconnect to sync with cloud.</p></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
      );
      return;
    }

    // When online: Network first with cache fallback
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request, { ignoreSearch: true });
          if (cached) return cached;
          return new Response('Network error occurred while offline', { status: 408 });
        })
    );
    return;
  }

  // 2. Static Assets (Scripts, Styles, Next.js chunks, Icons, Fonts)
  if (isOffline) {
    // When offline, check cache only — do not attempt network fetch!
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        if (event.request.destination === 'image') {
          return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>', {
            headers: { 'Content-Type': 'image/svg+xml' }
          });
        }
        return new Response('', { status: 408, statusText: 'Offline' });
      })
    );
    return;
  }

  // When online: Network-first for Next.js chunks to always get latest build, fallback to cache
  if (url.pathname.includes('/_next/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }))
    );
    return;
  }

  // For other static assets (images, icons, fonts): Cache-first with background revalidation
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          if (cachedResponse) return cachedResponse;
          return new Response('', { status: 408, statusText: 'Network Error' });
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// Push notification listener
self.addEventListener('push', (event) => {
  let data = { title: 'BJI Dawati Brothers', body: 'New update received' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'BJI Dawati Brothers', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard/'
    }
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
