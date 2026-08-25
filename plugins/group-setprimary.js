

import { areJidsSameUser } from 'baileys'

const handler = async (m, { conn }) => {
  const subBots = [...new Set([...(global.conns || []).filter((conn) => conn.user && conn.isConnected).map((conn) => conn.user.jid)])]
  if (global.conn?.user?.jid && !subBots.includes(global.conn.user.jid)) {
    subBots.push(global.conn.user.jid)
  }
  const chat = global.db.data.chats[m.chat]
  const mentionedJid = await m.mentionedJid
  const who = mentionedJid[0] ? mentionedJid[0] : m.quoted ? await m.quoted.sender : false
  if (!who) return conn.reply(m.chat, `❀ Por favor, menciona a un Socket para hacerlo Bot principal del grupo.`, m)
  const selectedBot = subBots.find(jid => areJidsSameUser(jid, who))
  if (!selectedBot) return conn.reply(m.chat, `ꕥ El usuario mencionado no es un Socket de: *${botname}*.`, m)
  if (chat.primaryBot && areJidsSameUser(chat.primaryBot, selectedBot)) {
    return conn.reply(m.chat, `ꕥ @${selectedBot.split`@`[0]} ya esta como Bot primario en este grupo.`, m, { mentions: [selectedBot] });
  }
  try {
    chat.primaryBot = selectedBot
    if (typeof global.db?.write !== 'function') throw new Error('La base de datos no está disponible.')
    await global.db.write()

    // Emitir evento Socket.IO
    try {
      const { emitGrupoUpdated } = await import('../services/socket-io.js')
      emitGrupoUpdated({ jid: m.chat, primaryBot: selectedBot })
    } catch { }

    await conn.reply(m.chat, `❀ Se ha establecido a @${selectedBot.split`@`[0]} como Bot primario de este grupo.\n> Ahora todos los comandos de este grupo serán ejecutados por @${selectedBot.split`@`[0]}.`, m, { mentions: [selectedBot] })
  } catch (e) {
    await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e.message}`, m)
  }
}

handler.help = ['setprimary']
handler.tags = ['grupo']
handler.command = ['setprimary']
handler.group = true
handler.admin = true

export default handler
