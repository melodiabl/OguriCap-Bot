export function shouldSendToWebhook(webhook, notification) {
  if (!webhook.enabled) return false
  const filters = webhook.filters
  if (!filters) return true
  if (filters.types && !filters.types.includes(notification.type)) return false
  if (filters.categories && !filters.categories.includes(notification.category)) return false
  if (filters.minPriority && notification.priority < filters.minPriority) return false
  return true
}

export async function sendToWebhook(notification, webhooks) {
  try {
    const results = await Promise.allSettled(webhooks.map(async (webhook) => {
      if (!shouldSendToWebhook(webhook, notification)) return true
      const payload = {
        notification: {
          id: notification.id, type: notification.type || notification.tipo,
          title: notification.title || notification.titulo,
          message: notification.message || notification.mensaje,
          category: notification.category || notification.categoria,
          priority: notification.priority, timestamp: notification.timestamp
        },
        data: notification.data || {},
        webhook: { name: webhook.name, timestamp: new Date().toISOString() }
      }
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Oguri-Bot-Notifications/1.0', ...(webhook.headers || {}) },
        body: JSON.stringify(payload), timeout: 10000
      })
      return response.ok
    }))
    return results.every(r => r.status === 'fulfilled' && r.value)
  } catch (error) {
    console.error('Error sending webhook notification:', error)
    return false
  }
}
