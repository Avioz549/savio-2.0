// Cache only the public offline page. Never cache financial or authentication requests.
self.addEventListener('install', event => { event.waitUntil(caches.open('savio-shell-v1').then(cache => cache.add('/offline.html'))); self.skipWaiting(); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', event => { if(event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html'))); });
