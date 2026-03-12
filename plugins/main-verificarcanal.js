function collectStrings(obj, maxDepth = 5) {
  const out = []
  const seen = new Set()
  const stack = [{ v: obj, d: 0 }]
  while (stack.length) {
    const { v, d } = stack.pop()
    if (!v || d > maxDepth) continue
    if (typeof v === 'string') {
      out.push(v)
      continue
    }
    if (typeof v !== 'object') continue
    if (seen.has(v)) continue
    seen.add(v)
    if (Array.isArray(v)) {
      for (const it of v) stack.push({ v: it, d: d + 1 })
      continue
    }
    for (const k of Object.keys(v)) stack.push({ v: v[k], d: d + 1 })
  }
  return out
}

function extractForwardedNewsletterJid(m) {
  try {
    const ci = m?.msg?.contextInfo || null
    if (!ci) return ''
    const direct =
      ci?.forwardedNewsletterMessageInfo?.newsletterJid ||
      ci?.forwardedNewsletterMessageInfo?.newsletterId ||
      ci?.forwardedNewsletterMessageInfo?.jid ||
      ''
    if (typeof direct === 'string' && direct.endsWith('@newsletter')) return direct

    // Fallback: buscar cualquier string que sea jid de newsletter dentro del contextInfo
    const strings = collectStrings(ci, 6)
    return strings.find(s => typeof s === 'string' && s.endsWith('@newsletter')) || ''
  } catch {
    return ''
  }
}

let handler = async (m, { conn }) => {
  const allowed = Object.values(global.ch || {}).filter(v => typeof v === 'string' && v.endsWith('@newsletter'))
  const channelUrl = String(global.channel || '').trim()

  if (!allowed.length || !channelUrl) {
    return conn.reply(m.chat, 'No hay canal configurado en este bot.', m)
  }

  const forwardedJid = extractForwardedNewsletterJid(m)
  if (!forwardedJid || !allowed.includes(forwardedJid)) {
    return conn.reply(
      m.chat,
      `Para verificar debes:
1) Seguir el canal
2) Reenviar (forward) un post del canal aqui
3) Escribir: verificar

Canal: ${channelUrl}`,
      m
    )
  }

  const user = global.db?.data?.users?.[m.sender]
  if (user) {
    user.channelVerified = true
    user.channelVerifiedAt = new Date().toISOString()
    // reset cooldown para que no moleste
    user.channelGateLastNotice = 0
  }

  if (global.db?.write) await global.db.write().catch(() => {})

  return conn.reply(m.chat, 'Verificacion lista. Ya puedes usar el bot sin restricciones.', m)
}

handler.help = ['verificar']
handler.tags = ['info']
handler.command = ['verificar', 'verify']

export default handler
