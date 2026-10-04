const cacheName = 'digiturk-portal-shell-v2';
const shell = ['manifest.json', 'portal-icon-192.png', 'portal-icon-512.png', 'apple-touch-icon.png', 'portal-icon.svg'].map((path) => new URL(path, self.registration.scope).href);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(shell)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => (key.startsWith('ai-asistan-') || key.startsWith('digiturk-portal-shell-')) && key !== cacheName).map((key) => caches.delete(key)))));
  self.clients.claim();
});

// This portal requires the live server for authentication, content and AI.
// Never cache navigations or API responses, and never serve stale pages offline.
self.addEventListener('fetch', (event) => {
  if (event.request.method === 'GET' && shell.includes(event.request.url)) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
  }
});
