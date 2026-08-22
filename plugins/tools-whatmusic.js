import acrcloud from "acrcloud"
import fetch from 'node-fetch'
import { FormData, Blob } from 'formdata-node'

let handler = async (m, { conn, text, usedPrefix, command }) => {
let q = m.quoted ? m.quoted : m
if (!q.mimetype || (!q.mimetype.includes("audio") && !q.mimetype.includes("video"))) {
return m.reply("❀ Por favor, responde al audio del cual deseas buscar el título.")
}
let buffer = await q.download()
try {
await m.react('🕒')
let data = await whatmusic(buffer)
if (!data.length) {
await m.react('✖️')
return m.reply("✧ No se encontraron datos de la canción")
}
let cap = "*乂 ¡SHAZAM - MUSIC! 乂*\n\n"
for (let result of data) {
const enlaces = Array.isArray(result.url) ? result.url.filter(x => x) : []
cap += `✐ Título » ${result.title}\n`
cap += `✦ Artista » ${result.artist}\n`
cap += `ⴵ Duración » ${result.duration}\n`
cap += `🜸 Enlaces » ${enlaces.map(i => `\n${i}`).join("\n")}\n`
if (enlaces.length) cap += "••••••••••••••••••••••••••••••••••••••\n"
}
await conn.relayMessage(m.chat, {
extendedTextMessage: {
text: cap,
contextInfo: {
externalAdReply: {
title: '✧ Whats • Music ✧',
body: dev,
mediaType: 1,
previewType: 0,
renderLargerThumbnail: true,
thumbnail: await (await fetch('https://raw.githubusercontent.com/The-King-Destroy/Adiciones/main/Contenido/1742781294508.jpeg')).arrayBuffer().then(b => Buffer.from(b)),
sourceUrl: redes
}}}}, { quoted: m })
await m.react('✔️')
} catch (error) {
await m.react('✖️')
m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n` + error.message)
}}

handler.help = ["whatmusic"]
handler.tags = ["tools"]
handler.command = ["whatmusic", "shazam"]
handler.group = true

export default handler

async function whatmusic(buffer) {
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const form = new FormData()
form.append('file', new Blob([buffer]), 'audio.bin')
const response = await fetch(`${api.url}/tools/whatmusic?apikey=${encodeURIComponent(api.key)}`, { method: 'POST', body: form })
const json = await response.json()
if (!response.ok || !json.status || !Array.isArray(json.result)) throw new Error(json.error || 'No se pudo reconocer')
return json.result.map(item => ({ title: item.title, artist: item.artist, duration: toTime(item.durationMs), url: item.links || [] }))
} catch {}
const host = process.env.ACRCLOUD_HOST
const access_key = process.env.ACRCLOUD_ACCESS_KEY
const access_secret = process.env.ACRCLOUD_ACCESS_SECRET
if (!host || !access_key || !access_secret) return []
const acr = new acrcloud({ host, access_key, access_secret })
let res = await acr.identify(buffer)
let data = res?.metadata
if (!data || !Array.isArray(data.music)) return []
return data.music.map(a => ({ title: a.title, artist: a.artists?.[0]?.name || "Desconocido", duration: toTime(a.duration_ms), url: Object.keys(a.external_metadata || {}).map(i => i === "youtube" ? "https://youtu.be/" + a.external_metadata[i].vid : i === "deezer" ? "https://www.deezer.com/us/track/" + a.external_metadata[i].track.id : i === "spotify" ? "https://open.spotify.com/track/" + a.external_metadata[i].track.id : "").filter(Boolean) }))
}
function toTime(ms) {
if (!ms || typeof ms !== "number") return "00:00"
let m = Math.floor(ms / 60000)
let s = Math.floor((ms % 60000) / 1000)
return [m, s].map(v => v.toString().padStart(2, "0")).join(":")
}
