import axios from 'axios'
import fetch from 'node-fetch'

const handler = async (m, { conn, text, usedPrefix }) => {
if (!text) return m.reply("❀ Por favor, proporciona el nombre de una canción o artista.")
try {
await m.react('🕒')

 // MelodyApi first for Spotify URLs
  try {
    const melApi = global.APIs.MelodyApi
    const mel = (typeof melApi?.url === 'string' ? melApi.url : '').trim().replace(/\/+$/, '')
    const melKey = (typeof melApi?.key === 'string' ? melApi.key : '').trim()
    const melHeaders = melKey ? { 'x-api-key': melKey } : {}
    const isSpotifyUrl = /^https?:\/\//i.test(text) && /spotify\.com\//i.test(text)
     if (mel && isSpotifyUrl) {
      const r = await axios.get(`${mel}/download/spotify?url=${encodeURIComponent(text)}`, { timeout: 20000, headers: melHeaders })
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
    const melApi = global.APIs.MelodyApi
    const mel = (typeof melApi?.url === 'string' ? melApi.url : '').trim().replace(/\/+$/, '')
    const melKey = (typeof melApi?.key === 'string' ? melApi.key : '').trim()
    const melHeaders = melKey ? { 'x-api-key': melKey } : {}
    const isSpotifyUrl = /^https?:\/\//i.test(text) && /spotify\.com\//i.test(text)
     if (mel && !isSpotifyUrl) {
     const r = await axios.get(`${mel}/download/playspotify?q=${encodeURIComponent(text)}`, { timeout: 25000, headers: melHeaders })
     const out = r.data?.result
     const direct = out?.url
     if (r.data?.status && typeof direct === 'string' && direct) {
     try {
      if (out?.title) {
       const bannerBuffer = out?.thumbnail ? await (await fetch(out.thumbnail)).arrayBuffer().then(b => Buffer.from(b)).catch(() => null) : null
       await conn.sendMessage(m.chat, {
        text: `「✦」Descargando *<${out.title}>*`,
        contextInfo: { externalAdReply: { title: '✧ s⍴᥆𝗍і𝖿ᥡ • mᥙsіᥴ ✧', body: dev, mediaType: 1, thumbnail: bannerBuffer, renderLargerThumbnail: true } }
       }, { quoted: m }).catch(() => {})
      }
      await conn.sendMessage(m.chat, { audio: { url: direct }, fileName: `${out?.title || 'play'}.mp3`, mimetype: 'audio/mpeg' }, { quoted: m })
      await m.react('✔️')
      return
     } catch (e) {
      // fall back to other APIs
     }
    }
    }
   } catch {}

// Respaldo: Delirius (adonix murió). Buscar el track y descargarlo.
const isUrl = /^https?:\/\//i.test(text) && /spotify\.com\//i.test(text)
let trackUrl = text
let s = {}
if (!isUrl) {
const search = await axios.get(`${global.APIs.delirius.url}/search/spotify?q=${encodeURIComponent(text)}&limit=1`)
const first = search.data?.data?.[0]
if (!first?.url) throw new Error("No se encontró la canción.")
trackUrl = first.url
s = first
}
const res = await axios.get(`${global.APIs.delirius.url}/download/spotifydl?url=${encodeURIComponent(trackUrl)}`)
const d = res.data?.data
if (!res.data?.status || !d?.download) throw new Error("No se pudo descargar la canción.")
const data = { title: d.title || s.title || "Desconocido", artist: d.author || s.artist || "Desconocido", duration: s.duration || "Desconocido", image: d.image || null, download: d.download, url: trackUrl }
const caption = `「✦」Descargando *<${data.title}>*\n\nꕥ Autor » *${data.artist}*\nⴵ Duración » *${data.duration}*\n🜸 Enlace » ${data.url}`
const bannerBuffer = data.image ? await (await fetch(data.image)).arrayBuffer().then(b => Buffer.from(b)) : null
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
