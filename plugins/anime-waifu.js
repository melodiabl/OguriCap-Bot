import fetch from 'node-fetch'

let handler = async (m, { conn, usedPrefix, command }) => {
try {
await m.react('🕒')
let imgUrl
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const res = await fetch(`${api.url}/anime/waifu?apikey=${encodeURIComponent(api.key)}`)
const json = await res.json()
if (!res.ok || !json.status || !json.result?.image) throw new Error(json.error || 'Sin resultados')
imgUrl = json.result.image
} catch {
const res = await fetch('https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=50&tags=1girl+solo', { headers: { 'User-Agent': 'Mozilla/5.0' } })
const json = await res.json()
const p = json[Math.floor(Math.random() * json.length)]
imgUrl = `https://safebooru.org/images/${p.directory}/${p.image}`
}
await conn.sendFile(m.chat, imgUrl, 'thumbnail.jpg', '❀ Aquí tienes tu *Waifu* ฅ^•ﻌ•^ฅ.', fkontak)
await m.react('✔️')
} catch (error) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
}}

handler.help = ['waifu']
handler.tags = ['anime']
handler.command = ['waifu']
handler.group = true

export default handler
