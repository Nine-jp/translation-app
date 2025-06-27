const CACHE_NAME = 'translation-pwa-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    // アイコンファイルもキャッシュに含める
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// インストールイベント: アプリケーションシェルをキャッシュする
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// フェッチイベント: キャッシュファースト戦略
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュにヒットすれば、それを返す
                if (response) {
                    return response;
                }
                // キャッシュになければ、ネットワークから取得し、キャッシュに追加
                return fetch(event.request).then(
                    (response) => {
                        // 有効なレスポンスか確認
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        // レスポンスをクローンしてキャッシュに保存
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    }
                );
            })
            .catch(error => {
                console.error('Fetch failed:', error);
                // オフライン時のフォールバック (例: オフラインページを表示)
                // return caches.match('/offline.html');
            })
    );
});

// アクティベートイベント: 古いキャッシュを削除する
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});