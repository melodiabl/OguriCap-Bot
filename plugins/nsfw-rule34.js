import fetch from 'node-fetch'
import axios from 'axios'

const handler = async (m, { conn, command, args, usedPrefix }) => {
try {
if (!db.data.chats[m.chat].nsfw && m.isGroup) return m.reply(`ꕥ El contenido *NSFW* está desactivado en este grupo.\n\nUn *administrador* puede activarlo con:\n» *${usedPrefix}nsfw on*`)
if (!args[0]) return conn.reply(m.chat, `❀ Ingresa un tag para buscar.`, m)
await m.react('🕒')
const tag = args[0].replace(/\s+/g, '_')
let mediaList = []
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const res = await fetch(`${api.url}/search/booru?q=${encodeURIComponent(tag)}&adult=1&apikey=${encodeURIComponent(api.key)}`)
const json = await res.json()
if (!res.ok || !json.status || !Array.isArray(json.result)) throw new Error(json.error || 'Sin resultados')
mediaList = json.result.map(item => item.url).filter(Boolean)
} catch {}
if (!mediaList.length) {
switch (command) {
case 'rule34': case 'rule': case 'r34': {
const sources = [`https://rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${tag}`, `https://xbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${tag}`, `https://hypnohub.net/index.php?page=dapi&s=post&q=index&json=1&tags=${tag}`]
for (const url of sources) {
try {
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } })
const type = res.headers.get('content-type') || ''
if (!res.ok || !type.includes('json')) continue
const json = await res.json()
const data = Array.isArray(json) ? json : json?.post || json?.data || []
const valid = data.map(i => i?.file_url || i?.large_file_url || i?.image).filter(u => typeof u === 'string' && /\.(jpe?g|png|gif|mp4)$/.test(u))
if (valid.length) {
mediaList = [...new Set(valid)].sort(() => Math.random() - 0.5)
break
}} catch {}
}
break
}
case 'danbooru': case 'dbooru': {
const url = `https://danbooru.donmai.us/posts.json?tags=${encodeURIComponent(tag)}`
const res = await fetch(url)
const json = await res.json()
mediaList = json.map(p => p?.file_url).filter(u => typeof u === 'string' && /\.(jpe?g|png|gif)$/.test(u))
break
}
case 'gelbooru': case 'gbooru': {
const url = `${global.APIs.delirius.url}/search/gelbooru?query=${encodeURIComponent(tag)}`
const res = await axios.get(url)
const data = res.data?.data || []
const valid = data.map(i => i?.image).filter(u => typeof u === 'string' && /\.(jpe?g|png|gif|mp4)$/.test(u))
if (valid.length) mediaList = [...new Set(valid)].sort(() => Math.random() - 0.5)
break
}}
}
if (!mediaList.length) return conn.reply(m.chat, `ꕥ No se encontraron resultados para *${tag}*`, m)
const media = mediaList[Math.floor(Math.random() * mediaList.length)]
const caption = `❀ Resultados para » *${tag}*`
if (media.endsWith('.mp4')) {
await conn.sendMessage(m.chat, { video: { url: media }, caption, mentions: [m.sender] })
} else {
await conn.sendMessage(m.chat, { image: { url: media }, caption, mentions: [m.sender] })
}
await m.react('✔️')
} catch (error) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
}}

handler.command = ['r34', 'rule34', 'rule', 'danbooru', 'dbooru', 'gelbooru', 'gbooru']
handler.help = ['r34', 'danbooru', 'gelbooru']
handler.tags = ['nsfw']
handler.group = true
handler.premium = true

export default handler
