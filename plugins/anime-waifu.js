import fetch from 'node-fetch'

let handler = async (m, { conn, usedPrefix, command }) => {
try {
await m.react('🕒')
// waifu.pics cerró y nekos.best bloquea node desde este VPS (Cloudflare TLS).
// safebooru responde sin problemas.
let res = await fetch('https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&limit=50&tags=1girl+solo', { headers: { 'User-Agent': 'Mozilla/5.0' } })
if (!res.ok) return
let json = await res.json()
if (!Array.isArray(json) || !json.length) return
const p = json[Math.floor(Math.random() * json.length)]
const imgUrl = `https://safebooru.org/images/${p.directory}/${p.image}`
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