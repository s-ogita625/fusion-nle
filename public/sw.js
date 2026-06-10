// ===========================================================================
// Fusion NLE Service Worker
// オフライン動作のためのキャッシュ戦略:
//  - ナビゲーション(HTML): network-first -> 失敗時はキャッシュした '/' を返す
//  - 同一オリジンの静的アセット(_next/static, samples, icons 等):
//    stale-while-revalidate (キャッシュ即返 + 裏で更新)
// 外部ドメインやレンジ要求(動画シーク)は素通し。
// ===========================================================================

const CACHE = "fusion-nle-v1";
const CORE = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // 別オリジンは介入しない
  if (url.origin !== self.location.origin) return;
  // レンジ要求(動画の部分取得)はキャッシュしない
  if (req.headers.has("range")) return;

  // HTMLナビゲーション: network-first
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || caches.match(req)))
    );
    return;
  }

  // それ以外: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
