// Service Worker - 信用卡記帳 PWA
const CACHE_NAME = 'credit-pwa-v1.1';

// 安裝時預先快取 App Shell
const PRECACHE_URLS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      // 清除舊版快取
      caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Google APIs 不快取，直接走網路
  if (url.origin.includes('googleapis.com') ||
      url.origin.includes('accounts.google.com') ||
      url.origin.includes('apis.google.com')) {
    return;
  }

  // 同源資源：Cache First（有快取就用，沒有才去網路）
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
          }
          return res;
        }).catch(() => {
          // 完全離線時，導航請求 fallback 到 index.html
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
    return;
  }
});
