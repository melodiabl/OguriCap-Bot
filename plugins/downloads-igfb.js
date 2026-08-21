import axios from 'axios'

const handler = async (m, { args, conn, usedPrefix, command }) => {
try {
if (!args[0]) return conn.reply(m.chat, `❀ Por favor, ingresa un enlace de *Instagram* o *Facebook*.`, m)
let data = []
const url = encodeURIComponent(args[0])
await m.react('🕒')

try {
const endpoint = /(instagram\.com)/i.test(args[0]) ? '/download/aio' : '/download/facebook'
const mel = global.APIs.MelodyApi
const response = await axios.get(`${mel.url}${endpoint}`, { params: { url: args[0] }, headers: mel.key ? { 'x-api-key': mel.key } : {}, timeout: 30_000 })
const result = response.data?.result
const candidates = [result?.video, result?.url, result?.media?.video_hd, result?.video_hd, result?.hd]
if (Array.isArray(result?.downloadUrls)) candidates.push(...result.downloadUrls)
if (response.data?.status) data = candidates.filter(value => typeof value === 'string' && value.startsWith('http'))
} catch {}

// adonix y vreden (muertos) eliminados; Delirius es el respaldo activo.
if (!data.length && /(instagram\.com)/i.test(args[0])) {
try {
const api = `${global.APIs.delirius.url}/download/instagram?url=${url}`
const res = await fetch(api)
const json = await res.json()
if (json.status && json.data?.length) {
data = json.data.map(v => v.url)
}} catch (e) {}
}
if (!data.length && /(facebook\.com|fb\.watch)/i.test(args[0])) {
try {
const api = `${global.APIs.delirius.url}/download/facebook?url=${url}`
const res = await fetch(api)
const json = await res.json()
const r = json?.data || json?.result
const direct = r?.video_hd || r?.hd || r?.video_sd || r?.sd || (Array.isArray(r) ? (r[0]?.url || r[0]) : r?.url)
if (json?.status && typeof direct === 'string' && direct) {
data = [direct]
}} catch (e) {}
}
if (!data.length) return conn.reply(m.chat, `ꕥ No se pudo obtener el contenido.`, m)
for (let media of data) {
await conn.sendFile(m.chat, media, 'media.mp4', `❀ Aquí tienes ฅ^•ﻌ•^ฅ.`, m)
await m.react('✔️')
}} catch (error) {
await m.react('✖️')
await m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`)
}}

handler.command = ['instagram', 'ig', 'facebook', 'fb']
handler.tags = ['descargas']
handler.help = ['instagram', 'ig', 'facebook', 'fb']
handler.group = true

export default handler
