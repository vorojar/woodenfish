const CACHE_NAME = 'woodenfish-1.5.0';
const SCOPE_PATH = '/';

// 预缓存核心资源（HTML/CSS/JS 都进，确保离线能开页）
const ASSETS = [
    SCOPE_PATH,
    SCOPE_PATH + 'index.html',
    SCOPE_PATH + 'style.css',
    SCOPE_PATH + 'script.js',
    SCOPE_PATH + 'manifest.json',

    SCOPE_PATH + 'favicon.ico',
    SCOPE_PATH + 'favicon.png',
    SCOPE_PATH + 'logo.png',
    SCOPE_PATH + 'woodfish.png',
    SCOPE_PATH + 'stick.png',
    SCOPE_PATH + 'apple-touch-icon.png',

    SCOPE_PATH + 'woodfish-sound2.mp3',

    SCOPE_PATH + 'icons/icon-192x192.png',
    SCOPE_PATH + 'icons/icon-512x512.png'
];

// 判断请求是否可缓存
function isRequestCacheable(request) {
    if (request.method !== 'GET') return false;
    try {
        const url = new URL(request.url);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
        if (url.href.includes('chrome-extension:')) return false;
        return true;
    } catch (e) {
        return false;
    }
}

// 是否为应用核心代码（HTML/CSS/JS）— 走 network-first 拿最新
function isCoreCode(url) {
    return /\.(html|css|js)(\?.*)?$/i.test(url.pathname) ||
        url.pathname === SCOPE_PATH ||
        url.pathname === SCOPE_PATH + 'manifest.json';
}

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                ASSETS.map(asset =>
                    fetch(asset, { cache: 'no-cache' })
                        .then(response => {
                            if (response && response.ok) {
                                return cache.put(asset, response);
                            }
                        })
                        .catch(error => console.log(`无法缓存资源: ${asset}`, error))
                )
            );
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name.startsWith('woodenfish-') && name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (!isRequestCacheable(event.request)) return;

    const url = new URL(event.request.url);

    // 核心代码：network-first，失败回退缓存
    if (isCoreCode(url)) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response && response.ok) {
                        const cloned = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request).then(hit => {
                    if (hit) return hit;
                    // 导航请求兜底到 index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match(SCOPE_PATH + 'index.html');
                    }
                    return Response.error();
                }))
        );
        return;
    }

    // 静态资源：cache-first
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.ok) {
                    const cloned = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
                }
                return response;
            }).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match(SCOPE_PATH + 'index.html');
                }
                return Response.error();
            });
        })
    );
});

self.addEventListener('message', event => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    } else if (event.data === 'clearCache') {
        // 清掉本应用所有缓存（不影响同域其他 PWA）
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k.startsWith('woodenfish-'))
                    .map(k => caches.delete(k))
            )
        );
    } else if (event.data === 'unregister') {
        self.registration.unregister();
    }
});
