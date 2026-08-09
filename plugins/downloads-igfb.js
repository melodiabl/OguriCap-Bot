const handler = async (m, { args, conn, usedPrefix, command }) => {
try {
if (!args[0]) return conn.reply(m.chat, `❀ Por favor, ingresa un enlace de *Instagram* o *Facebook*.`, m)
let data = []
const url = encodeURIComponent(args[0])
await m.react('🕒')

 // MelodyApi first
  const melApi = global.APIs?.MelodyApi
  const mel = (typeof melApi?.url === 'string' ? melApi.url : '').trim().replace(/\/+$/, '')
  const melKey = (typeof melApi?.key === 'string' ? melApi.key : '').trim()
  const melHeaders = melKey ? { 'x-api-key': melKey } : {}
  if (mel) {
   try {
    if (/(instagram\.com)/i.test(args[0])) {
     const res = await fetch(`${mel}/download/instagram?url=${url}`, { headers: melHeaders })
     const json = await res.json().catch(() => null)
     const r = json?.result
     if (json?.status && r) {
      if (Array.isArray(r.downloadUrls) && r.downloadUrls.length) data = r.downloadUrls
      else if (typeof r.url === 'string' && r.url) data = [r.url]
     }
    }
   } catch { }

   if (/(facebook\.com|fb\.watch)/i.test(args[0]) && !data.length) {
    try {
     const res = await fetch(`${mel}/download/facebook?url=${url}`, { headers: melHeaders })
     const json = await res.json().catch(() => null)
     const r = json?.result
     if (json?.status && r) {
      const direct =
       r?.media?.video_hd ||
      r?.video_hd ||
      r?.hd ||
      r?.url ||
      (Array.isArray(r) ? (r[0]?.url || r[0]) : null)
     if (typeof direct === 'string' && direct) data = [direct]
    }
   } catch { }
  }
 }

if (/(instagram\.com)/i.test(args[0])) {
try {
const api = `${global.APIs.adonix.url}/download/instagram?apikey=${global.APIs.adonix.key}&url=${url}`
const res = await fetch(api)
const json = await res.json()
if (json.status && json.data?.length) {
data = json.data.map(v => v.url)
}} catch (e) {}
}
if (/(facebook\.com|fb\.watch)/i.test(args[0]) && !data.length) {
try {
const api = `${global.APIs.adonix.url}/download/facebook?apikey=${global.APIs.adonix.key}&url=${url}`
const res = await fetch(api)
const json = await res.json()
if (json.status && json.result?.media?.video_hd) {
data = [json.result.media.video_hd]
}} catch (e) {}
}
if (!data.length) {
try {
const api = `${global.APIs.vreden.url}/api/igdownload?url=${url}`
const res = await fetch(api)
const json = await res.json()
if (json.resultado?.respuesta?.datos?.length) {
data = json.resultado.respuesta.datos.map(v => v.url)
}} catch (e) {}
}
if (!data.length) {
try {
const api = `${global.APIs.delirius.url}/download/instagram?url=${url}`
const res = await fetch(api)
const json = await res.json()
if (json.status && json.data?.length) {
data = json.data.map(v => v.url)
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
