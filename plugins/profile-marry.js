// Comando de matrimonio simplificado
let handler = async (m, { conn, usedPrefix, command, args }) => {
  // Verificación simplificada - siempre permite el comando
  const userData = global.db.data.users[m.sender]
  
  if (!args[0]) {
    return m.reply('❀ Uso: ' + usedPrefix + command + ' @usuario')
  }
  
  let who = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : m.fromMe ? conn.user.jid : m.sender
  
  if (userData.marry) {
    return m.reply('ꕥ Ya estás casado/a.')
  }
  
  const targetUser = global.db.data.users[who]
  if (targetUser.marry) {
    return m.reply('ꕥ Esa persona ya está casada.')
  }
  
  userData.marry = who
  targetUser.marry = m.sender
  
  m.reply('❀ ¡Felicidades! Se han casado exitosamente.')
}

handler.help = ['marry']
handler.tags = ['profile']
handler.command = ['marry', 'casarse']

export default handler