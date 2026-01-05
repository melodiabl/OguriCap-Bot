/**
 * Plugin de registro para el panel (desde WhatsApp)
 * Por seguridad, las credenciales se envían SIEMPRE al privado.
 */

const ensureStore = () => {
  global.db.data ||= {}
  global.db.data.panel ||= {}
  global.db.data.panel.registros ||= {}
  global.db.data.panel.registrosCounter ||= 0
  global.db.data.users ||= {}
}

const nextId = () => {
  global.db.data.panel.registrosCounter = (global.db.data.panel.registrosCounter || 0) + 1
  return global.db.data.panel.registrosCounter
}

let handler = async (m, { args, usedPrefix, command, conn, isOwner }) => {
  ensureStore()
  const panel = global.db.data.panel
  const user = global.db.data.users[m.sender]
  const panelUrl = process.env.PANEL_URL || 'https://melodiaauris.qzz.io'
  const isGroupChat = String(m.chat || '').endsWith('@g.us')

  async function replyPrivate(text) {
    return conn.reply(m.sender, text, m)
  }

  async function replyGroup(text, opts = {}) {
    return conn.reply(m.chat, text, m, { mentions: [m.sender], ...(opts || {}) })
  }

  switch (command) {
    case 'reg':
    case 'registro':
    case 'register': {
      const existingReg = Object.values(panel.registros || {}).find((r) => r.wa_jid === m.sender)
      if (existingReg) {
        const temp = existingReg.temp_password
          ? `\n\n🔑 Contraseña temporal: ${existingReg.temp_password}\n⚠️ Cámbiala al iniciar.`
          : ''
        const msgPriv =
          `✅ Ya estás registrado\n\n` +
          `👤 Usuario: @${m.sender.split('@')[0]}\n` +
          `🆔 ID: #${existingReg.id}\n` +
          `📅 Fecha: ${new Date(existingReg.fecha_registro).toLocaleDateString()}\n` +
          `🛡️ Rol: ${existingReg.rol || 'usuario'}\n\n` +
          `🌐 Panel: ${panelUrl}\n\n` +
          `🔐 Usuario: ${existingReg.username || 'admin'}` +
          `${temp}\n\n` +
          `Si no recuerdas tu contraseña, usa el reset desde el panel o pide soporte a un admin.`

        try {
          await replyPrivate(msgPriv)
          if (isGroupChat) return replyGroup('✅ Ya estás registrado. Te envié los datos al privado.')
          return null
        } catch {
          return m.reply(
            `✅ Ya estás registrado.\n\n🌐 Panel: ${panelUrl}\n\nNo pude enviarte mensaje al privado. Escríbeme por privado y repite: ${usedPrefix}${command} ${existingReg.username || ''}`
          )
        }
      }

      const raw = (args || []).join(' ').trim()
      if (!raw) {
        return m.reply(
          `📝 Registro en el Panel\n\n` +
            `Uso: ${usedPrefix}${command} <nombre de usuario>\n` +
            `Ejemplo: ${usedPrefix}${command} MiNombre\n\n` +
            `⚠️ Por seguridad, las credenciales se envían al privado.`
        )
      }

      const username = raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20)
      if (username.length < 3) return m.reply('❌ El nombre de usuario debe tener al menos 3 caracteres alfanuméricos')

      const usernameExists = Object.values(panel.registros || {}).find(
        (r) => String(r.username || '').toLowerCase() === username.toLowerCase()
      )
      if (usernameExists) return m.reply(`❌ El nombre de usuario "${username}" ya está en uso. Elige otro.`)

      const id = nextId()
      const now = new Date().toISOString()
      const tempPasswordExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      let tempPassword = `temp${Math.random().toString(36).slice(2, 8)}`

      const registro = {
        id,
        wa_jid: m.sender,
        wa_number: m.sender.split('@')[0],
        username,
        nombre: m.pushName || username,
        rol: 'usuario',
        fecha_registro: now,
        activo: true,
        verificado: false,
        temp_password: tempPassword,
        temp_password_expires: tempPasswordExpires,
        temp_password_used: false,
        require_password_change: true,
      }

      panel.registros[id] = registro

      panel.users ||= {}
      const userId = Object.keys(panel.users).length + 1
      panel.users[userId] = {
        id: userId,
        username,
        email: '',
        whatsapp_number: m.sender.split('@')[0],
        rol: 'usuario',
        fecha_registro: now,
        activo: true,
        temp_password: tempPassword,
        temp_password_expires: tempPasswordExpires,
        temp_password_used: false,
        require_password_change: true,
      }

      // Registrar también en el sistema JWT usando auto-register (si está disponible)
      try {
        const response = await fetch(`http://localhost:${process.env.PORT || 8080}/api/auth/auto-register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            whatsapp_number: m.sender,
            username: username,
            grupo_jid: m.chat,
          }),
        })

        if (response.ok) {
          const data = await response.json().catch(() => ({}))
          if (data?.tempPassword) {
            tempPassword = data.tempPassword
            registro.temp_password = tempPassword
            panel.users[userId].temp_password = tempPassword
          }
          if (data?.tempPasswordExpires) {
            registro.temp_password_expires = data.tempPasswordExpires
            panel.users[userId].temp_password_expires = data.tempPasswordExpires
          }
        }
      } catch (error) {
        console.warn('Error registering in JWT system:', error?.message || error)
      }

      if (user) {
        user.registered = true
        user.registeredAt = now
        user.panelUsername = username
      }

      const mensajePriv = [
        `✅ ¡Registro Exitoso!`,
        ``,
        `👤 Usuario: ${username}`,
        `🛡️ Rol: usuario`,
        `🌐 Panel: ${panelUrl}`,
        ``,
        `🔐 Credenciales:`,
        `• Usuario: ${username}`,
        `• Contraseña temporal: ${tempPassword}`,
        `• Válida hasta: ${new Date(registro.temp_password_expires).toLocaleString()}`,
        ``,
        `Pasos:`,
        `1) Abre el panel`,
        `2) Ingresa usuario y contraseña temporal`,
        `3) Selecciona el rol "usuario"`,
        `4) Cambia tu contraseña en el primer login`,
      ].join('\n')

      try {
        const { emitNotification } = await import('../lib/socket-io.js')
        emitNotification({
          type: 'success',
          title: 'Nuevo Registro',
          message: `${username} se ha registrado desde WhatsApp`,
        })
      } catch {}

      try {
        await replyPrivate(mensajePriv)
        if (isGroupChat) {
          return replyGroup(
            '✅ Registro exitoso. Te envié tus credenciales al privado. Si no te llega, escríbeme al privado y repite el comando.'
          )
        }
        return null
      } catch {
        return m.reply(
          `❌ No pude enviarte mensaje al privado.\n\n1) Escríbeme por privado primero.\n2) Luego repite: ${usedPrefix}${command} ${username}`
        )
      }
    }

    case 'miregistro':
    case 'myregister':
    case 'miperfil': {
      const registro = Object.values(panel.registros || {}).find((r) => r.wa_jid === m.sender)
      if (!registro) return m.reply(`❌ No estás registrado.\n\nUsa ${usedPrefix}reg <nombre> para registrarte.`)

      const mensaje = [
        `📋 Tu Perfil de Registro`,
        ``,
        `🆔 ID: #${registro.id}`,
        `👤 Usuario: ${registro.username}`,
        `📱 WhatsApp: ${registro.wa_number}`,
        `🧾 Nombre: ${registro.nombre}`,
        `🛡️ Rol: ${registro.rol}`,
        `📅 Registrado: ${new Date(registro.fecha_registro).toLocaleDateString()}`,
        `✅ Estado: ${registro.activo ? 'Activo' : 'Inactivo'}`,
        ``,
        `🌐 Panel: ${panelUrl}`,
      ].join('\n')

      if (isGroupChat) {
        try {
          await replyPrivate(mensaje)
          return replyGroup('✅ Te envié tu perfil al privado.')
        } catch {
          return m.reply('❌ No pude enviarte tu perfil al privado. Escríbeme por privado e intenta de nuevo.')
        }
      }

      return m.reply(mensaje)
    }

    case 'panelinfo':
    case 'infopanel': {
      const totalRegistros = Object.keys(panel.registros || {}).length
      const mensaje = [
        `🌐 Información del Panel`,
        ``,
        `📊 Estadísticas:`,
        `• Usuarios registrados: ${totalRegistros}`,
        `• Grupos: ${Object.keys(panel.groups || {}).length}`,
        `• Aportes: ${(global.db.data.aportes || []).length}`,
        `• Pedidos: ${Object.keys(panel.pedidos || {}).length}`,
        ``,
        `🔗 Acceso:`,
        `${panelUrl}`,
        ``,
        `📌 Comandos:`,
        `• ${usedPrefix}reg <nombre> - Registrarse`,
        `• ${usedPrefix}miregistro - Ver tu perfil (se envía al privado si estás en grupo)`,
        `• ${usedPrefix}panelinfo - Esta información`,
      ].join('\n')
      return m.reply(mensaje)
    }

    case 'delreg':
    case 'eliminarregistro': {
      if (!isOwner) return m.reply('❌ Solo el owner puede eliminar registros')

      const target = args[0]
      if (!target) return m.reply(`Uso: ${usedPrefix}${command} <id o @usuario>`)

      let registro = null
      const mentioned = m.mentionedJid?.[0]

      if (mentioned) {
        registro = Object.values(panel.registros || {}).find((r) => r.wa_jid === mentioned)
      } else {
        const id = parseInt(target)
        if (id) registro = panel.registros[id]
        else {
          registro = Object.values(panel.registros || {}).find(
            (r) =>
              String(r.username || '').toLowerCase() === target.toLowerCase() ||
              r.wa_number === target.replace(/[^0-9]/g, '')
          )
        }
      }

      if (!registro) return m.reply('❌ Registro no encontrado')
      delete panel.registros[registro.id]
      return m.reply(`✅ Registro de ${registro.username} (#${registro.id}) eliminado`)
    }

    case 'listregs':
    case 'registros': {
      if (!isOwner) return m.reply('❌ Solo el owner puede ver todos los registros')

      const registros = Object.values(panel.registros || {})
      if (!registros.length) return m.reply('📋 No hay usuarios registrados')

      const lista = registros
        .slice(0, 20)
        .map((r, i) => `${i + 1}. ${r.username} (@${r.wa_number}) - ${r.rol}`)
        .join('\n')

      return m.reply(`📋 Usuarios Registrados (${registros.length})\n\n${lista}`)
    }

    default:
      return null
  }
}

handler.help = ['reg', 'registro', 'miregistro', 'panelinfo', 'delreg', 'registros']
handler.tags = ['tools', 'panel']
handler.command = [
  'reg',
  'registro',
  'register',
  'miregistro',
  'myregister',
  'miperfil',
  'panelinfo',
  'infopanel',
  'delreg',
  'eliminarregistro',
  'listregs',
  'registros',
]

export default handler
