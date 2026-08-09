let handler = async (m, { conn, usedPrefix }) => {
  const channelUrl = String(global.channel || '').trim()
  if (!channelUrl) return conn.reply(m.chat, 'No hay canal configurado en este bot.', m)
  return conn.reply(
    m.chat,
    `Canal de la desarrolladora:
${channelUrl}
`,
    m
  )
}

handler.help = ['canal']
handler.tags = ['info']
handler.command = ['canal', 'channel']

export default handler
