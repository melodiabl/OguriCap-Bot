let handler = async (m, { conn, usedPrefix }) => {
  const channelUrl = String(global.channel || '').trim()
  if (!channelUrl) return conn.reply(m.chat, 'No hay canal configurado en este bot.', m)
  return conn.reply(
    m.chat,
    `Canal de la desarrolladora:
${channelUrl}

Si el bot te lo pide, reenvia un post del canal y escribe: ${usedPrefix}verificar`,
    m
  )
}

handler.help = ['canal']
handler.tags = ['info']
handler.command = ['canal', 'channel']

export default handler
