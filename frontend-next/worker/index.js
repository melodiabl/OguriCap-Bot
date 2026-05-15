// Custom service worker code merged into the next-pwa generated worker.
// Handles push notifications and notification clicks.

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'Oguri Bot',
      body: event.data ? event.data.text() : 'Nueva notificación',
    };
  }

  const title = data.title || data.titulo || 'Oguri Bot';
  const rawBody = data.body || data.message || data.mensaje || 'Nueva notificación';
  const body =
    String(rawBody || '').length > 180
      ? `${String(rawBody).slice(0, 179).trimEnd()}…`
      : String(rawBody || '');

  const options = {
    body,
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    tag: data.tag || `notification-${Date.now()}`,
    renotify: false,
    requireInteraction: false,
    vibrate: data.vibrate || [100, 50, 100],
    timestamp: Date.now(),
    data: {
      ...(data.data || {}),
      url: data.url || (data.data && data.data.url) || '/',
    },
    actions: data.actions || [
      { action: 'open', title: 'Ver ahora' },
      { action: 'close', title: 'Cerrar' },
    ],
  };

  event.waitUntil(
    self.registration
      .getNotifications({ tag: options.tag })
      .then((existing) => {
        existing.forEach((n) => n.close());
        return self.registration.showNotification(title, options);
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  const urlToOpen = new URL(
    (event.notification.data && event.notification.data.url) || '/',
    self.location.origin
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(urlToOpen);
      })
  );
});
