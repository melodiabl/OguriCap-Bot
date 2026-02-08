// Service Worker para Push Notifications de Oguri Bot Panel
const CACHE_NAME = 'oguricap-panel-v3';
const STATIC_CACHE = 'oguricap-static-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(['/', '/bot-icon.svg']);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Oguri Bot', body: event.data ? event.data.text() : 'Nueva notificación' };
  }

  const title = data.title || data.titulo || 'Oguri Bot';
  
  const options = {
    body: data.body || data.message || data.mensaje || 'Nueva notificación',
    icon: data.icon || '/bot-icon.svg',
    badge: '/bot-icon.svg',
    tag: data.tag || `notification-${Date.now()}`,
    renotify: true,
    requireInteraction: data.type === 'error' || data.type === 'critical' || data.requireInteraction || false,
    vibrate: data.vibrate || [100, 50, 100],
    timestamp: Date.now(),
    data: {
      ...data.data,
      url: data.url || data.data?.url || '/'
    },
    actions: data.actions || [
      { action: 'open', title: 'Ver ahora' },
      { action: 'close', title: 'Cerrar' }
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
