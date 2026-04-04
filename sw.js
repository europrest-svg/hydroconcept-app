const CACHE_NAME = 'hc-app-v13';
const ASSETS = [
  './',
  './HydroConcept_App.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './logo-white.png',
  './logo-black.png',
  './cerere.html',
  './portofoliu.html',
  './testimoniale.html',
  'https://unpkg.com/docx@8.5.0/build/index.umd.js',
  'https://unpkg.com/file-saver@2.0.5/dist/FileSaver.min.js',
  'https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
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

// Fetch — network first, fallback to cache (offline support)
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
      return response;
    }).catch(() => caches.match(e.request))
  );
});
