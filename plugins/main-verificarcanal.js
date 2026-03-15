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
    let ci = m?.msg?.contextInfo || m?.contextInfo || null
    if (!ci) {
      const msgObj = (m?.message && typeof m.message === 'object') ? m.message : null
      if (msgObj) {
        const firstKey = Object.keys(msgObj)[0]
        ci = msgObj?.[firstKey]?.contextInfo || null
      }
    }
    if (!ci) {
      const msgObj = (m?.message && typeof m.message === 'object') ? m.message : null
      const inner = msgObj?.viewOnceMessage?.message || msgObj?.viewOnceMessageV2?.message || msgObj?.viewOnceMessageV2Extension?.message || null
      if (inner && typeof inner === 'object') {
        const firstKey = Object.keys(inner)[0]
        ci = inner?.[firstKey]?.contextInfo || null
      }
    }
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

let handler = async (m, { conn, usedPrefix }) => {
  const allowed = Object.values(global.ch || {}).filter(v => typeof v === 'string' && v.endsWith('@newsletter'))
  const channelUrl = String(global.channel || '').trim()

  if (!allowed.length || !channelUrl) {
    return conn.reply(m.chat, 'No hay canal configurado en este bot.', m)
  }

  let forwardedJid = extractForwardedNewsletterJid(m)

  // Soporta: responder a un post reenviado (quoted)
  if (!forwardedJid && m?.quoted) {
    forwardedJid = extractForwardedNewsletterJid(m.quoted)
  }

  // Soporta: reenviar post y luego mandar el comando en otro mensaje
  if (!forwardedJid) {
    const user = global.db?.data?.users?.[m.sender]
    const w = Number(process.env.CHANNEL_VERIFY_WINDOW_MS || (10 * 60 * 1000))
    const lastAt = Number(user?.lastForwardedNewsletterAt) || 0
    const lastJid = typeof user?.lastForwardedNewsletterJid === 'string' ? user.lastForwardedNewsletterJid : ''
    if (lastJid && lastAt && (Date.now() - lastAt) <= w) forwardedJid = lastJid
  }

  if (!forwardedJid || !allowed.includes(forwardedJid)) {
    return conn.reply(
      m.chat,
      `Para verificar debes:
1) Seguir el canal
2) Reenviar (forward) un post del canal aqui (o responde al post reenviado)
3) Escribir: ${usedPrefix || ''}verificar

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

    // limpiar estado temporal
    user.lastForwardedNewsletterJid = null
    user.lastForwardedNewsletterAt = 0
  }

  if (global.db?.write) await global.db.write().catch(() => {})

  return conn.reply(m.chat, 'Verificacion lista. Ya puedes usar el bot sin restricciones.', m)
}

handler.help = ['verificar']
handler.tags = ['info']
handler.command = ['verificar', 'verify']

export default handler
