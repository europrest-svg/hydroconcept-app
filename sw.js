const CACHE_NAME = 'hc-app-v36';
const ASSETS = [
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './logo-white.png',
  './logo-black.png',
  'https://unpkg.com/docx@8.5.0/build/index.umd.js',
  'https://unpkg.com/file-saver@2.0.5/dist/FileSaver.min.js',
  'https://unpkg.com/mammoth@1.6.0/mammoth.browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
];

// Install — cache only static assets (NOT the HTML — that must always be fresh)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(()=>{}))
  );
  self.skipWaiting();
});

// Activate — nuke ALL old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//  - HTML / navigation / sw.js / cerere / portofoliu / testimoniale: NETWORK-ONLY (no cache)
//  - Everything else: network-first, fallback to cache
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  const isHTML = req.mode === 'navigate'
              || url.pathname.endsWith('.html')
              || url.pathname.endsWith('/')
              || url.pathname.endsWith('sw.js');

  if (isHTML) {
    // ALWAYS go to network for HTML. Never serve stale HTML.
    e.respondWith(
      fetch(new Request(req.url, {cache:'no-store'})).catch(() => caches.match(req))
    );
    return;
  }

  e.respondWith(
    fetch(req).then(response => {
      const clone = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(req, clone)).catch(()=>{});
      return response;
    }).catch(() => caches.match(req))
  );
});

// Listen for skipWaiting message from page
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
