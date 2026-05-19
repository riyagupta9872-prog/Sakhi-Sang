// Sakhi Sang Service Worker — version-bumped on each deploy
const CACHE = 'sakhi-sang-v3';
const ASSETS = [
  '/Sakhi-Sang/',
  '/Sakhi-Sang/index.html',
  '/Sakhi-Sang/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never cache Firebase / Firestore traffic — always go to network
  if (url.host.includes('firestore.googleapis.com') ||
      url.host.includes('identitytoolkit.googleapis.com') ||
      url.host.includes('firebaseio.com') ||
      url.host.includes('googleapis.com') ||
      url.host.includes('firebase')) {
    return; // let it pass through
  }

  // App shell: network-first (fall back to cache when offline)
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => { caches.open(CACHE).then((c) => c.put(e.request, res.clone())); return res; })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('/Sakhi-Sang/index.html')))
    );
    return;
  }

  // Static assets (JS/CSS/icons): cache-first, fetch in background
  if (url.pathname.startsWith('/Sakhi-Sang/assets/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((cached) =>
        cached ||
        fetch(e.request).then((res) => {
          caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
      )
    );
  }
});
