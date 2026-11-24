// Service worker : permet l'installation (PWA) et l'ouverture hors ligne de l'interface.
// Stratégie « réseau d'abord » pour les fichiers de l'application (mises à jour immédiates),
// avec repli sur le cache hors ligne. Les requêtes vers les API de marché ne sont JAMAIS mises en cache.

const CACHE = 'ttp-v3';
const SHELL = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest',
  'js/app.js', 'js/engine.js', 'js/indicators.js', 'js/candles.js', 'js/storage.js',
  'js/providers/index.js', 'js/providers/binance.js', 'js/providers/twelvedata.js', 'js/providers/otcharts.js', 'js/providers/util.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return; // API de marché : réseau uniquement

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((r) => r || caches.match('index.html'))),
  );
});
