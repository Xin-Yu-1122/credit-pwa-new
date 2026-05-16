// Service Worker - 信用卡記帳 PWA v2.0
// 設計原則：install 不預先快取（避免任何資源失敗導致 SW 整個壞掉）
// HTML：Network First；靜態資源：Cache First；跨域（Google APIs）：完全不攔截
const CACHE_NAME = 'credit-pwa-v2.0';

self.addEventListener('install', e => {
  // 不做任何 cache.addAll，直接 skipWaiting
  // 這樣 SW 永遠不會在 install 階段失敗
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    Promise.all([
      // 清掉舊版快取
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

  // 1. 非 GET 不處理
  if (req.method !== 'GET') return;

  // 2. 跨域（Google APIs、accounts.google.com 等）完全不攔截
  if (url.origin !== self.location.origin) return;

  // 3. HTML / 導航請求：Network First（網路優先，失敗才用快取）
  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || req.destination === 'document' || accept.includes('text/html');

  if (isHTML) {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  // 4. 其他靜態資源（JS/CSS/圖片）：Cache First
  e.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
