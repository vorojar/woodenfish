const CACHE_NAME = 'zenfish-v2';
const ASSETS = [
    'index.html',
    'style.css',
    'script.js',
    'manifest.json',
    'logo.png',
    'woodfish-sound.mp3',
    'woodfish-sound2.mp3',
    'woodfish-sound1.mp3',
    'woodfish.png',
    'stick.png',
    'icons/icon-192x192.png',
    'icons/icon-512x512.png'
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS);
            })
    );
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
});

// 处理请求
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // 如果在缓存中找到响应，则返回缓存的响应
                if (response) {
                    return response;
                }
                // 否则发送网络请求
                return fetch(event.request)
                    .then((response) => {
                        // 检查是否收到有效的响应
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        // 克隆响应
                        const responseToCache = response.clone();
                        // 将响应添加到缓存
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        return response;
                    });
            })
    );
});
