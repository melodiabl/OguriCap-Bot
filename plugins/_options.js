const handler = async (m, { conn, usedPrefix, command, args, isOwner, isAdmin }) => {
  const primaryBot = global.db.data.chats[m.chat].primaryBot
  if (primaryBot && conn.user.jid !== primaryBot) throw !1
  const chat = global.db.data.chats[m.chat] = global.db.data.chats[m.chat] || {}
  const { antiLink, detect, welcome, modoadmin, nsfw, economy, gacha } = chat
  let type = command.toLowerCase()
  let isEnable = chat[type] !== undefined ? chat[type] : false
  if (args[0] === 'on' || args[0] === 'enable') {
    if (isEnable) return conn.reply(m.chat, `ꕥ *${type}* ya estaba *activado*.`, m)
    isEnable = true
  } else if (args[0] === 'off' || args[0] === 'disable') {
    if (!isEnable) return conn.reply(m.chat, `ꕥ *${type}* ya estaba *desactivado*.`, m)
    isEnable = false
  } else {
    return conn.reply(m.chat, `「✦」Un administrador puede activar o desactivar el *${command}* utilizando:

● _Activar_ » *${usedPrefix}${command} enable*
● _Desactivar_ » *${usedPrefix}${command} disable*

ꕥ Estado actual » *${isEnable ? '✓ Activado' : '✗ Desactivado'}*`, m)
  }
  switch (type) {
    case 'welcome': case 'bienvenida': {
      if (!m.isGroup) {
        if (!isOwner) {
          global.dfail('group', m, conn)
          throw false
        }
      } else if (!isAdmin) {
        global.dfail('admin', m, conn)
        throw false
      }
      chat.welcome = isEnable

      // Emitir evento Socket.IO
      try {
        const { emitGrupoUpdated } = await import('../lib/socket-io.js')
        emitGrupoUpdated({ jid: m.chat, welcome: isEnable })
      } catch { }

      break
    }
    case 'modoadmin': case 'onlyadmin': {
      if (!m.isGroup) {
        if (!isOwner) {
          global.dfail('group', m, conn)
          throw false
        }
      } else if (!isAdmin) {
        global.dfail('admin', m, conn)
        throw false
      }
      chat.modoadmin = isEnable

      // Emitir evento Socket.IO
      try {
        const { emitGrupoUpdated } = await import('../lib/socket-io.js')
        emitGrupoUpdated({ jid: m.chat, modoadmin: isEnable })
      } catch { }

      break
    }
    case 'detect': case 'alertas': {
      if (!m.isGroup) {
        if (!isOwner) {
          global.dfail('group', m, conn)
          throw false
        }
      } else if (!isAdmin) {
        global.dfail('admin', m, conn)
        throw false
      }
      chat.detect = isEnable

      // Emitir evento Socket.IO
      try {
        const { emitGrupoUpdated } = await import('../lib/socket-io.js')
        emitGrupoUpdated({ jid: m.chat, detect: isEnable })
      } catch { }

      break
    }
    case 'antilink': case 'antienlace': {
      if (!m.isGroup) {
        if (!isOwner) {
          global.dfail('group', m, conn)
          throw false
        }
      } else if (!isAdmin) {
        global.dfail('admin', m, conn)
        throw false
      }
      chat.antiLink = isEnable

      // Emitir evento Socket.IO
      try {
        const { emitGrupoUpdated } = await import('../lib/socket-io.js')
        emitGrupoUpdated({ jid: m.chat, antiLink: isEnable })
      } catch { }

      break
    }
    case 'nsfw': case 'modohorny': {
      if (!m.isGroup) {
        if (!isOwner) {
          global.dfail('group', m, conn)
          throw false
        }
      } else if (!isAdmin) {
        global.dfail('admin', m, conn)
        throw false
      }
      chat.nsfw = isEnable

      // Emitir evento Socket.IO
      try {
        const { emitGrupoUpdated } = await import('../lib/socket-io.js')
        emitGrupoUpdated({ jid: m.chat, nsfw: isEnable })
      } catch { }

      break
    }
    case 'economy': case 'economia': {
      if (!m.isGroup) {
        if (!isOwner) {
          global.dfail('group', m, conn)
          throw false
        }
      } else if (!isAdmin) {
        global.dfail('admin', m, conn)
        throw false
      }
      chat.economy = isEnable

      // Emitir evento Socket.IO
      try {
        const { emitGrupoUpdated } = await import('../lib/socket-io.js')
        emitGrupoUpdated({ jid: m.chat, economy: isEnable })
      } catch { }

      break
    }
    case 'rpg': case 'gacha': {
      if (!m.isGroup) {
        if (!isOwner) {
          global.dfail('group', m, conn)
          throw false
        }
      } else if (!isAdmin) {
        global.dfail('admin', m, conn)
        throw false
      }
      chat.gacha = isEnable

      // Emitir evento Socket.IO
      try {
        const { emitGrupoUpdated } = await import('../lib/socket-io.js')
        emitGrupoUpdated({ jid: m.chat, gacha: isEnable })
      } catch { }

      break
    }
  }
  chat[type] = isEnable
  conn.reply(m.chat, `❀ Has *${isEnable ? 'activado' : 'desactivado'}* el *${type}* para este grupo.`, m)
}

handler.help = ['welcome', 'bienvenida', 'modoadmin', 'onlyadmin', 'nsfw', 'modohorny', 'economy', 'economia', 'rpg', 'gacha', 'detect', 'alertas', 'antilink', 'antienlace', 'antilinks', 'antienlaces']
handler.tags = ['nable']
handler.command = ['welcome', 'bienvenida', 'modoadmin', 'onlyadmin', 'nsfw', 'modohorny', 'economy', 'economia', 'rpg', 'gacha', 'detect', 'alertas', 'antilink', 'antienlace']
handler.group = true

export default handler
