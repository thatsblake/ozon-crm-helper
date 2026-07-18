// Service Worker для автообновления Ozon CRM
self.addEventListener('install', (e) => {
    console.log('🔄 SW: Установлен');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('✅ SW: Активирован');
    e.waitUntil(clients.claim());
});

// Перехватываем запросы к content.js
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    
    // Если запрашивается content.js — отдаём из кэша
    if (url.pathname.includes('content.js') && url.hostname.includes('github')) {
        e.respondWith(
            caches.match(e.request).then(cached => {
                return cached || fetch(e.request);
            })
        );
    }
});

// Слушаем сообщения от content.js
self.addEventListener('message', (e) => {
    if (e.data.action === 'UPDATE_SCRIPT') {
        updateScript(e.data.version, e.data.code);
    }
});

// Функция обновления
async function updateScript(version, code) {
    const cache = await caches.open('ozon-crm-v' + version);
    const response = new Response(code, {
        headers: { 'Content-Type': 'application/javascript' }
    });
    await cache.put('content.js', response);
    
    // Уведомляем все открытые страницы
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ action: 'UPDATED', version: version });
    });
}
