/**
 * sw.js
 * demo-app — Service Worker
 *
 * · CACHE_NAME/CACHE_PREFIX 는 빌드 시 앱 ID + 환경 + 빌드 해시로 자동 교체됩니다.
 * · activate 에서는 같은 prefix(같은 앱·같은 환경)의 이전 캐시만 삭제합니다.
 *   다른 앱이나 다른 환경(dev/pre/prod)의 캐시는 절대 삭제하지 않는다.
 * · HTML은 network-first + offline fallback, 정적 자산은 cache-first.
 * · sw.js 는 precache 대상에서 제외한다 (브라우저가 SW 스크립트 캐시를 관리한다).
 */
const CACHE_NAME = '{{CACHE_NAME}}';
const CACHE_PREFIX = '{{CACHE_PREFIX}}';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './manifest-dev.webmanifest',
  './manifest-pre.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // HTML: network-first, offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {})
          );
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 정적 자산: cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (!response || (response.status !== 200 && response.type !== 'opaque')) {
            return response;
          }
          const clone = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {})
          );
          return response;
        })
    )
  );
});
