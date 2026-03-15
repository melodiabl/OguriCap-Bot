import { getSubbotCapacityInfo } from '../lib/subbot-capacity.js'

function clampInt(n, { min, max, fallback }) {
  const v = Number.parseInt(String(n), 10)
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

let handler = async (m, { args, usedPrefix, command }) => {
  if (!global.db?.data) return m.reply('❌ DB no disponible')

  global.db.data.panel ||= {}
  global.db.data.panel.whatsapp ||= {}
  global.db.data.panel.whatsapp.subbots ||= {}
  const cfg = global.db.data.panel.whatsapp.subbots

  // Defaults
  if (!('hardMax' in cfg) && !('hard_max' in cfg)) cfg.hardMax = 50
  if (!('autoLimit' in cfg) && !('auto_limit' in cfg)) cfg.autoLimit = true

  const sub = String(args[0] || '').toLowerCase()

  const readCfg = () => {
    const hardMax = cfg.hardMax ?? cfg.hard_max
    const autoLimit = cfg.autoLimit ?? cfg.auto_limit
    const maxSubbots = cfg.maxSubbots ?? cfg.max_subbots
    const reserveMB = cfg.reserveMB ?? cfg.reserve_mb
    const perBotMB = cfg.perBotMB ?? cfg.per_bot_mb
    return { hardMax, autoLimit, maxSubbots, reserveMB, perBotMB }
  }

  const info = () => getSubbotCapacityInfo(readCfg())

  if (!sub || sub === 'info' || sub === 'status') {
    const cap = info()
    const auto = cap.autoLimit ? '✓' : '✗'
    const manual = cap.manualMax != null ? String(cap.manualMax) : '—'
    return m.reply(
      `ꕥ *Capacidad de SubBots*\n\n` +
      `✦ Conectados: *${cap.connectedSubs}*\n` +
      `✦ Disponibles: *${cap.remaining}*\n` +
      `✦ Límite actual: *${cap.effectiveMax}*\n` +
      `✦ Recomendado (RAM): *${cap.recommendedMax}*\n\n` +
      `❒ Config\n` +
      `• Auto: ${auto}\n` +
      `• Manual: ${manual}\n` +
      `• Reserva RAM: ${cap.reserveMB}MB\n` +
      `• Estimación por bot: ${cap.perBotMB}MB\n` +
      `• Hard max: ${cap.hardMax}\n\n` +
      `Uso:\n` +
      `✦ ${usedPrefix + command} auto on|off\n` +
      `✦ ${usedPrefix + command} set <n>\n` +
      `✦ ${usedPrefix + command} apply\n` +
      `✦ ${usedPrefix + command} reserve <mb>\n` +
      `✦ ${usedPrefix + command} perbot <mb>\n` +
      `✦ ${usedPrefix + command} hardmax <n>`
    )
  }

  if (sub === 'auto') {
    const v = String(args[1] || '').toLowerCase()
    if (!v) return m.reply(`Uso: ${usedPrefix + command} auto on|off`)
    cfg.autoLimit = v === 'on' || v === '1' || v === 'true' || v === 'si' || v === 'sí'
    if (global.db?.write) await global.db.write().catch(() => {})
    const cap = info()
    return m.reply(`❀ Auto limit: *${cap.autoLimit ? 'Activado' : 'Desactivado'}* (limite: ${cap.effectiveMax})`)
  }

  if (sub === 'set') {
    const n = clampInt(args[1], { min: 1, max: 500, fallback: null })
    if (n == null) return m.reply(`Uso: ${usedPrefix + command} set <n>`)
    cfg.maxSubbots = n
    cfg.autoLimit = false
    if (global.db?.write) await global.db.write().catch(() => {})
    const cap = info()
    return m.reply(`❀ Límite manual: *${cap.effectiveMax}* (auto apagado)`)
  }

  if (sub === 'apply') {
    const cap = info()
    cfg.maxSubbots = cap.recommendedMax
    cfg.autoLimit = false
    if (global.db?.write) await global.db.write().catch(() => {})
    return m.reply(`❀ Aplicado: límite manual = *${cap.recommendedMax}*`)
  }

  if (sub === 'reserve') {
    const mb = clampInt(args[1], { min: 256, max: 262144, fallback: null })
    if (mb == null) return m.reply(`Uso: ${usedPrefix + command} reserve <mb>`)
    cfg.reserveMB = mb
    if (global.db?.write) await global.db.write().catch(() => {})
    const cap = info()
    return m.reply(`❀ Reserva RAM: *${cap.reserveMB}MB* (recomendado: ${cap.recommendedMax})`)
  }

  if (sub === 'perbot') {
    const mb = clampInt(args[1], { min: 50, max: 1024, fallback: null })
    if (mb == null) return m.reply(`Uso: ${usedPrefix + command} perbot <mb>`)
    cfg.perBotMB = mb
    if (global.db?.write) await global.db.write().catch(() => {})
    const cap = info()
    return m.reply(`❀ Estimación por bot: *${cap.perBotMB}MB* (recomendado: ${cap.recommendedMax})`)
  }

  if (sub === 'hardmax') {
    const n = clampInt(args[1], { min: 1, max: 500, fallback: null })
    if (n == null) return m.reply(`Uso: ${usedPrefix + command} hardmax <n>`)
    cfg.hardMax = n
    if (global.db?.write) await global.db.write().catch(() => {})
    const cap = info()
    return m.reply(`❀ Hard max: *${cap.hardMax}* (limite actual: ${cap.effectiveMax})`)
  }

  return m.reply(`Uso: ${usedPrefix + command}`)
}

handler.help = ['subbotcap']
handler.tags = ['owner']
handler.command = /^(subbotcap|subbotscap|capacidadsubbots|capsubbots)$/i
handler.owner = true

export default handler
