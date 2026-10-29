// GRAKKGRITH Service Worker v42
// Caches the interactive mission world interface for offline use. Cache busts on version bump.

const CACHE_NAME = 'grakkgrith-v42';
const ASSETS = [
  './',
  './index.html',
  './apps/creator.html',
  './apps/player.html',
  './data/rules.json',
  './apps/explore.html',
  './data/places.json',
  './maps/official/adyta-city.jpg',
  './maps/official/low-halo.jpg',
  './maps/official/ember-court.jpg',
  './maps/official/market-ring.jpg',
  './maps/official/dockside.jpg',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './maps/adyta-city-map.jpg',
  './maps/adyta-pda-city-atlas.jpg',
  './maps/low-halo-district-map.png',
  './maps/low-halo-ember-court-spread.png',
  './maps/ember-court-district-map.png',
  './maps/sewers-town-district-map.png',
  './maps/sewers-town-district-map-deeper.png',
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
