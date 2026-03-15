import fetch from 'node-fetch'

let handler = async (m, { text, usedPrefix, command, conn }) => {
if (!text) return m.reply(`❀ Por favor, escribe el nombre de la canción para obtener la letra`)
try {
await m.react('🕒')
const normalize = (json) => {
if (!json) return null
if (json.status && json.data && (json.data.lyrics || json.data?.lyrics === '')) {
return { title: json.data.title || json.data.name || 'Desconocido', artists: json.data.artists || json.data.artist || 'Desconocido', lyrics: json.data.lyrics, image: json.data.image || null, url: json.data.url || null }}
if (json.status && (json.lyrics || json.lyrics === '')) {
return { title: json.title || json.name || 'Desconocido', artists: json.artist || json.artists || 'Desconocido', lyrics: json.lyrics, image: json.image || null, url: json.url || null }}
return null
}
 let primaryRes = null
 // MelodyApi first
 try {
 const mel = global.APIs?.MelodyApi?.url
 if (mel) {
 const res0 = await fetch(`${mel}/search/lyrics?q=${encodeURIComponent(text)}`)
 if (!res0.ok) throw new Error(`MelodyApi HTTP: ${res0.status}`)
 const json0 = await res0.json()
 if (json0 && json0.status && typeof json0.result === 'string') {
 primaryRes = { title: text, artists: 'Desconocido', lyrics: json0.result, image: null, url: null }
 }
 }
 } catch (e) {
 primaryRes = null
 }

 try {
 const res = await fetch(`${global.APIs.delirius.url}/search/lyrics?query=${encodeURIComponent(text)}`)
 if (!res.ok) throw new Error(`Delirius HTTP: ${res.status}`)
 const json = await res.json()
 if (!primaryRes) primaryRes = normalize(json)
 } catch (e) {
 if (!primaryRes) primaryRes = null
 }
let final = primaryRes
if (!final) {
try {
const adonixUrl = `${global.APIs.adonix.url}/search/lyrics?apikey=${global.APIs.adonix.key}&q=${encodeURIComponent(text)}`
const res2 = await fetch(adonixUrl)
if (!res2.ok) throw new Error(`Adonix HTTP: ${res2.status}`)
const json2 = await res2.json()
final = normalize(json2)
} catch (e) {
final = null
}}
if (!final || !final.lyrics) {
await m.react('✖️')
return m.reply('ꕥ No se encontró la letra de la canción')
}
let { title, artists, lyrics, image, url } = final
title = title || 'Desconocido'
artists = artists || 'Desconocido'
lyrics = lyrics || ''
image = image || null
url = url || null
let caption = `❀ *Título:* ${title}\n○ *Artista:* ${artists}\n○ *Letra:*\n\n${lyrics}`
if (caption.length > 4000) caption = caption.slice(0, 3990) + '...'
if (url) caption += `\n\n↯ [Ver fuente](${url})`
if (image) {
await conn.sendMessage(m.chat, { image: { url: image }, caption, mentions: [m.sender] }, { quoted: m })
} else {
await conn.sendMessage(m.chat, { text: caption, mentions: [m.sender] }, { quoted: m })
}
await m.react('✔️')
} catch (error) {
await m.react('✖️')
return conn.reply(m.chat, `⚠︎ Se ha producido un problema\n> Usa *${usedPrefix}report* para informarlo\n\n${error.message}`, m)
}}

handler.command = ['lyrics']
handler.help = ['lyrics']
handler.tags = ['tools']

export default handler
