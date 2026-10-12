import fetch from "node-fetch"
import yts from 'yt-search'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { isIP } from 'node:net'
import http from 'node:http'
import https from 'node:https'
import { spawn, execFile } from 'child_process'
import { pipeline } from 'stream'
import { promisify } from 'util'
import { createAudioCache } from '../lib/play-audio-cache.js'

const streamPipeline = promisify(pipeline)
const runMediaTool = promisify(execFile)
const mediaHttpAgent = new http.Agent({ family: 4 })
const mediaHttpsAgent = new https.Agent({ family: 4 })
const mediaAgent = url => url.protocol === 'https:' ? mediaHttpsAgent : mediaHttpAgent
const audioCache = createAudioCache({ root: process.env.OGURI_AUDIO_CACHE_PATH || path.join(process.cwd(), 'storage/audio-cache'), ttlMs: 24 * 60 * 60 * 1000 })

function getMelodyApi() {
 const mel = global.APIs?.MelodyApi
 const url = (typeof mel?.url === 'string' ? mel.url : '').trim().replace(/\/+$/, '')
 const key = (typeof mel?.key === 'string' ? mel.key : '').trim()
 if (!url) return null
 return {
  url,
  key: key || null,
  headers: key ? { 'x-api-key': key } : {}
 }
}

function getProgressConfig() {
 const cfg = global.downloadProgress || {}
 const toNum = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
 }
 return {
  enabled: cfg.enabled !== false,
  style: (cfg.style || 'classic').toString(),
  width: Math.max(8, Math.min(40, toNum(cfg.width) || 16)),
  updateMs: Math.max(400, Math.min(5000, toNum(cfg.updateMs) || 1200)),
  minBytes: Math.max(32 * 1024, toNum(cfg.minBytes) || (256 * 1024)),
  maxRawBytes: Math.max(5 * 1024 * 1024, toNum(cfg.maxRawBytes) || (120 * 1024 * 1024)),
  showSpeed: cfg.showSpeed !== false,
  showEta: cfg.showEta !== false
 }
}

function formatBytes(bytes) {
 const n = Number(bytes)
 if (!Number.isFinite(n) || n <= 0) return '0B'
 const units = ['B', 'KB', 'MB', 'GB', 'TB']
 const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
 const v = n / Math.pow(1024, i)
 return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)}${units[i]}`
}

function formatEta(seconds) {
 const s = Math.max(0, Math.floor(Number(seconds) || 0))
 const m = Math.floor(s / 60)
 const r = s % 60
 return `${m}:${String(r).padStart(2, '0')}`
}

export function estimateAudioBytes(durationSeconds, bitrateKbps = 128) {
 const duration = Number(durationSeconds)
 const bitrate = Number(bitrateKbps)
 if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(bitrate) || bitrate <= 0) return null
 return Math.ceil(duration * bitrate * 1000 / 8)
}

export function selectProgressTotal(contentLength, apiEstimatedBytes, localEstimatedBytes) {
 const exact = Number(contentLength)
 if (Number.isFinite(exact) && exact > 0) return exact
 const apiEstimate = Number(apiEstimatedBytes)
 if (Number.isFinite(apiEstimate) && apiEstimate > 0) return apiEstimate
 const localEstimate = Number(localEstimatedBytes)
 return Number.isFinite(localEstimate) && localEstimate > 0 ? localEstimate : null
}

export function isYoutubeShortUrl(value) {
 try {
  const parsed = new URL(String(value || '').trim())
  return /(^|\.)youtube\.com$/i.test(parsed.hostname) && /^\/shorts\//i.test(parsed.pathname)
 } catch {
  return false
 }
}

function musicResultScore(result) {
 const title = String(result?.title || '').toLowerCase()
 const author = String(result?.author?.name || '').toLowerCase()
 const signals = [
  'official video', 'official audio', 'music video', 'video oficial', 'audio oficial',
  'lyrics', 'lyric video', 'letra', 'audio', 'song', 'music', 'remix', 'cover',
  'karaoke', 'visualizer', 'video musical'
 ]
 let score = signals.reduce((total, signal) => total + (title.includes(signal) ? 1 : 0), 0)
 if (author.endsWith(' - topic') || author.includes('vevo')) score += 2
 return score
}

export function selectMusicVideo(results, requestedVideoId = null) {
 const videos = (Array.isArray(results) ? results : []).filter((result) => {
  if (!result || (result.type && result.type !== 'video')) return false
  if (!/^[A-Za-z0-9_-]{11}$/.test(String(result.videoId || ''))) return false
  if (isYoutubeShortUrl(result.url)) return false
  if (requestedVideoId && result.videoId !== requestedVideoId) return false
  return musicResultScore(result) > 0
 })
 return videos.sort((a, b) => musicResultScore(b) - musicResultScore(a))[0] || null
}

export function normalizeMelodiaYouTubeResults(results) {
 return (Array.isArray(results) ? results : []).map((video) => {
  const url = String(video?.link || video?.url || '')
  const match = url.match(/[?&]v=([A-Za-z0-9_-]{11})/) || url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/)
  const videoId = String(video?.videoId || match?.[1] || '')
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
  return {
   type: 'video', videoId, url: `https://www.youtube.com/watch?v=${videoId}`,
   title: String(video?.title || ''), thumbnail: String(video?.imageUrl || video?.thumbnail || ''),
   timestamp: String(video?.duration || video?.timestamp || ''), seconds: Number(video?.seconds || 0) || 0,
   views: Number(video?.views || 0) || 0, ago: String(video?.ago || ''),
   author: { name: String(video?.channel || video?.author?.name || '') }
  }
 }).filter(Boolean)
}

async function searchVideos(query) {
 try {
  const search = await yts(query)
  const videos = Array.isArray(search?.videos) ? search.videos : []
  if (videos.length) return videos
 } catch {}

 const mel = getMelodyApi()
 if (mel) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 16000)
  try {
   const endpoint = `${mel.url}/search/youtube?q=${encodeURIComponent(query)}`
   const response = await fetch(endpoint, { headers: mel.headers, signal: controller.signal })
   const body = await response.json().catch(() => ({}))
   const videos = normalizeMelodiaYouTubeResults(body?.result)
   if (response.ok && videos.length) return videos
  } catch {} finally {
   clearTimeout(timeout)
  }
 }
 return []
}

function renderProgressBar(pct, style = 'classic', width = 16) {
 const p = Math.max(0, Math.min(100, Number(pct) || 0))
 const w = Math.max(8, Math.min(40, Number(width) || 16))
 const filled = Math.round((p / 100) * w)
 const empty = w - filled
 const s = String(style || 'classic').toLowerCase()
 if (s === 'blocks') return `${'█'.repeat(filled)}${'░'.repeat(empty)}`
 if (s === 'dots') return `${'#'.repeat(filled)}${'.'.repeat(empty)}`
 if (s === 'mini') {
  const miniW = 10
  const miniFilled = Math.round((p / 100) * miniW)
  return `${'■'.repeat(miniFilled)}${'□'.repeat(miniW - miniFilled)}`
 }
 return `[${'='.repeat(filled)}${'.'.repeat(empty)}]`
}

export async function downloadStreamToFile(url, filePath, opts = {}) {
 const headers = opts.headers || {}
 const timeoutMs = Number.isFinite(Number(opts.timeoutMs)) ? Number(opts.timeoutMs) : 300000
 const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null
 const maxBytes = Number.isFinite(Number(opts.maxBytes)) ? Number(opts.maxBytes) : null

 const controller = new AbortController()
 const timeout = setTimeout(() => controller.abort(), timeoutMs)
 let res
 const headerTimeoutMs = Number(opts.headerTimeoutMs) > 0 ? Number(opts.headerTimeoutMs) : timeoutMs
 const headerTimeout = setTimeout(() => controller.abort(), headerTimeoutMs)
 try {
  res = await fetch(url, { headers, signal: controller.signal })
 } catch (e) {
  clearTimeout(timeout)
  throw e
 } finally {
  clearTimeout(headerTimeout)
 }

 if (!res?.ok) {
  clearTimeout(timeout)
  res?.body?.destroy()
  throw new Error(`HTTP ${res?.status || 'ERR'}`)
 }
 if (!res.body) {
  clearTimeout(timeout)
  throw new Error('No response body')
 }

 const ct = (res.headers.get('content-type') || '').toString()
 const clRaw = res.headers.get('content-length')
 const apiEstimatedBytes = res.headers.get('x-estimated-content-length')
 const totalBytes = selectProgressTotal(clRaw, apiEstimatedBytes, opts.expectedTotalBytes)

 if (maxBytes && totalBytes && totalBytes > maxBytes) {
  clearTimeout(timeout)
  try { controller.abort() } catch { }
  throw new Error(`File too large: ${formatBytes(totalBytes)}`)
 }

 await fs.promises.mkdir(path.dirname(filePath), { recursive: true })

 let receivedBytes = 0
 const startMs = Date.now()
 let lastEmitMs = 0
 let lastEmitBytes = 0

	const emit = (done = false) => {
		if (!onProgress) return
		const now = Date.now()
		if (!done) {
			const since = now - lastEmitMs
			const delta = receivedBytes - lastEmitBytes
			const minMs = opts.updateMs || 1000
			const minBytes = opts.minBytes || (256 * 1024)
			// Never emit more often than minMs.
			if (lastEmitMs && since < minMs) return
			// If upstream doesn't send Content-Length, avoid spamming tiny updates.
			if (lastEmitMs && !totalBytes && delta < minBytes) return
		}
		lastEmitMs = now
		lastEmitBytes = receivedBytes
  const elapsedSec = Math.max(0.001, (now - startMs) / 1000)
  const speedBps = receivedBytes / elapsedSec
  const etaSec = totalBytes ? Math.max(0, (totalBytes - receivedBytes) / Math.max(1, speedBps)) : null
  Promise.resolve(onProgress({ receivedBytes, totalBytes, speedBps, etaSec, startMs, done })).catch(() => {})
  }

 res.body.on('data', (chunk) => {
  receivedBytes += chunk.length
  if (maxBytes && receivedBytes > maxBytes) {
   const err = new Error(`File too large: >${formatBytes(maxBytes)}`)
   try { controller.abort() } catch { }
   try { res.body.destroy(err) } catch { }
   return
  }
  emit(false)
 })

 try {
  await streamPipeline(res.body, fs.createWriteStream(filePath))
 } finally {
  clearTimeout(timeout)
 }

 emit(true)
 return { contentType: ct || null, totalBytes, receivedBytes }
}

async function sniffContentType(url) {
 try {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  // Use a range request to avoid downloading full media.
  const res = await fetch(url, { signal: controller.signal, agent: mediaAgent, headers: { Range: 'bytes=0-0', 'User-Agent': 'Mozilla/5.0' } })
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

export async function downloadToFile(url, filePath, timeoutMs = 60000, request = {}) {
 const controller = new AbortController()
 const timeout = setTimeout(() => controller.abort(), timeoutMs)
 let res
 try {
  res = await fetch(url, {
   signal: controller.signal, agent: mediaAgent, method: request.method || 'GET', body: request.body,
   headers: { Range: 'bytes=0-', 'User-Agent': 'Mozilla/5.0', ...(request.body ? { 'Content-Type': 'application/json' } : {}) },
   size: 60 * 1024 * 1024
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const contentType = res.headers.get('content-type') || ''
  if (/^text\/|(?:application\/(?:json|xml)|\+json)/i.test(contentType)) throw new Error('El proveedor devolvió una página o respuesta inválida en lugar de audio multimedia.')
  const buf = Buffer.from(await res.arrayBuffer())
  if (!buf.length) throw new Error('El proveedor devolvió un archivo de audio vacío.')
  await fs.promises.writeFile(filePath, buf)
  return buf.length
 } finally {
  clearTimeout(timeout)
  res?.body?.destroy()
 }
}

export async function ffmpegToOggOpus(inputPath, outputPath, timeoutMs = 120000) {
 return await new Promise((resolve, reject) => {
   const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-vn', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on', '-application', 'voip', outputPath]
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

async function prepareDownloadedAudio(inputPath, title, { ptt = false, videoId } = {}) {
 const directory = path.join(os.tmpdir(), 'oguricap')
 await fs.promises.mkdir(directory, { recursive: true })
 const output = path.join(directory, `audio_${Date.now()}_${Math.random().toString(16).slice(2)}.${ptt ? 'ogg' : 'mp3'}`)
 const cacheSource = ptt && videoId ? output.replace(/\.ogg$/, '.mp3') : null
 try {
  if (cacheSource) await ffmpegToMp3(inputPath, cacheSource, 180000)
  await (ptt ? ffmpegToOggOpus : ffmpegToMp3)(cacheSource || inputPath, output, 180000)
  const audio = await fs.promises.readFile(output)
  if (!audio.length || audio.length > 16 * 1024 * 1024) throw new Error('El audio no se puede enviar: archivo vacío o mayor a 16 MB.')
  if (videoId) {
   const cached = cacheSource ? await fs.promises.readFile(cacheSource) : audio
   if (cached.length <= 16 * 1024 * 1024) await audioCache.put(videoId, cached).catch(() => {})
  }
  return {
   audio, mimetype: ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg', ptt,
   ...(!ptt ? { fileName: `${String(title || 'Audio').replace(/[\\/\r\n]/g, ' ').slice(0, 100)}.mp3` } : {})
  }
 } finally {
  await fs.promises.unlink(output).catch(() => {})
  if (cacheSource) await fs.promises.unlink(cacheSource).catch(() => {})
 }
}

export async function sendDownloadedAudio(conn, m, inputPath, title, options = {}) {
 const content = await prepareDownloadedAudio(inputPath, title, options)
 return await conn.sendMessage(m.chat, content, { quoted: m })
}

function logAudioProviderFailure(provider, error) {
 const status = Number(String(error?.message || '').match(/HTTP (\d{3})/)?.[1]) || null
 console.warn('[PLAY_PROVIDER]', JSON.stringify({ provider, status }))
}


async function probeVideo(file) {
 const { stdout } = await runMediaTool('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height,pix_fmt:format=duration', '-of', 'json', file], { timeout: 15000, maxBuffer: 1024 * 1024 })
 return JSON.parse(stdout)
}

export async function prepareDownloadedVideo(input, title, expectedSeconds = 0) {
 const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'oguri-video-output-'))
 const output = path.join(directory, 'video.mp4')
 try {
  const source = await probeVideo(input)
  const video = source.streams?.find(stream => stream.codec_type === 'video')
  const audio = source.streams?.find(stream => stream.codec_type === 'audio')
  const duration = Number(source.format?.duration)
  if (!video || !Number.isFinite(duration) || duration <= 0 || duration > 1800) throw new Error('Archivo de video inválido.')
  if (expectedSeconds > 0 && Math.abs(duration - expectedSeconds) > Math.max(2, expectedSeconds * 0.05)) throw new Error('El proveedor no entregó el video completo.')
  const copy = video.codec_name === 'h264' && video.pix_fmt === 'yuv420p' && video.width <= 640 && video.height <= 360 && (!audio || audio.codec_name === 'aac')
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-map', '0:v:0', '-map', '0:a:0?']
  if (copy) args.push('-c', 'copy')
  else args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-vf', 'scale=640:360:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=24', '-c:a', 'aac', '-b:a', '96k', '-ar', '44100', '-threads', '2')
  args.push('-movflags', '+faststart', output)
  await runMediaTool('ffmpeg', args, { timeout: 180000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024 })
  const size = (await fs.promises.stat(output)).size
  if (!size || size > 16 * 1024 * 1024) throw new Error('El video supera el límite de envío de 16 MB.')
  const profile = await probeVideo(output)
  if (profile.streams?.find(stream => stream.codec_type === 'video')?.codec_name !== 'h264' || (audio && profile.streams?.find(stream => stream.codec_type === 'audio')?.codec_name !== 'aac')) throw new Error('El video no es compatible con WhatsApp.')
  const outputDuration = Number(profile.format?.duration)
  if (!Number.isFinite(outputDuration) || Math.abs(outputDuration - duration) > Math.max(1, duration * 0.02)) throw new Error('El archivo de video está incompleto.')
  return { video: await fs.promises.readFile(output), mimetype: 'video/mp4', fileName: `${String(title || 'Video').replace(/[\\/\r\n]/g, ' ').slice(0, 100)}.mp4`, caption: `> ❀ ${title}` }
 } finally {
  await fs.promises.rm(directory, { recursive: true, force: true })
 }
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
 const safeReact = async (emoji) => {
  try { await m.react(emoji) } catch {}
 }

 try {
  if (!text.trim()) return conn.reply(m.chat, `[PLAY_QUERY_REQUIRED] ❀ Ingresa el nombre de una canción o un vídeo musical.`, m)
  if (isYoutubeShortUrl(text)) return conn.reply(m.chat, `[PLAY_SHORTS_NOT_ALLOWED] ⚠ Los Shorts no están permitidos; usa una canción o vídeo musical normal.`, m)
  await safeReact('🕒')
 const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
const query = videoMatch ? 'https://youtu.be/' + videoMatch[1] : text
const videos = await searchVideos(query)
if (!videos.length) throw '[PLAY_NO_RESULTS] ꕥ No se encontraron vídeos para esa búsqueda.'
const wantsVideo = ['play2', 'ytv', 'ytmp4', 'mp4'].includes(command)
let result = wantsVideo
 ? videos.find(video => video && (!video.type || video.type === 'video') && /^[A-Za-z0-9_-]{11}$/.test(String(video.videoId || '')) && !isYoutubeShortUrl(video.url) && (!videoMatch || video.videoId === videoMatch[1]))
 : selectMusicVideo(videos, videoMatch ? videoMatch[1] : null)
if (!result) throw wantsVideo ? '❀ No se encontró un video para esa búsqueda.' : '[PLAY_NO_RELATED_MUSIC] ꕥ No se encontró una canción o vídeo musical relacionado. Shorts, canales y playlists están excluidos.'
const wantsMusic = ['play', 'yta', 'ytmp3', 'playaudio'].includes(command)
const asVoiceNote = ['play', 'playaudio'].includes(command)
let cachedAudio = wantsMusic ? await audioCache.get(result.videoId).catch(() => null) : null
if (wantsMusic && !cachedAudio && !videoMatch) {
 const words = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) || []
 if (words.length >= 2) for (const video of videos.slice(0, 5)) {
  if (!selectMusicVideo([video])) continue
  const label = `${video.title} ${video.author?.name || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (!words.every(word => label.includes(word))) continue
  const audio = await audioCache.get(video.videoId).catch(() => null)
  if (audio) { result = video; cachedAudio = audio; break }
 }
}
const { title, thumbnail, timestamp, views, ago, url, author, seconds } = result
if (seconds > 1800) throw '[PLAY_DURATION_LIMIT] ⚠ El contenido supera el límite de 30 minutos.'
const vistas = formatViews(views)
const info = `「✦」Descargando *<${title}>*\n\n> ❑ Canal » *${author.name}*\n> ♡ Vistas » *${vistas}*\n> ✧︎ Duración » *${timestamp}*\n> ☁︎ Publicado » *${ago}*\n> ➪ Link » ${url}`
const thumb = (await conn.getFile(thumbnail)).data
await conn.sendMessage(m.chat, { image: thumb, caption: info }, { quoted: m })
if (cachedAudio) {
 if (asVoiceNote) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'oguri-cached-audio-'))
  try {
   const input = path.join(directory, 'source.mp3')
   await fs.promises.writeFile(input, cachedAudio, { mode: 0o600 })
   await sendDownloadedAudio(conn, m, input, title, { ptt: true })
  } finally {
   await fs.promises.rm(directory, { recursive: true, force: true })
  }
 } else {
  await conn.sendMessage(m.chat, { audio: cachedAudio, mimetype: 'audio/mpeg', ptt: false, fileName: `${title}.mp3` }, { quoted: m })
 }
 try { await conn.reply(m.chat, '> ❀ *Servidor:* `Oguri (caché)`', m) } catch {}
 await safeReact('✔️')
 return
}
  if (['play', 'yta', 'ytmp3', 'playaudio'].includes(command)) {
   const mel = getMelodyApi()
   const pCfg = getProgressConfig()
   let melodyRawFailed = false
   const audioUnavailable = '❀ No pude preparar esta canción. Inténtalo de nuevo en unos momentos.'

   // MelodyApi raw streaming (real-time progress via Content-Length)
   if (mel && pCfg.enabled) {
   const rawUrl = `${mel.url}/download/ytdl?url=${encodeURIComponent(url)}&type=mp3&raw=1`
    const expectedTotalBytes = estimateAudioBytes(seconds, 128)
    const tmpDir = path.join(os.tmpdir(), 'oguricap')
    const outPath = path.join(tmpDir, `melody_${Date.now()}_${Math.random().toString(16).slice(2)}.mp3`)
			let progressKey = null
            let progressStopped = false
            let editChain = Promise.resolve()
            let audioPrepared = false
			try {
				const initialBar = renderProgressBar(0, pCfg.style, pCfg.width)
				const { key } = await conn.sendMessage(m.chat, { text: `❀ Descargando audio\n${initialBar} 0.0%` }, { quoted: m })
				progressKey = key
				const edit = (t) => {
					if (!progressKey || progressStopped) return Promise.resolve()
					editChain = editChain
						.then(() => !progressStopped && conn.sendMessage(m.chat, { text: t, edit: progressKey }, { quoted: m }))
						.catch(() => {})
					return editChain
				}
     const label = `❀ Descargando audio`
     const dl = await downloadStreamToFile(rawUrl, outPath, {
      headers: mel.headers,
      timeoutMs: 180000,
      headerTimeoutMs: 15000,
      maxBytes: pCfg.maxRawBytes,
      expectedTotalBytes,
      updateMs: pCfg.updateMs,
      minBytes: pCfg.minBytes,
      onProgress: async ({ receivedBytes, totalBytes, speedBps, etaSec, done }) => {
       if (!totalBytes) {
        const t = `${label}\n${formatBytes(receivedBytes)} descargados...`
        if (done) return edit(`${label}\n${formatBytes(receivedBytes)} listo.`)
        return edit(t)
       }
       const pct = Math.min(100, (receivedBytes / totalBytes) * 100)
       const bar = renderProgressBar(pct, pCfg.style, pCfg.width)
       const parts = [`${pct.toFixed(1)}%`, `${formatBytes(receivedBytes)}/${formatBytes(totalBytes)}`]
       if (pCfg.showSpeed) parts.push(`${formatBytes(speedBps)}/s`)
       if (pCfg.showEta && etaSec != null) parts.push(`ETA ${formatEta(etaSec)}`)
       const t = `${label}\n${bar} ${parts.join(' | ')}`
       return edit(t)
      }
     })

     // If server returned JSON/text, continue to fallback APIs.
			if (dl?.contentType && (/application\/json/i.test(dl.contentType) || /^text\//i.test(dl.contentType))) {
				throw new Error(`Unexpected content-type: ${dl.contentType}`)
		}
 		try {
				if (dl && dl.totalBytes) {
					const bar = renderProgressBar(100, pCfg.style, pCfg.width)
					const t = `❀ Audio listo\n${bar} 100.0% | ${formatBytes(dl.totalBytes)}\n❀ Enviando audio...`
					await edit(t)
				} else {
					const rb = dl && Number.isFinite(Number(dl.receivedBytes)) ? Number(dl.receivedBytes) : 0
					await edit(`❀ Audio listo\n${formatBytes(rb)} listo.\n❀ Enviando audio...`)
				}
			} catch {
				await edit(`❀ Enviando audio...`)
			}
      const content = await prepareDownloadedAudio(outPath, title, { ptt: asVoiceNote, videoId: result.videoId })
      audioPrepared = true
      // Delivery errors must not trigger another provider or duplicate the audio.
      progressStopped = true
      await editChain
      await conn.sendMessage(m.chat, content, { quoted: m })
      try { await conn.reply(m.chat, '> ❀ *Servidor:* `MelodyApi`', m) } catch {}
			await safeReact('✔️')
      try { await fs.promises.unlink(outPath) } catch { }
      return
		} catch (e) {
			melodyRawFailed = true
            progressStopped = true
            await editChain
            if (progressKey) {
             try { await conn.sendMessage(m.chat, { delete: progressKey }) }
             catch { try { await conn.sendMessage(m.chat, { text: '❀ Preparando audio…', edit: progressKey }, { quoted: m }) } catch {} }
            }
            await fs.promises.unlink(outPath).catch(() => {})
            if (audioPrepared) throw e
            logAudioProviderFailure('MelodyApi', e)
		}
	}

   const providerOptions = { skipMelodia: melodyRawFailed, song: videoMatch ? undefined : result }
   let candidate = await getAud(url, 0, providerOptions)
   while (candidate) {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'oguri-provider-audio-'))
    let content
    try {
     const input = path.join(directory, 'source.bin')
     // Download once; FFmpeg recognizes the actual format, independent of the URL.
     await downloadToFile(candidate.url, input, 90000)
     content = await prepareDownloadedAudio(input, title, { ptt: asVoiceNote, videoId: candidate.api === 'Nexray (Spotify)' ? undefined : result.videoId })
    } catch (error) {
     logAudioProviderFailure(candidate.api, error)
    } finally {
     await fs.promises.rm(directory, { recursive: true, force: true })
    }
    if (content) {
     await conn.sendMessage(m.chat, content, { quoted: m })
     try { await conn.reply(m.chat, `> ❀ *Servidor:* \`${candidate.api}\``, m) } catch {}
     await safeReact('✔️')
     return
    }
    candidate = await getAud(url, candidate.index + 1, providerOptions)
   }
   throw audioUnavailable
  } else if (wantsVideo) {
   const mel = getMelodyApi()
   const pCfg = getProgressConfig()
   let melodyRawFailed = false
   if (mel) {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'oguri-video-primary-'))
    const input = path.join(directory, 'source.bin')
    let progressKey = null
    let progressStopped = false
    let editChain = Promise.resolve()
    let content
    const edit = text => {
     if (!progressKey || progressStopped) return Promise.resolve()
     editChain = editChain.then(() => !progressStopped && conn.sendMessage(m.chat, { text, edit: progressKey }, { quoted: m })).catch(() => {})
     return editChain
    }
    try {
     if (pCfg.enabled) {
      const response = await conn.sendMessage(m.chat, { text: `❀ Descargando video\n${renderProgressBar(0, pCfg.style, pCfg.width)} 0.0%` }, { quoted: m })
      progressKey = response?.key
     }
     const rawUrl = `${mel.url}/download/ytdl?url=${encodeURIComponent(url)}&type=mp4&raw=1`
     await downloadStreamToFile(rawUrl, input, {
      headers: mel.headers, timeoutMs: 180000, headerTimeoutMs: 15000,
      maxBytes: Math.min(pCfg.maxRawBytes, 60 * 1024 * 1024), updateMs: pCfg.updateMs, minBytes: pCfg.minBytes,
      onProgress: ({ receivedBytes, totalBytes, speedBps, etaSec }) => {
       if (!totalBytes) return edit(`❀ Descargando video\n${formatBytes(receivedBytes)} descargados…`)
       const pct = Math.min(100, receivedBytes / totalBytes * 100)
       const details = [`${pct.toFixed(1)}%`, `${formatBytes(receivedBytes)}/${formatBytes(totalBytes)}`]
       if (pCfg.showSpeed) details.push(`${formatBytes(speedBps)}/s`)
       if (pCfg.showEta && etaSec != null) details.push(`ETA ${formatEta(etaSec)}`)
       return edit(`❀ Descargando video\n${renderProgressBar(pct, pCfg.style, pCfg.width)} ${details.join(' | ')}`)
      }
     })
     content = await prepareDownloadedVideo(input, title, seconds)
     await edit('❀ Video listo. Enviando…')
    } catch (error) {
     melodyRawFailed = true
     progressStopped = true
     await editChain
     if (progressKey) {
      try { await conn.sendMessage(m.chat, { delete: progressKey }) }
      catch { try { await conn.sendMessage(m.chat, { text: '❀ Preparando video…', edit: progressKey }, { quoted: m }) } catch {} }
     }
     logAudioProviderFailure('MelodyApi (video)', error)
    } finally {
     progressStopped = true
     await editChain
     await fs.promises.rm(directory, { recursive: true, force: true })
    }
    if (content) {
     // A WhatsApp delivery error must not start a second download or duplicate the message.
     await conn.sendMessage(m.chat, content, { quoted: m })
     try { await conn.reply(m.chat, '> ❀ *Servidor:* `MelodyApi`', m) } catch {}
     await safeReact('✔️')
     return
    }
   }
   let candidate = await getVid(url, 0, { skipMelodia: melodyRawFailed })
   while (candidate) {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'oguri-video-provider-'))
    let content
    try {
     const input = path.join(directory, 'source.bin')
     await downloadToFile(candidate.url, input, 90000, candidate.request)
     content = await prepareDownloadedVideo(input, title, seconds)
    } catch (error) {
     logAudioProviderFailure(`${candidate.api} (video)`, error)
    } finally {
     await fs.promises.rm(directory, { recursive: true, force: true })
    }
    if (content) {
     await conn.sendMessage(m.chat, content, { quoted: m })
     try { await conn.reply(m.chat, `> ❀ *Servidor:* \`${candidate.api}\``, m) } catch {}
     await safeReact('✔️')
     return
    }
    candidate = await getVid(url, candidate.index + 1, { skipMelodia: melodyRawFailed })
   }
   throw '❀ No pude preparar este video. Inténtalo de nuevo en unos momentos.'
  }
 } catch (e) {
 await safeReact('✖️')
 try {
  return await conn.reply(
   m.chat,
   typeof e === 'string'
    ? e
    : '❀ No pude completar el envío. Inténtalo de nuevo en unos momentos.',
   m
  )
 } catch {
  return
 }
 }}

handler.command = handler.help = ['play', 'yta', 'ytmp3', 'play2', 'ytv', 'ytmp4', 'playaudio', 'mp4']
handler.tags = ['descargas']
handler.group = true

export default handler

function musicWords(value) {
 const labels = new Set(['official', 'oficial', 'audio', 'video', 'visualizer', 'lyrics', 'lyric', 'with', 'letra', 'hd', '4k', 'mv'])
 return (String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[\p{L}\p{N}]+/gu) || []).filter(word => !labels.has(word))
}

function matchesSpotifySong(song, result) {
 if (typeof result?.title !== 'string' || typeof result?.artist !== 'string') return false
 const source = new Set(musicWords(`${song.title} ${song.author?.name || ''}`))
 const candidate = musicWords(`${result.title} ${result.artist}`)
 if (candidate.length < 2 || !candidate.every(word => source.has(word))) return false
 if (!musicWords(result.artist).length) return false
 if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(String(result.duration || ''))) return false
 const duration = String(result.duration).split(':').reduce((total, part) => total * 60 + Number(part), 0)
 const seconds = Number(song.seconds)
 return seconds > 0 && duration > 0 && Math.abs(seconds - duration) <= Math.max(1, Math.min(20, seconds * 0.05))
}

 export async function getAud(url, startIndex = 0, { skipMelodia = false, song } = {}) {
  const apis = []
  const mel = getMelodyApi()
  if (mel?.url) {
   apis.push(
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytmp3?url=${encodeURIComponent(url)}`, headers: mel.headers, extractor: res => res.result?.url || res.result },
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytdl-v2?url=${encodeURIComponent(url)}`, headers: mel.headers, extractor: res => res.result?.download?.mp3 || res.result?.mp3 },
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytdl?url=${encodeURIComponent(url)}`, headers: mel.headers, extractor: res => res.result?.mp3 },
   )
  }
 // Delirius/Yupra no resuelven DNS. Respaldo comprobado el 2026-10-12.
 const backupBase = String(process.env.NEXRAY_API_URL || 'https://api.nexray.eu.cc').replace(/\/+$/, '')
 const source = new URL(url)
 const videoId = source.hostname === 'youtu.be' ? source.pathname.slice(1).split('/')[0] : source.searchParams.get('v')
 if (!/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) return null
 const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`
 const endpoint = `${backupBase}/downloader/v1/ytmp3?url=${encodeURIComponent(canonicalUrl)}`
 const extractor = res => res.status === true ? res.result?.url : null
 apis.push({ api: 'Nexray', endpoint, timeoutMs: 45000, extractor },
  { api: 'Nexray', endpoint: `${endpoint}&_=${Date.now()}`, headers: { 'Cache-Control': 'no-cache' }, timeoutMs: 45000, extractor })
 // Name searches may recover the same studio recording from Spotify.
 // Explicit video URLs and distinct versions must keep their original source.
 const words = song ? musicWords(`${song.title} ${song.author?.name || ''}`) : []
 if (words.length && !words.some(word => ['live', 'cover', 'remix', 'acoustic', 'nightcore', 'slowed', 'sped'].includes(word))) {
  const query = [...new Set(words)].join(' ')
  apis.push({ api: 'Nexray (Spotify)', endpoint: `${backupBase}/downloader/spotifyplay?q=${encodeURIComponent(query)}`, timeoutMs: 30000,
   extractor: res => res.status === true && matchesSpotifySong(song, res.result) ? res.result.download_url : null })
 }
 const firstBackup = apis.findIndex(provider => provider.api !== 'MelodyApi')
 return await fetchFromApis(apis, skipMelodia ? Math.max(startIndex, firstBackup) : startIndex)
 }
 export async function getVid(url, startIndex = 0, { skipMelodia = false } = {}) {
  const apis = []
  const mel = getMelodyApi()
  if (mel?.url) {
   apis.push(
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytmp4?url=${encodeURIComponent(url)}&quality=360`, headers: mel.headers, extractor: res => res.result?.url || res.result },
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytdl-v2?url=${encodeURIComponent(url)}`, headers: mel.headers, extractor: res => res.result?.download?.mp4 || res.result?.mp4 },
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytdl?url=${encodeURIComponent(url)}`, headers: mel.headers, extractor: res => res.result?.mp4 }
   )
  }
  const source = new URL(url)
  const id = source.hostname === 'youtu.be' ? source.pathname.slice(1).split('/')[0] : source.searchParams.get('v')
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || '')) return null
  const canonical = `https://www.youtube.com/watch?v=${id}`
  const base = String(process.env.OGURI_VIDEO_API_URL || 'https://ahm7xmakki.com').replace(/\/+$/, '')
  const endpoint = `${base}/api/alldl?url=${encodeURIComponent(canonical)}`
  const extractor = res => res.success === true ? res.mediaInfo?.videoUrl : null
  const firstBackup = apis.length
  apis.push({ api: 'AllDL', endpoint, timeoutMs: 30000, extractor },
   { api: 'AllDL', endpoint: `${endpoint}&_=${Date.now()}`, headers: { 'Cache-Control': 'no-cache' }, timeoutMs: 30000, extractor })
  const start = skipMelodia ? Math.max(startIndex, firstBackup) : startIndex
  const candidate = start < apis.length ? await fetchFromApis(apis, start) : null
  if (candidate) return candidate
  if (start > apis.length) return null
  // This service prepares the file on its own server rather than handing out IP-bound URLs.
  const streamBase = String(process.env.OGURI_VIDEO_STREAM_API_URL || 'https://save.brianrianrehan.com').replace(/\/+$/, '')
  return {
   api: 'WebDownloader', url: `${streamBase}/api/v1/download?wait=true&download=true`, index: apis.length,
   request: { method: 'POST', body: JSON.stringify({ url: canonical, format: 'video', quality: '360p', outputFormat: 'mp4' }) }
  }
 }
 export async function fetchFromApis(apis, startIndex = 0) {
 for (let i = startIndex; i < apis.length; i++) {
  const { api, endpoint, extractor, headers, timeoutMs = 10000 } = apis[i]
  let timeout
  try {
   const controller = new AbortController()
   timeout = setTimeout(() => controller.abort(), timeoutMs)
   const response = await fetch(endpoint, { signal: controller.signal, headers: headers || {}, size: 1024 * 1024 })
   if (!response.ok) { response.body?.destroy(); continue }
   const res = await response.json()
   const link = extractor(res)
   if (typeof link !== 'string') continue
   const parsed = new URL(link)
   const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase()
   if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || isIP(host) || host === 'localhost' || host.endsWith('.localhost')) continue
   return { url: parsed.toString(), api, index: i }
  } catch (e) {} finally { clearTimeout(timeout) }
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
