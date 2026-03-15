import fetch from "node-fetch"
import yts from 'yt-search'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'

async function sniffContentType(url) {
 try {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  // Use a range request to avoid downloading full media.
  const res = await fetch(url, { signal: controller.signal, headers: { Range: 'bytes=0-0' } })
  clearTimeout(timeout)
  if (!res || !res.ok) return null
  // Drain 1 byte to complete request in some servers.
  try { await res.arrayBuffer() } catch { }
  const ct = res.headers && (res.headers.get('content-type') || res.headers.get('Content-Type'))
  const cr = res.headers && (res.headers.get('content-range') || res.headers.get('Content-Range'))
  let totalBytes = null
  if (cr && /\/\d+\s*$/.test(cr)) {
   const m = String(cr).match(/\/(\d+)\s*$/)
   if (m) totalBytes = Number(m[1])
  }
  const cl = res.headers && (res.headers.get('content-length') || res.headers.get('Content-Length'))
  if (!totalBytes && cl) {
   const n = Number(cl)
   if (Number.isFinite(n) && n > 0) totalBytes = n
  }
  return {
   contentType: ct ? String(ct).toLowerCase() : null,
   totalBytes: Number.isFinite(totalBytes) ? totalBytes : null
  }
 } catch {
  return { contentType: null, totalBytes: null }
 }
}

async function downloadToFile(url, filePath, timeoutMs = 60000) {
 const controller = new AbortController()
 const timeout = setTimeout(() => controller.abort(), timeoutMs)
 const res = await fetch(url, { signal: controller.signal })
 if (!res.ok) {
  clearTimeout(timeout)
  throw new Error(`HTTP ${res.status}`)
 }
 const buf = Buffer.from(await res.arrayBuffer())
 clearTimeout(timeout)
 await fs.promises.writeFile(filePath, buf)
 return buf.length
}

async function ffmpegToMp3(inputPath, outputPath, timeoutMs = 120000) {
 return await new Promise((resolve, reject) => {
  const args = ['-y', '-i', inputPath, '-vn', '-acodec', 'libmp3lame', '-b:a', '128k', outputPath]
  const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
  let stderr = ''
  const t = setTimeout(() => {
   try { p.kill('SIGKILL') } catch { }
   reject(new Error('ffmpeg timeout'))
  }, timeoutMs)
  p.stderr.on('data', (d) => { stderr += d.toString() })
  p.on('error', (e) => {
   clearTimeout(t)
   reject(e)
  })
  p.on('close', (code) => {
   clearTimeout(t)
   if (code === 0) return resolve(true)
   reject(new Error(stderr || `ffmpeg failed with code ${code}`))
  })
 })
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
try {
if (!text.trim()) return conn.reply(m.chat, `❀ Por favor, ingresa el nombre de la música a descargar.`, m)
await m.react('🕒')
const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
const query = videoMatch ? 'https://youtu.be/' + videoMatch[1] : text
const search = await yts(query)
const result = videoMatch ? search.videos.find(v => v.videoId === videoMatch[1]) || search.all[0] : search.all[0]
if (!result) throw 'ꕥ No se encontraron resultados.'
const { title, thumbnail, timestamp, views, ago, url, author, seconds } = result
if (seconds > 1800) throw '⚠ El contenido supera el límite de duración (10 minutos).'
const vistas = formatViews(views)
const info = `「✦」Descargando *<${title}>*\n\n> ❑ Canal » *${author.name}*\n> ♡ Vistas » *${vistas}*\n> ✧︎ Duración » *${timestamp}*\n> ☁︎ Publicado » *${ago}*\n> ➪ Link » ${url}`
const thumb = (await conn.getFile(thumbnail)).data
await conn.sendMessage(m.chat, { image: thumb, caption: info }, { quoted: m })
 if (['play', 'yta', 'ytmp3', 'playaudio'].includes(command)) {
  let candidate = await getAud(url, 0)
  if (!candidate?.url) throw '⚠ No se pudo obtener el audio.'
  while (candidate) {
   let mimetype = 'audio/mpeg'
   let ext = 'mp3'

   // Prefer real Content-Type over URL heuristics.
   const sniff = typeof candidate.url === 'string' ? await sniffContentType(candidate.url) : { contentType: null, totalBytes: null }
   const ct = sniff && sniff.contentType ? sniff.contentType : null
   if (ct && ct.includes('audio/mp4')) {
    mimetype = 'audio/mp4'
    ext = 'm4a'
   } else if (ct && ct.includes('audio/mpeg')) {
    mimetype = 'audio/mpeg'
    ext = 'mp3'
   } else {
    // Fallback heuristic
    const isM4a = typeof candidate.url === 'string' && (/mime=audio%2Fmp4/i.test(candidate.url) || /mime=audio\/mp4/i.test(candidate.url) || /\.m4a(\?|$)/i.test(candidate.url))
    mimetype = isM4a ? 'audio/mp4' : 'audio/mpeg'
    ext = isM4a ? 'm4a' : 'mp3'
   }

   const fileName = `${title}.${ext}`
   m.reply(`> ❀ *Audio procesado. Servidor:* \`${candidate.api}\``)
   try {
    // If audio/mp4 is frequently not playable, convert to mp3 before sending.
    if (mimetype === 'audio/mp4' && typeof candidate.url === 'string') {
     const maxBytesForConvert = 60 * 1024 * 1024
     const total = sniff && sniff.totalBytes ? sniff.totalBytes : null
     if (!total || total <= maxBytesForConvert) {
      const tmpDir = path.join(os.tmpdir(), 'oguricap')
      await fs.promises.mkdir(tmpDir, { recursive: true })
      const inPath = path.join(tmpDir, `in_${Date.now()}_${Math.random().toString(16).slice(2)}.m4a`)
      const outPath = path.join(tmpDir, `out_${Date.now()}_${Math.random().toString(16).slice(2)}.mp3`)
      try {
       await downloadToFile(candidate.url, inPath, 90000)
       await ffmpegToMp3(inPath, outPath, 180000)
       const mp3 = await fs.promises.readFile(outPath)
       await conn.sendMessage(m.chat, { audio: mp3, fileName: `${title}.mp3`, mimetype: 'audio/mpeg' }, { quoted: m })
      } finally {
       try { await fs.promises.unlink(inPath) } catch { }
       try { await fs.promises.unlink(outPath) } catch { }
      }
     } else {
      await conn.sendMessage(m.chat, { audio: { url: candidate.url }, fileName, mimetype }, { quoted: m })
     }
    } else {
     await conn.sendMessage(m.chat, { audio: { url: candidate.url }, fileName, mimetype }, { quoted: m })
    }
     await m.react('✔️')
     break
    } catch (err) {
    const msg = (err && err.message) ? err.message : String(err)
    // If the media host rejects our server (403/401), try next API.
    if (/\b403\b|\b401\b/i.test(msg)) {
     candidate = await getAud(url, (candidate.index || 0) + 1)
     if (!candidate) throw err
     continue
    }
    throw err
   }
  }
 } else if (['play2', 'ytv', 'ytmp4', 'mp4'].includes(command)) {
  let candidate = await getVid(url, 0)
  if (!candidate?.url) throw '⚠ No se pudo obtener el video.'
  while (candidate) {
   m.reply(`> ❀ *Vídeo procesado. Servidor:* \`${candidate.api}\``)
   try {
    await conn.sendFile(m.chat, candidate.url, `${title}.mp4`, `> ❀ ${title}`, m)
    await m.react('✔️')
    break
   } catch (err) {
    const msg = (err && err.message) ? err.message : String(err)
    if (/\b403\b|\b401\b/i.test(msg)) {
     candidate = await getVid(url, (candidate.index || 0) + 1)
     if (!candidate) throw err
     continue
    }
    throw err
   }
  }
 }} catch (e) {
await m.react('✖️')
return conn.reply(m.chat, typeof e === 'string' ? e : '⚠︎ Se ha producido un problema.\n> Usa *' + usedPrefix + 'report* para informarlo.\n\n' + e.message, m)
}}

handler.command = handler.help = ['play', 'yta', 'ytmp3', 'play2', 'ytv', 'ytmp4', 'playaudio', 'mp4']
handler.tags = ['descargas']
handler.group = true

export default handler

async function getAud(url, startIndex = 0) {
 const apis = []
 const mel = global.APIs?.MelodyApi?.url
 if (mel) {
  apis.push(
   { api: 'MelodyApi', endpoint: `${mel}/download/ytmp3?url=${encodeURIComponent(url)}`, extractor: res => res.result?.url || res.result },
   { api: 'MelodyApi', endpoint: `${mel}/download/ytdl-v2?url=${encodeURIComponent(url)}`, extractor: res => res.result?.download?.mp3 || res.result?.mp3 },
   { api: 'MelodyApi', endpoint: `${mel}/download/ytdl?url=${encodeURIComponent(url)}`, extractor: res => res.result?.mp3 },
  )
 }
 apis.push(
  { api: 'Adonix', endpoint: `${global.APIs.adonix.url}/download/ytaudio?apikey=${global.APIs.adonix.key}&url=${encodeURIComponent(url)}`, extractor: res => res.data?.url },
  { api: 'ZenzzXD', endpoint: `${global.APIs.zenzxz.url}/downloader/ytmp3?url=${encodeURIComponent(url)}`, extractor: res => res.data?.download_url },
  { api: 'ZenzzXD v2', endpoint: `${global.APIs.zenzxz.url}/downloader/ytmp3v2?url=${encodeURIComponent(url)}`, extractor: res => res.data?.download_url },
  { api: 'Yupra', endpoint: `${global.APIs.yupra.url}/api/downloader/ytmp3?url=${encodeURIComponent(url)}`, extractor: res => res.result?.link },
  { api: 'Vreden', endpoint: `${global.APIs.vreden.url}/api/v1/download/youtube/audio?url=${encodeURIComponent(url)}&quality=128`, extractor: res => res.result?.download?.url },
  { api: 'Vreden v2', endpoint: `${global.APIs.vreden.url}/api/v1/download/play/audio?query=${encodeURIComponent(url)}`, extractor: res => res.result?.download?.url },
  { api: 'Xyro', endpoint: `${global.APIs.xyro.url}/download/youtubemp3?url=${encodeURIComponent(url)}`, extractor: res => res.result?.download }
 )
 return await fetchFromApis(apis, startIndex)
}
async function getVid(url, startIndex = 0) {
 const apis = []
 const mel = global.APIs?.MelodyApi?.url
 if (mel) {
  apis.push(
   { api: 'MelodyApi', endpoint: `${mel}/download/ytmp4?url=${encodeURIComponent(url)}&quality=360`, extractor: res => res.result?.url || res.result },
   { api: 'MelodyApi', endpoint: `${mel}/download/ytdl-v2?url=${encodeURIComponent(url)}`, extractor: res => res.result?.download?.mp4 || res.result?.mp4 },
   { api: 'MelodyApi', endpoint: `${mel}/download/ytdl?url=${encodeURIComponent(url)}`, extractor: res => res.result?.mp4 },
  )
 }
 apis.push(
  { api: 'Adonix', endpoint: `${global.APIs.adonix.url}/download/ytvideo?apikey=${global.APIs.adonix.key}&url=${encodeURIComponent(url)}`, extractor: res => res.data?.url },
  { api: 'ZenzzXD', endpoint: `${global.APIs.zenzxz.url}/downloader/ytmp4?url=${encodeURIComponent(url)}&resolution=360p`, extractor: res => res.data?.download_url },
  { api: 'ZenzzXD v2', endpoint: `${global.APIs.zenzxz.url}/downloader/ytmp4v2?url=${encodeURIComponent(url)}&resolution=360`, extractor: res => res.data?.download_url },
  { api: 'Yupra', endpoint: `${global.APIs.yupra.url}/api/downloader/ytmp4?url=${encodeURIComponent(url)}`, extractor: res => res.result?.formats?.[0]?.url },
  { api: 'Vreden', endpoint: `${global.APIs.vreden.url}/api/v1/download/youtube/video?url=${encodeURIComponent(url)}&quality=360`, extractor: res => res.result?.download?.url },
  { api: 'Vreden v2', endpoint: `${global.APIs.vreden.url}/api/v1/download/play/video?query=${encodeURIComponent(url)}`, extractor: res => res.result?.download?.url },
  { api: 'Xyro', endpoint: `${global.APIs.xyro.url}/download/youtubemp4?url=${encodeURIComponent(url)}&quality=360`, extractor: res => res.result?.download }
 )
 return await fetchFromApis(apis, startIndex)
}
async function fetchFromApis(apis, startIndex = 0) {
for (let i = startIndex; i < apis.length; i++) {
 const { api, endpoint, extractor } = apis[i]
 try {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  const res = await fetch(endpoint, { signal: controller.signal }).then(r => r.json())
  clearTimeout(timeout)
  const link = extractor(res)
  if (link) return { url: link, api, index: i }
 } catch (e) {}
 await new Promise(resolve => setTimeout(resolve, 500))
}
return null
}
function formatViews(views) {
if (views === undefined) return "No disponible"
if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B (${views.toLocaleString()})`
if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M (${views.toLocaleString()})`
if (views >= 1_000) return `${(views / 1_000).toFixed(1)}k (${views.toLocaleString()})`
return views.toString()
}
