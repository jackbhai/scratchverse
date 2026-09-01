/* ScratchVerse offline shell.
   Vite emits content-hashed JS/CSS, so cache-first is always safe; the only
   un-hashed files are index.html / 404.html / manifest, which we network-first.
   Registered from src/main.jsx in production builds only. */
const CACHE = 'scratchverse-v1';
const SHELL = ['./', './index.html', './404.html', './manifest.webmanifest'];
const NETWORK_FIRST = /^(.*\/)?(index\.html|404\.html|manifest\.webmanifest|\.)$/;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(new URL(u, self.location).href).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: try network, fall back to the cached shell (offline deep links work).
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(new URL('./index.html', self.location).href)))
    );
    return;
  }

  if (NETWORK_FIRST.test(url.pathname)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Hashed assets + images + fonts: cache-first.
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
    )
  );
});
