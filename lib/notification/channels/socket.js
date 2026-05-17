import { emitNotification } from '../../socket-io.js'

export async function sendToSocket(notification) {
  try {
    emitNotification({
      id: notification.id, type: notification.type, title: notification.title,
      message: notification.message, category: notification.category,
      priority: notification.priority, timestamp: notification.timestamp,
      titulo: notification.titulo, mensaje: notification.mensaje,
      tipo: notification.tipo, categoria: notification.categoria,
      fecha_creacion: notification.fecha_creacion, leida: notification.leida,
      data: notification.data || {}
    })
    return true
  } catch (error) {
    console.error('Error sending socket notification:', error)
    return false
  }
}

export async function sendToBrowser(notification) {
  sendToSocket(notification)
  try {
    const { broadcastPush } = await import('../../web-push.js')
    const panelDb = global.db?.data || {}
    broadcastPush(panelDb, {
      title: notification.title || notification.titulo || 'OguriCap Bot',
      body: notification.message || notification.mensaje || '',
      url: notification.data?.url || '/',
      tag: `notif-${notification.id || Date.now()}`,
    })
  } catch {}
  return true
}
