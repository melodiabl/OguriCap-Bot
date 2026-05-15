function safeOwnerJids() {
  const owners = Array.isArray(global.owner) ? global.owner : []
  return owners.map(n => String(n || '').replace(/[^0-9]/g, '') + '@s.whatsapp.net').filter(j => j !== '@s.whatsapp.net')
}

const handler = async (m, { conn, command, usedPrefix }) => {
  const allowed = [conn.user.jid, ...safeOwnerJids()].includes(m.sender)
  if (!allowed) return m.reply(`❀ El comando *${command}* solo puede ser ejecutado por el Socket.`)

  const q = m.quoted || m
  const mime = (q.msg || q).mimetype || ''
  if (!/image/.test(mime)) return m.reply(`❀ Responde o envía una imagen para cambiar el icono del bot.`)

  await m.react('🕒')
  const media = await q.download()
  if (!media) return m.reply('ꕥ No se pudo obtener la imagen.')

  try {
    await conn.updateProfilePicture(conn.user.jid, media)
    await m.react('✔️')
    return m.reply('❀ Se cambió el *icono* del bot correctamente.')
  } catch (error) {
    await m.react('✖️')
    return m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`)
  }
}

handler.help = ['seticon', 'setboticon']
handler.tags = ['serbot']
handler.command = ['seticon', 'setboticon']

export default handler
