/* VGC Companion service worker.
 *
 * Goals:
 *  - Full offline install on Android (app shell cached, SPA navigations work
 *    offline by falling back to the cached index.html).
 *  - Champions Battle Data API responses cached so meta/usage data is available
 *    offline after the first successful fetch (network-first, cache fallback).
 *  - Base-path aware: works whether the app is served at the domain root
 *    (Netlify/Cloudflare) or under a subpath (GitHub Pages project site).
 *
 * Bump CACHE_VERSION on every deploy so clients pick up new hashed assets.
 */

const CACHE_VERSION = 'v3';
const APP_CACHE = `vgc-app-${CACHE_VERSION}`;
const API_CACHE = `vgc-api-${CACHE_VERSION}`;

// The SW scope path is the deployment base (e.g. "/" or "/vgc-companion/").
const BASE = new URL(self.registration ? self.registration.scope : self.location.href).pathname;

const APP_SHELL = [BASE, `${BASE}index.html`, `${BASE}manifest.webmanifest`];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) =>
      // Best-effort: don't fail install if one asset 404s under a subpath.
      Promise.allSettled(APP_SHELL.map((u) => cache.add(u))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== APP_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 1) Champions Battle Data API + PokéAPI: network-first, fall back to cache.
  if (
    url.hostname === 'championsbattledata.com' ||
    url.hostname === 'pokeapi.co'
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // 2) Same-origin navigations (SPA routes): serve cached index.html offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(
        () =>
          caches.match(`${BASE}index.html`) ||
          caches.match(BASE) ||
          Response.error(),
      ),
    );
    return;
  }

  // 3) Same-origin static assets: cache-first (Vite hashes filenames).
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(APP_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
  }
});
