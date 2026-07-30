// Done List — Service Worker
const CACHE_NAME = 'donelist-v2';
const ASSETS = [
    './',
    'manifest.json',
    'static/icon-192.png',
    'static/icon-512.png',
    'static/app.js',
    'static/style.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js',
];

// 安装：预缓存静态资源
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// 请求拦截：缓存优先
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached =>
            cached || fetch(event.request).then(response => {
                // 缓存成功的跨域请求
                if (response.ok && event.request.url.startsWith('http')) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
        )
    );
});
