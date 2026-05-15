/**
 * owner-plugins.js — Gestión de plugins desde WhatsApp (solo owner)
 * Comandos: #plugin list | #plugin off <nombre> [mensaje] | #plugin on <nombre>
 */

const handler = async (m, { conn, args, usedPrefix, command, isOwner }) => {
  if (!isOwner) return m.reply(`ꕥ Solo el *owner* puede gestionar plugins.`)

  const sub = args[0]?.toLowerCase()

  // Asegurar estructura en db
  if (!global.db.data.panel) global.db.data.panel = {}
  if (!global.db.data.panel.disabledPlugins) global.db.data.panel.disabledPlugins = {}

  const disabled = global.db.data.panel.disabledPlugins

  // ── LIST ──────────────────────────────────────────────────────────────────
  if (!sub || sub === 'list') {
    const all = Object.keys(global.plugins || {})
    const dis = all.filter(p => global.plugins[p]?.disabled)
    const en  = all.filter(p => !global.plugins[p]?.disabled)
    return m.reply(
      `*🔌 Plugins (${all.length})*\n\n` +
      `✅ *Activos (${en.length}):*\n${en.map(p => `  • ${p.replace('.js','')}`).join('\n') || '  ninguno'}\n\n` +
      `❌ *Desactivados (${dis.length}):*\n${dis.map(p => `  • ${p.replace('.js','')}`).join('\n') || '  ninguno'}`
    )
  }

  // ── OFF ───────────────────────────────────────────────────────────────────
  if (sub === 'off') {
    const name = args[1]
    if (!name) return m.reply(`ꕥ Uso: ${usedPrefix}plugin off <nombre> [mensaje]`)

    const key = resolvePluginKey(name)
    if (!key) return m.reply(`ꕥ Plugin *${name}* no encontrado.`)

    const msg = args.slice(2).join(' ').trim() || null
    global.plugins[key].disabled = true
    disabled[key] = { disabled: true, message: msg, disabledAt: new Date().toISOString() }

    return m.reply(`❌ Plugin *${key.replace('.js','')}* desactivado.${msg ? `\n> Mensaje: _${msg}_` : ''}`)
  }

  // ── ON ────────────────────────────────────────────────────────────────────
  if (sub === 'on') {
    const name = args[1]
    if (!name) return m.reply(`ꕥ Uso: ${usedPrefix}plugin on <nombre>`)

    const key = resolvePluginKey(name)
    if (!key) return m.reply(`ꕥ Plugin *${name}* no encontrado.`)

    if (global.plugins[key]) global.plugins[key].disabled = false
    delete disabled[key]

    return m.reply(`✅ Plugin *${key.replace('.js','')}* activado.`)
  }

  return m.reply(`ꕥ Subcomando no reconocido.\nUso: ${usedPrefix}plugin list | off <nombre> [msg] | on <nombre>`)
}

function resolvePluginKey(name) {
  const plugins = global.plugins || {}
  // exacto
  if (plugins[name]) return name
  // con .js
  if (plugins[name + '.js']) return name + '.js'
  // búsqueda parcial case-insensitive
  const lower = name.toLowerCase()
  return Object.keys(plugins).find(k => k.toLowerCase().includes(lower)) || null
}

handler.command = ['plugin', 'plugins']
handler.help    = ['plugin list', 'plugin off <nombre> [mensaje]', 'plugin on <nombre>']
handler.tags    = ['owner']
handler.owner   = true

export default handler
