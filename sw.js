const CACHE_NAME = 'hc-app-v3';
const ASSETS = [
  './',
  './HydroConcept_App.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://unpkg.com/docx@8.5.0/build/index.umd.js',
  'https://unpkg.com/file-saver@2.0.5/dist/FileSaver.min.js'
];

// Install — cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache first, then network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
