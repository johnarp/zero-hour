/* Zero Hour service worker: makes the app installable and usable offline.
   App files use network-first, so an updated file is always picked up when you are online.
   If you ever need to force a clean slate, change CACHE. */
const CACHE = 'zero-hour-v1';
const CORE = ['./', 'index.html', 'css/styles.css', 'js/data.js', 'js/clock.js', 'js/music.js', 'js/ui.js', 'js/editor.js', 'js/main.js',
  'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable-512.png', 'assets/apple-touch-icon.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {            // the app itself: network first, cache as the offline fallback
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
  } else if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {   // fonts: use the saved copy, refresh quietly
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }                                                // everything else (YouTube etc.) goes straight to the network
});