const CACHE_NAME = 'woodenfish-1.1.27';

// 按类型分组的缓存资源
const ASSETS = [
    // 核心文件
    //'index.html',
    //'style.css',
    //'script.js',
   // 'manifest.json',
    
    // 图片资源
    'favicon.ico',
    'logo.png',
    'woodfish.png',
    'stick.png',
    
    // 音频资源
    'woodfish-sound2.mp3',
    //'music/Green-Tara-Mantra.mp3',
    //'music/The-Heart-Sutra.mp3',
    //'music/Forest-birds-singing.mp3',
    //'music/waves-sound.mp3',
    
    // PWA 图标
    'icons/icon-192x192.png',
    'icons/icon-512x512.png'
];



// 安装 Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
    // 强制激活
    self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // 立即获得控制权
            return self.clients.claim();
        })
    );
});

// 处理请求
self.addEventListener('fetch', event => {
    // 对于 script.js，始终从网络获取最新版本
    if (event.request.url.includes('script.js')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    return caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // 其他资源使用 Cache First 策略
    event.respondWith(
        caches.match(event.request).then(response => {
            if (response) {
                return response;
            }
            return fetch(event.request).then(response => {
                return caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            });
        })
    );
});

// 消息处理
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
//删除缓存
self.addEventListener('message', function(event) {
    if (event.data === 'unregister') {
      self.registration.unregister();
    }
  });