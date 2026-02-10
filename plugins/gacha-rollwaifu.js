import fetch from 'node-fetch'
import { promises as fs } from 'fs'

const FILE_PATH = './lib/characters.json'

async function loadCharacters() {
  try {
    await fs.access(FILE_PATH)
  } catch {
    await fs.writeFile(FILE_PATH, '{}')
  }
  const data = await fs.readFile(FILE_PATH, 'utf-8')
  return JSON.parse(data)
}

function flattenCharacters(characters) {
  return Object.values(characters).flatMap(series => 
    Array.isArray(series.characters) ? series.characters : []
  )
}

function getSeriesNameByCharacter(characters, characterId) {
  return Object.entries(characters).find(([, series]) => 
    Array.isArray(series.characters) && 
    series.characters.some(char => String(char.id) === String(characterId))
  )?.[1]?.name || 'Desconocido'
}

function formatTag(tag) {
  return String(tag).toLowerCase().trim().replace(/\s+/g, '_')
}

async function buscarImagenDelirius(characterName) {
  const tag = formatTag(characterName)
  const urls = [
    `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${tag}`,
    `https://danbooru.donmai.us/posts.json?tags=${tag}`,
    `${global.APIs.delirius.url}/search/gelbooru?query=${tag}`
  ]
  
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      })
      
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.includes('json')) continue
      
      const data = await response.json()
      const posts = Array.isArray(data) ? data : data?.post || data?.posts || []
      const images = posts.map(post => 
        post?.file_url || post?.large_file_url || post?.url || post?.media_asset?.variants?.[0]?.url
      ).filter(url => typeof url === 'string' && /\.(jpe?g|png)$/.test(url))
      
      if (images.length) return images
    } catch {}
  }
  return []
}

// Función de verificación simplificada - siempre retorna true
const verifi = async () => {
  return true // Eliminada verificación del repositorio
}

const handler = async (m, { conn, usedPrefix, command }) => {
  if (!await verifi()) return conn.reply(m.chat, `❀ El comando *${command}* está temporalmente deshabilitado.`, m)
  
  const chats = global.db.data.chats
  if (!chats[m.chat]) chats[m.chat] = {}
  const chatData = chats[m.chat]
  if (!chatData.characters) chatData.characters = {}
  
  if (!chatData.gacha && m.isGroup) {
    return m.reply(`ꕥ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}gacha on*`)
  }
  
  const userData = global.db.data.users[m.sender]
  const now = Date.now()
  const cooldown = 15 * 60 * 1000 // 15 minutos
  
  if (userData.lastRoll && now < userData.lastRoll) {
    const remaining = Math.ceil((userData.lastRoll - now) / 1000)
    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    
    let timeStr = ''
    if (minutes > 0) timeStr += minutes + ' minuto' + (minutes !== 1 ? 's' : '') + ' '
    if (seconds > 0 || timeStr === '') timeStr += seconds + ' segundo' + (seconds !== 1 ? 's' : '')
    
    return m.reply(`ꕥ Debes esperar *${timeStr.trim()}* para usar *${usedPrefix + command}* de nuevo.`)
  }
  
  try {
    const characters = await loadCharacters()
    const allCharacters = flattenCharacters(characters)
    const randomCharacter = allCharacters[Math.floor(Math.random() * allCharacters.length)]
    const characterId = String(randomCharacter.id)
    const seriesName = getSeriesNameByCharacter(characters, randomCharacter.id)
    const characterTag = formatTag(randomCharacter.variants?.[0] || '')
    const images = await buscarImagenDelirius(characterTag)
    const randomImage = images[Math.floor(Math.random() * images.length)]
    
    if (!randomImage) {
      return m.reply(`ꕥ No se encontró imágenes para el personaje *${randomCharacter.name}*.`)
    }
    
    if (!global.db.data.characters) global.db.data.characters = {}
    if (!global.db.data.characters[characterId]) global.db.data.characters[characterId] = {}
    
    const charData = global.db.data.characters[characterId]
    const existingChar = global.db.data.characters?.[characterId] || {}
    
    charData.name = String(randomCharacter.name || 'Sin nombre')
    charData.value = typeof existingChar.value === 'number' ? existingChar.value : Number(randomCharacter.value) || 100
    charData.votes = Number(charData.votes || existingChar.votes || 0)
    charData.reservedBy = m.sender
    charData.reservedUntil = now + 20000 // 20 segundos
    charData.expiresAt = now + 60000 // 1 minuto
    
    let ownerName = 'desconocido'
    if (typeof charData.user === 'string' && charData.user.trim()) {
      ownerName = global.db.data.users[charData.user]?.name?.trim() || 
                 await conn.getName(charData.user).catch(() => charData.user.split('@')[0])
    }
    
    const caption = `❀ Nombre » *${charData.name}*\n⚥ Género » *${randomCharacter.gender || 'Desconocido'}*\n✰ Valor » *${charData.value.toLocaleString()}*\n♡ Estado » *${charData.user ? `Reclamado por ${ownerName}` : 'Libre'}*\n❖ Fuente » *${seriesName}*`
    
    const sentMessage = await conn.sendFile(m.chat, randomImage, charData.name + '.jpg', caption, m)
    
    chatData.lastRolledId = characterId
    chatData.lastRolledMsgId = sentMessage.key?.id || null
    chatData.lastRolledCharacter = {
      id: characterId,
      name: charData.name,
      media: randomImage
    }
    userData.lastRoll = now + cooldown
    
  } catch (error) {
    await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
  }
}

handler.help = ['ver', 'rw', 'rollwaifu']
handler.tags = ['gacha']
handler.command = ['rollwaifu', 'rw', 'roll']
handler.group = true

export default handler