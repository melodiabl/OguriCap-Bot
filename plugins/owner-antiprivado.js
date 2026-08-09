let handler = async (m, { conn, args, usedPrefix, command }) => {
  const botJid = conn?.user?.jid || conn?.user?.id
  if (!botJid) return m.reply('❌ No pude resolver el JID del bot.')

  global.db.data.settings ||= {}
  global.db.data.settings[botJid] ||= {
    self: false,
    jadibotmd: true,
    antiPrivate: false,
    antiPrivateBlock: true,
    antiPrivateAllowlist: []
  }

  const s = global.db.data.settings[botJid]
  if (!Array.isArray(s.antiPrivateAllowlist)) s.antiPrivateAllowlist = []

  const sub = String(args[0] || '').toLowerCase()
  const sub2 = String(args[1] || '').toLowerCase()

  const pickJid = async (idx = 1) => {
    const mentioned = await m.mentionedJid
    const jid = Array.isArray(mentioned) && mentioned[0] ? mentioned[0] : null
    if (jid) return jid
    const raw = String(args[idx] || '').trim()
    const num = raw.replace(/[^0-9]/g, '')
    if (!num) return null
    return `${num}@s.whatsapp.net`
  }

  if (!sub) {
    const status = s.antiPrivate ? '✓ Activado' : '✗ Desactivado'
    const autoBlock = s.antiPrivateBlock ? '✓ Si' : '✗ No'
    return m.reply(
      `ꕥ *ANTI-PRIVADO*\n\n` +
      `Uso:\n` +
      `✦ ${usedPrefix + command} on\n` +
      `✦ ${usedPrefix + command} off\n` +
      `✦ ${usedPrefix + command} block on\n` +
      `✦ ${usedPrefix + command} block off\n` +
      `✦ ${usedPrefix + command} allow @usuario\n` +
      `✦ ${usedPrefix + command} del @usuario\n` +
      `✦ ${usedPrefix + command} list\n\n` +
      `Estado: ${status}\n` +
      `Auto-bloquear: ${autoBlock}`
    )
  }

  if (sub === 'on' || sub === 'activar') {
    s.antiPrivate = true
    // Por defecto, al activar Anti-Privado el bloqueo viene activo
    s.antiPrivateBlock = true
    if (global.db?.write) await global.db.write().catch(() => {})
    return m.reply('❀ Anti-Privado activado.')
  }

  if (sub === 'off' || sub === 'desactivar') {
    s.antiPrivate = false
    if (global.db?.write) await global.db.write().catch(() => {})
    return m.reply('❀ Anti-Privado desactivado.')
  }

  if (sub === 'block') {
    if (!sub2) return m.reply(`Uso: ${usedPrefix + command} block on | off`)
    if (sub2 === 'on' || sub2 === 'activar') s.antiPrivateBlock = true
    else if (sub2 === 'off' || sub2 === 'desactivar') s.antiPrivateBlock = false
    else return m.reply(`Uso: ${usedPrefix + command} block on | off`)
    if (global.db?.write) await global.db.write().catch(() => {})
    return m.reply(`❀ Auto-bloquear en privados: ${s.antiPrivateBlock ? '✓ Activado' : '✗ Desactivado'}`)
  }


  if (['allow', 'permitir', 'add', 'agregar'].includes(sub)) {
    const jid = await pickJid(1)
    if (!jid) return m.reply(`Uso: ${usedPrefix + command} allow @usuario`)
    if (s.antiPrivateAllowlist.includes(jid)) {
      return conn.sendMessage(m.chat, { text: `✅ Ya esta en allowlist: @${jid.split('@')[0]}`, mentions: [jid] }, { quoted: m })
    }
    s.antiPrivateAllowlist.push(jid)
    if (global.db?.write) await global.db.write().catch(() => {})
    return conn.sendMessage(m.chat, { text: `✅ Allowlist agregado: @${jid.split('@')[0]}`, mentions: [jid] }, { quoted: m })
  }

  if (['del', 'delete', 'remove', 'quitar', 'rm'].includes(sub)) {
    const jid = await pickJid(1)
    if (!jid) return m.reply(`Uso: ${usedPrefix + command} del @usuario`)
    const before = s.antiPrivateAllowlist.length
    s.antiPrivateAllowlist = s.antiPrivateAllowlist.filter(j => j !== jid)
    const removed = before - s.antiPrivateAllowlist.length
    if (removed > 0 && global.db?.write) await global.db.write().catch(() => {})
    return conn.sendMessage(
      m.chat,
      { text: removed > 0 ? `🗑️ Quitado de allowlist: @${jid.split('@')[0]}` : `⚠️ No estaba en allowlist: @${jid.split('@')[0]}`, mentions: [jid] },
      { quoted: m }
    )
  }

  if (['list', 'lista'].includes(sub)) {
    const list = s.antiPrivateAllowlist
    if (!list.length) return m.reply('📃 Allowlist vacia.')
    const text = list.slice(0, 50).map((j, i) => `${i + 1}. @${j.split('@')[0]}`).join('\n')
    return conn.sendMessage(m.chat, { text: `📃 *Allowlist Anti-Privado*\n\n${text}`, mentions: list }, { quoted: m })
  }

  return m.reply(`Uso correcto: ${usedPrefix + command} on | off | block on/off | allow/del/list`)
}

handler.help = ['antiprivado']
handler.tags = ['owner']
handler.command = /^(antiprivado|anti-privado)$/i
handler.owner = true

export default handler
