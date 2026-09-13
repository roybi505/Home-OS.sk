const CACHE = 'homeos-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Only ever intercept same-origin requests — this app's own shell/assets.
  // Cross-origin GETs (product images from Open Food/Beauty Facts, Firebase,
  // Google APIs, anything else) must hit the real network untouched: this
  // handler must never become an unintended proxy that turns a cross-origin
  // fetch failure into a "successful" same-origin HTML response.
  let url;
  try { url = new URL(req.url); } catch { return; }
  if (url.origin !== self.location.origin) return;

  // Network-first for the app shell so updates land, cache as offline fallback.
  // The index.html fallback on failure is restricted to actual page
  // navigations — a failed same-origin API/asset request should surface as
  // a real failure (or its own cached copy, if any), never as HTML.
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
