import { promises as fs } from 'fs'

const charactersFilePath = './lib/characters.json'

async function loadCharacters() {
  const data = await fs.readFile(charactersFilePath, 'utf-8')
  return JSON.parse(data)
}

function getCharacterById(id, characters) {
  return Object.values(characters)
    .flatMap(series => series.characters)
    .find(char => char.id === id)
}

const verifi = async () => true

let handler = async (m, { conn, usedPrefix, command }) => {
  if (!await verifi()) {
    return conn.reply(m.chat, `❀ El comando *${command}* está temporalmente deshabilitado.`, m)
  }

  const chatData = global.db.data.chats?.[m.chat] || {}

  if (m.isGroup && !chatData.gacha) {
    return m.reply(
      `ꕥ Los comandos de *Gacha* están desactivados en este grupo.\n\n` +
      `Un *administrador* puede activarlos con:\n» *${usedPrefix}gacha on*`
    )
  }

  try {
    const userData = global.db.data.users[m.sender]
    const now = Date.now()
    const cooldown = 30 * 60 * 1000

    if (userData.lastClaim && now < userData.lastClaim) {
      const remaining = Math.ceil((userData.lastClaim - now) / 1000)
      const min = Math.floor(remaining / 60)
      const sec = remaining % 60

      let t = ''
      if (min) t += `${min} minuto${min !== 1 ? 's' : ''} `
      if (sec || !t) t += `${sec} segundo${sec !== 1 ? 's' : ''}`

      return m.reply(
        `ꕥ Debes esperar *${t.trim()}* para usar *${usedPrefix + command}* nuevamente.`
      )
    }

    if (!m.quoted) {
      return m.reply('❀ Debes responder al mensaje del personaje para reclamarlo.')
    }

    if (!chatData.lastRolledMsgId || !chatData.lastRolledId) {
      return m.reply('ꕥ No hay ningún personaje pendiente para reclamar.')
    }

    if (m.quoted.key?.id !== chatData.lastRolledMsgId) {
      return m.reply('❀ Debes responder al *ÚLTIMO* personaje rolado.')
    }

    const characters = await loadCharacters()
    const rolledId = chatData.lastRolledId
    const character = getCharacterById(rolledId, characters)

    if (!character) {
      return m.reply('ꕥ Personaje no encontrado en *characters.json*')
    }

    global.db.data.characters ||= {}
    global.db.data.characters[rolledId] ||= {}

    const charData = global.db.data.characters[rolledId]

    charData.name ??= character.name
    charData.value = typeof charData.value === 'number'
      ? charData.value
      : character.value || 0
    charData.votes ||= 0

    if (
      charData.reservedBy &&
      charData.reservedBy !== m.sender &&
      now < charData.reservedUntil
    ) {
      const by = global.db.data.users[charData.reservedBy]?.name
        || charData.reservedBy.split('@')[0]

      const t = ((charData.reservedUntil - now) / 1000).toFixed(1)
      return m.reply(`ꕥ Este personaje está protegido por *${by}* durante *${t}s*.`)
    }

    if (charData.expiresAt && now > charData.expiresAt && !charData.user) {
      const t = ((now - charData.expiresAt) / 1000).toFixed(1)
      return m.reply(`ꕥ El personaje ha expirado » ${t}s.`)
    }

    if (charData.user) {
      const owner = global.db.data.users[charData.user]?.name
        || charData.user.split('@')[0]

      return m.reply(`ꕥ El personaje *${charData.name}* ya fue reclamado por *${owner}*`)
    }

    charData.user = m.sender
    charData.claimedAt = now
    delete charData.reservedBy
    delete charData.reservedUntil

    userData.lastClaim = now + cooldown
    userData.characters ||= []

    if (!userData.characters.includes(rolledId)) {
      userData.characters.push(rolledId)
    }

    const userName = userData.name || m.sender.split('@')[0]
    const charName = charData.name
    const claimMsg = userData.claimMessage

    const msg = claimMsg
      ? claimMsg
          .replace(/€user/g, `*${userName}*`)
          .replace(/€character/g, `*${charName}*`)
      : `*${charName}* ha sido reclamado por *${userName}*`

    await conn.reply(m.chat, `❀ ${msg}`, m)

  } catch (err) {
    await conn.reply(
      m.chat,
      `⚠︎ Error inesperado.\nUsa *${usedPrefix}report*\n\n${err.message}`,
      m
    )
  }
}

handler.help = ['claim']
handler.tags = ['gacha']
handler.command = ['claim', 'c', 'reclamar']
handler.group = true

export default handler