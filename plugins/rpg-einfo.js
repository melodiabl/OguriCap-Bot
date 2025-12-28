// Comando de información económica simplificado
let handler = async (m, { conn, usedPrefix, command }) => {
  // Verificación simplificada - siempre permite el comando
  const userData = global.db.data.users[m.sender]
  
  const info = `❀ INFORMACIÓN ECONÓMICA

💰 Monedas: ${userData.coin || 0}
🏦 Banco: ${userData.bank || 0}
⭐ Experiencia: ${userData.exp || 0}
📊 Nivel: ${userData.level || 0}
❤️ Salud: ${userData.health || 100}

> Usa los comandos de economía para ganar más recursos`

  m.reply(info)
}

handler.help = ['einfo']
handler.tags = ['rpg']
handler.command = ['einfo', 'economyinfo']

export default handler