// GRAKKGRITH Service Worker v46
// Caches the app for offline use. Cache busts on version bump.
// Maps are not downloaded up front: each one is saved the first time you open it (see fetch below).

const CACHE_NAME = 'grakkgrith-v46';
const ASSETS = [
  './',
  './index.html',
  './apps/creator.html',
  './apps/player.html',
  './data/rules.json',
  './apps/explore.html',
  './apps/guide.html',
  './fonts/fonts.css',
  './fonts/atkinson-hyperlegible-latin-400-normal.woff2',
  './fonts/atkinson-hyperlegible-latin-400-italic.woff2',
  './fonts/atkinson-hyperlegible-latin-700-normal.woff2',
  './fonts/permanent-marker-latin-400-normal.woff2',
  './fonts/saira-condensed-latin-500-normal.woff2',
  './fonts/saira-condensed-latin-600-normal.woff2',
  './fonts/saira-condensed-latin-700-normal.woff2',
  './data/guides/races.json',
  './art/sideways-shops/races-header.jpg',
  './art/sideways-shops/races/goblin.jpg',
  './art/sideways-shops/races/orc.jpg',
  './art/sideways-shops/races/human.jpg',
  './art/sideways-shops/races/dwarf.jpg',
  './art/sideways-shops/races/elf.jpg',
  './art/sideways-shops/races/halfling.jpg',
  './art/sideways-shops/races/troll.jpg',
  './art/sideways-shops/races/kobold.jpg',
  './art/sideways-shops/races/cinderfolk.jpg',
  './art/sideways-shops/races/slimefolk.jpg',
  './data/places.json',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './trip_chirp_field_kit_thumb.jpg'
];

// Install: cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for fresh app shell, cache fallback for offline use
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
