// AlphaForge PRO Service Worker
// 策略：HTML 快取優先（防快取卡舊版）、靜態資源快取優先
// API 永遠走網路（行情、新聞、OI、CVD 必須即時，不能用快取）

const VERSION = 'alphaforge-v1';
const CACHE_NAME = `${VERSION}-cache`;

// 安裝時預快取核心檔案
const PRECACHE_URLS = [
  './AlphaForge_PRO.html',
  './manifest.json',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 啟用時清掉舊版快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 攔截請求
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API 請求 / WebSocket / 任何外部資料源 → 永遠走網路，不快取
  // 這很重要：交易數據絕不能用快取（會看到舊行情）
  const isExternal = url.origin !== self.location.origin;
  const isAPI = url.pathname.includes('/api/')
             || url.hostname.includes('binance')
             || url.hostname.includes('okx')
             || url.hostname.includes('cryptocompare')
             || url.hostname.includes('cointelegraph')
             || url.hostname.includes('coingecko')
             || url.hostname.includes('translate')
             || url.hostname.includes('corsproxy')
             || url.hostname.includes('allorigins')
             || url.hostname.includes('rss2json');

  if (isExternal || isAPI) {
    // 直接走網路，不碰快取
    return;
  }

  // 本地檔案：快取優先，背景更新
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(response => {
        // 成功的回應加進快取（背景更新）
        if (response && response.status === 200) {
          const respClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, respClone));
        }
        return response;
      }).catch(() => cached);  // 網路失敗用快取兜底

      return cached || fetchPromise;
    })
  );
});
