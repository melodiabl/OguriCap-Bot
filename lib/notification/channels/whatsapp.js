export function getAdminNumbers() {
  const numbers = new Set()
  const push = (val) => {
    if (!val) return
    if (Array.isArray(val)) return val.forEach(push)
    const cleaned = String(val).replace(/[^0-9]/g, '')
    if (cleaned) numbers.add(cleaned)
  }
  push(global.owner || [])
  String(process.env.SUPPORT_NOTIFY_WHATSAPP_TO || '').split(',').forEach(push)
  const usuarios = global.db?.data?.usuarios || {}
  for (const u of Object.values(usuarios)) {
    const role = String(u?.rol || '').toLowerCase()
    if (!['owner', 'admin', 'administrador'].includes(role)) continue
    push(u?.whatsapp_number || u?.whatsapp || u?.phone)
  }
  return [...numbers]
}

export async function sendToWhatsApp(notification) {
  try {
    const override = notification?.whatsappTo || notification?.whatsapp_to || null
    const adminNumbers = (Array.isArray(override) && override.length) ? override : getAdminNumbers()
    if (!adminNumbers.length) return true
    const message = `🔔 *${notification.title || notification.titulo}*\n\n${notification.message || notification.mensaje}\n\n_${new Date().toLocaleString()}_`
    for (const number of adminNumbers) {
      if (global.conn?.user) {
        const cleaned = String(number || '').replace(/[^0-9]/g, '')
        if (!cleaned) continue
        await global.conn.sendMessage(`${cleaned}@s.whatsapp.net`, { text: message })
      }
    }
    return true
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error)
    return false
  }
}
