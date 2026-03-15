import axios from 'axios'
import fetch from 'node-fetch'

const handler = async (m, { conn, text, usedPrefix }) => {
if (!text) return m.reply("❀ Por favor, proporciona el nombre de una canción o artista.")
try {
await m.react('🕒')

 // MelodyApi first for Spotify URLs
  try {
   const mel = global.APIs.MelodyApi?.url
   const isSpotifyUrl = /^https?:\/\//i.test(text) && /spotify\.com\//i.test(text)
    if (mel && isSpotifyUrl) {
     const r = await axios.get(`${mel}/download/spotify?url=${encodeURIComponent(text)}`, { timeout: 20000 })
     if (r.data?.status && r.data?.result) {
      const dl = r.data.result
      try {
       await conn.sendMessage(m.chat, { audio: { url: dl }, fileName: `spotify.mp3`, mimetype: 'audio/mpeg' }, { quoted: m })
       await m.react('✔️')
       return
      } catch (e) {
       // If the host blocks us, continue to other APIs.
      }
     }
    }
   } catch {}

  // MelodyApi first for search queries (fallback to YouTube audio)
  try {
   const mel = global.APIs.MelodyApi?.url
   const isSpotifyUrl = /^https?:\/\//i.test(text) && /spotify\.com\//i.test(text)
    if (mel && !isSpotifyUrl) {
    const r = await axios.get(`${mel}/download/playspotify?q=${encodeURIComponent(text)}`, { timeout: 25000 })
    const out = r.data?.result
    const direct = out?.url
    if (r.data?.status && typeof direct === 'string' && direct) {
     try {
      await conn.sendMessage(m.chat, { audio: { url: direct }, fileName: `play.mp3`, mimetype: 'audio/mpeg' }, { quoted: m })
      await m.react('✔️')
      return
     } catch (e) {
      // fall back to other APIs
     }
    }
    }
   } catch {}

const res = await axios.get(`${global.APIs.adonix.url}/download/spotify?apikey=${global.APIs.adonix.key}&q=${encodeURIComponent(text)}`)
if (!res.data?.status || !res.data?.song || !res.data?.downloadUrl) throw new Error("No se encontró la canción en Adonix.")
const s = res.data.song
const data = { title: s.title || "Desconocido", artist: s.artist || "Desconocido", duration: s.duration || "Desconocido", image: s.thumbnail || null, download: res.data.downloadUrl, url: s.spotifyUrl || text }
const caption = `「✦」Descargando *<${data.title}>*\n\nꕥ Autor » *${data.artist}*\nⴵ Duración » *${data.duration}*\n🜸 Enlace » ${data.url}`
const bannerBuffer = data.image ? await (await fetch(data.image)).buffer() : null
await conn.sendMessage(m.chat, {
text: caption,
contextInfo: {
externalAdReply: {
title: '✧ s⍴᥆𝗍і𝖿ᥡ • mᥙsіᥴ ✧',
body: dev,
mediaType: 1,
mediaUrl: data.url,
sourceUrl: data.url,
thumbnail: bannerBuffer,
showAdAttribution: false,
containsAutoReply: true,
renderLargerThumbnail: true
}}}, { quoted: m })
await conn.sendMessage(m.chat, { audio: { url: data.download }, fileName: `${data.title}.mp3`, mimetype: 'audio/mpeg' }, { quoted: m })
await m.react('✔️')
} catch (err) {
await m.react('✖️')
m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${err.message}`)
}}

handler.help = ["spotify"]
handler.tags = ["download"]
handler.command = ["spotify", "splay"]

export default handler
