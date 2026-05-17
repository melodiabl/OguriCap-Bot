/**
 * Plugin de control del bot sincronizado con el panel
 * Permite controlar el bot globalmente (solo owner)
 */

let handler = async (m, { args, usedPrefix, command, conn, isOwner }) => {
  const panel = global.db.data.panel || (global.db.data.panel = {})

  switch (command) {
    // ===== CONTROL GLOBAL DEL BOT (Solo Owner) =====
    case 'botglobal': {
      if (!isOwner) return m.reply('❌ Solo el owner puede usar este comando')

      const action = args[0]?.toLowerCase()

      if (action === 'on') {
        panel.botGlobalState = { isOn: true, lastUpdated: new Date().toISOString() }

        // Emitir evento Socket.IO
        try {
          const { emitBotStatus } = await import('../lib/socket-io.js')
          emitBotStatus()
        } catch { }

        return m.reply('✅ Bot activado globalmente\n\nEl bot responderá en todos los grupos.')
      }

      if (action === 'off') {
        panel.botGlobalState = { isOn: false, lastUpdated: new Date().toISOString() }

        // Emitir evento Socket.IO
        try {
          const { emitBotStatus } = await import('../lib/socket-io.js')
          emitBotStatus()
        } catch { }

        return m.reply('⚠️ Bot desactivado globalmente\n\nEl bot no responderá comandos hasta que se reactive.')
      }

      const estado = panel.botGlobalState?.isOn !== false ? '✅ Activado' : '❌ Desactivado'
      return m.reply(`🤖 *Estado Global del Bot*

Estado: ${estado}

Usa:
${usedPrefix}botglobal on - Activar
${usedPrefix}botglobal off - Desactivar`)
    }

    case 'setoffmsg': {
      if (!isOwner) return m.reply('❌ Solo el owner puede usar este comando')

      const mensaje = args.join(' ').trim()
      if (!mensaje) {
        const actual = panel.botGlobalOffMessage || 'El bot está desactivado globalmente.'
        return m.reply(`📝 *Mensaje de bot desactivado*

Actual: ${actual}

Uso: ${usedPrefix}setoffmsg <mensaje>`)
      }

      panel.botGlobalOffMessage = mensaje
      return m.reply(`✅ Mensaje actualizado:\n\n${mensaje}`)
    }

    default:
      return null
  }
}

handler.help = ['botglobal', 'setoffmsg']
handler.tags = ['owner']
handler.command = ['botglobal', 'setoffmsg']

export default handler
