import fetch from 'node-fetch'

var handler = async (m, { conn, usedPrefix, command, text }) => {
if (!text) return conn.reply(m.chat, `❀ Por favor, ingrese el nombre de algún anime.`, m)
try {
await m.react('🕒')
let item
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const res = await fetch(`${api.url}/anime/manga?q=${encodeURIComponent(text)}&apikey=${encodeURIComponent(api.key)}`)
const json = await res.json()
if (!res.ok || !json.status || !json.result?.[0]) throw new Error(json.error || 'Sin resultados')
item = json.result[0]
} catch {
const res = await fetch(`https://api.jikan.moe/v4/manga?q=${encodeURIComponent(text)}`)
if (!res.ok) throw new Error('No se pudo buscar el manga')
const raw = (await res.json()).data?.[0]
item = { chapters: raw.chapters, titleJapanese: raw.title_japanese, url: raw.url, type: raw.type, score: raw.score, members: raw.members, background: raw.background, status: raw.status, volumes: raw.volumes, synopsis: raw.synopsis, favorites: raw.favorites, authors: raw.authors?.map(a => a.name), image: raw.images?.jpg?.image_url }
}
let { chapters, url, type, score, members, background, status, volumes, synopsis, favorites } = item
let title_japanese = item.titleJapanese || item.title
let author = item.authors?.join(', ') || 'Desconocido'
let animeingfo = `❀ Título: ${title_japanese}
» Capítulo: ${chapters}
» Transmisión: ${type}
» Estado: ${status}
» Volumes: ${volumes}
» Favorito: ${favorites}
» Puntaje: ${score}
» Miembros: ${members}
» Autor: ${author}
» Fondo: ${background}
» Sinopsis: ${synopsis}
» Url: ${url}` 
await conn.sendFile(m.chat, item.image, 'anime.jpg', '✧ *I N F O - A N I M E* ✧\n\n' + animeingfo, fkontak)
await m.react('✔️')
} catch (error) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
}}

handler.help = ['infoanime'] 
handler.tags = ['anime']
handler.command = ['infoanime']
handler.group = true

export default handler
