import fetch from "node-fetch"
import yts from 'yt-search'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { pipeline } from 'stream'
import { promisify } from 'util'

const streamPipeline = promisify(pipeline)

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

async function downloadStreamToFile(url, filePath, opts = {}) {
 const headers = opts.headers || {}
 const timeoutMs = Number.isFinite(Number(opts.timeoutMs)) ? Number(opts.timeoutMs) : 300000
 const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null
 const maxBytes = Number.isFinite(Number(opts.maxBytes)) ? Number(opts.maxBytes) : null

 const controller = new AbortController()
 const timeout = setTimeout(() => controller.abort(), timeoutMs)
 let res
 try {
  res = await fetch(url, { headers, signal: controller.signal })
 } catch (e) {
  clearTimeout(timeout)
  throw e
 }

	if (!res?.ok) {
		clearTimeout(timeout)
		let detail = ''
		try {
			const ct0 = (res.headers.get('content-type') || '').toString().toLowerCase()
			const text = await res.text().catch(() => '')
			const clean = String(text || '').trim()
			if (clean) {
				if (ct0.includes('application/json') || ct0.includes('+json')) {
					try {
						const j = JSON.parse(clean)
						const msg = (j && typeof j === 'object') ? (j.error || j.message || j.msg) : ''
						detail = String(msg || '').trim() || clean.slice(0, 160)
					} catch {
						detail = clean.slice(0, 160)
					}
				} else {
					detail = clean.slice(0, 160)
				}
			}
		} catch {}
		const base = `HTTP ${res?.status || 'ERR'}`
		throw new Error(detail ? `${base} - ${detail}` : base)
	}
 if (!res.body) {
  clearTimeout(timeout)
  throw new Error('No response body')
 }

 const ct = (res.headers.get('content-type') || '').toString()
 const clRaw = res.headers.get('content-length')
 const cl = clRaw ? Number(clRaw) : NaN
 const totalBytes = Number.isFinite(cl) && cl > 0 ? cl : null

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

async function ffmpegToOggOpus(inputPath, outputPath, timeoutMs = 120000) {
 return await new Promise((resolve, reject) => {
   const args = ['-y', '-i', inputPath, '-vn', '-c:a', 'libopus', '-b:a', '128k', '-application', 'voip', outputPath]
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

const handler = async (m, { conn, text, usedPrefix, command }) => {
 const safeReact = async (emoji) => {
  try { await m.react(emoji) } catch {}
 }

 try {
  if (!text.trim()) return conn.reply(m.chat, `❀ Por favor, ingresa el nombre de la música a descargar.`, m)
  await safeReact('🕒')
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
   const mel = getMelodyApi()
   const pCfg = getProgressConfig()

   // MelodyApi raw streaming (real-time progress via Content-Length)
   if (mel && pCfg.enabled) {
    const rawUrl = `${mel.url}/download/ytdl?url=${encodeURIComponent(url)}&type=mp3&raw=1`
    const tmpDir = path.join(os.tmpdir(), 'oguricap')
    const outPath = path.join(tmpDir, `melody_${Date.now()}_${Math.random().toString(16).slice(2)}.mp3`)
			let progressKey = null
			try {
				const { key } = await conn.sendMessage(m.chat, { text: `❀ Descargando audio (MelodyApi)\n0%` }, { quoted: m })
				progressKey = key
				let editChain = Promise.resolve()
				const edit = (t) => {
					if (!progressKey) return Promise.resolve()
					editChain = editChain
						.then(() => conn.sendMessage(m.chat, { text: t, edit: progressKey }, { quoted: m }))
						.catch(() => {})
					return editChain
				}
     const label = `❀ Descargando audio (MelodyApi)`
     const dl = await downloadStreamToFile(rawUrl, outPath, {
      headers: mel.headers,
      timeoutMs: 8 * 60 * 1000,
      maxBytes: pCfg.maxRawBytes,
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
					const t = `❀ Audio listo (MelodyApi)\n${bar} 100.0% | ${formatBytes(dl.totalBytes)}/${formatBytes(dl.totalBytes)}\n❀ Enviando audio...`
					await edit(t)
				} else {
					const rb = dl && Number.isFinite(Number(dl.receivedBytes)) ? Number(dl.receivedBytes) : 0
					await edit(`❀ Audio listo (MelodyApi)\n${formatBytes(rb)} listo.\n❀ Enviando audio...`)
				}
			} catch {
				await edit(`❀ Enviando audio...`)
			}
			const fileName = `${title}.ogg`
			await conn.sendMessage(m.chat, { audio: { url: outPath }, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: m })
		await safeReact('✔️')
     try { await fs.promises.unlink(outPath) } catch { }
     return
		} catch (e) {
			const reason = (e && e.message) ? String(e.message).trim().slice(0, 140) : ''
			try { if (progressKey) await conn.sendMessage(m.chat, { text: `⚠️ MelodyApi raw falló${reason ? ` (${reason})` : ''}, usando respaldo...`, edit: progressKey }, { quoted: m }) } catch { }
			try { await fs.promises.unlink(outPath) } catch { }
		}
	}

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
		try { await conn.reply(m.chat, `> ❀ *Audio procesado. Servidor:* \`${candidate.api}\``, m) } catch {}
   try {
     // If audio/mp4 or other formats, convert to opus before sending for ptt.
    if ((mimetype === 'audio/mp4' || mimetype === 'audio/mpeg') && typeof candidate.url === 'string') {
     const maxBytesForConvert = 60 * 1024 * 1024
     const total = sniff && sniff.totalBytes ? sniff.totalBytes : null
     if (!total || total <= maxBytesForConvert) {
      const tmpDir = path.join(os.tmpdir(), 'oguricap')
      await fs.promises.mkdir(tmpDir, { recursive: true })
      const inPath = path.join(tmpDir, `in_${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`)
      const outPath = path.join(tmpDir, `out_${Date.now()}_${Math.random().toString(16).slice(2)}.ogg`)
      try {
       await downloadToFile(candidate.url, inPath, 90000)
       await ffmpegToOggOpus(inPath, outPath, 180000)
       const oggOpus = await fs.promises.readFile(outPath)
       await conn.sendMessage(m.chat, { audio: oggOpus, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: m })
      } finally {
       try { await fs.promises.unlink(inPath) } catch { }
       try { await fs.promises.unlink(outPath) } catch { }
      }
     } else {
      await conn.sendMessage(m.chat, { audio: { url: candidate.url }, ptt: true, mimetype: 'audio/ogg; codecs=opus' }, { quoted: m })
     }
    } else {
     await conn.sendMessage(m.chat, { audio: { url: candidate.url }, ptt: true, mimetype: 'audio/opus' }, { quoted: m })
    }
		await safeReact('✔️')
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
   const mel = getMelodyApi()
   const pCfg = getProgressConfig()

   // MelodyApi raw streaming (real-time progress via Content-Length)
   if (mel && pCfg.enabled) {
    const rawUrl = `${mel.url}/download/ytdl?url=${encodeURIComponent(url)}&type=mp4&raw=1`
    const tmpDir = path.join(os.tmpdir(), 'oguricap')
    const outPath = path.join(tmpDir, `melody_${Date.now()}_${Math.random().toString(16).slice(2)}.mp4`)
    let progressKey = null
			try {
				const { key } = await conn.sendMessage(m.chat, { text: `❀ Descargando video (MelodyApi)\n0%` }, { quoted: m })
				progressKey = key
				let editChain = Promise.resolve()
				const edit = (t) => {
					if (!progressKey) return Promise.resolve()
					editChain = editChain
						.then(() => conn.sendMessage(m.chat, { text: t, edit: progressKey }, { quoted: m }))
						.catch(() => {})
					return editChain
				}
     const label = `❀ Descargando video (MelodyApi)`
     const dl = await downloadStreamToFile(rawUrl, outPath, {
      headers: mel.headers,
      timeoutMs: 12 * 60 * 1000,
      maxBytes: pCfg.maxRawBytes,
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

			if (dl?.contentType && (/application\/json/i.test(dl.contentType) || /^text\//i.test(dl.contentType))) {
				throw new Error(`Unexpected content-type: ${dl.contentType}`)
			}
			try {
				if (dl && dl.totalBytes) {
					const bar = renderProgressBar(100, pCfg.style, pCfg.width)
					const t = `❀ Video listo (MelodyApi)\n${bar} 100.0% | ${formatBytes(dl.totalBytes)}/${formatBytes(dl.totalBytes)}\n❀ Enviando video...`
					await edit(t)
				} else {
					const rb = dl && Number.isFinite(Number(dl.receivedBytes)) ? Number(dl.receivedBytes) : 0
					await edit(`❀ Video listo (MelodyApi)\n${formatBytes(rb)} listo.\n❀ Enviando video...`)
				}
			} catch {
				await edit(`❀ Enviando video...`)
			}
			await conn.sendFile(m.chat, outPath, `${title}.mp4`, `> ❀ ${title}`, m)
			await safeReact('✔️')
			try { await fs.promises.unlink(outPath) } catch { }
     return
		} catch (e) {
			const reason = (e && e.message) ? String(e.message).trim().slice(0, 140) : ''
			try { if (progressKey) await conn.sendMessage(m.chat, { text: `⚠️ MelodyApi raw falló${reason ? ` (${reason})` : ''}, usando respaldo...`, edit: progressKey }, { quoted: m }) } catch { }
			try { await fs.promises.unlink(outPath) } catch { }
		}
	}

   let candidate = await getVid(url, 0)
   if (!candidate?.url) throw '⚠ No se pudo obtener el video.'
	 while (candidate) {
		try { await conn.reply(m.chat, `> ❀ *Vídeo procesado. Servidor:* \`${candidate.api}\``, m) } catch {}
   try {
    await conn.sendFile(m.chat, candidate.url, `${title}.mp4`, `> ❀ ${title}`, m)
		await safeReact('✔️')
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
 await safeReact('✖️')
 try {
  return await conn.reply(
   m.chat,
   typeof e === 'string'
    ? e
    : ('⚠︎ Se ha producido un problema.\n> Usa *' + usedPrefix + 'report* para informarlo.\n\n' + (e && e.message ? e.message : 'Error')),
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

 async function getAud(url, startIndex = 0) {
  const apis = []
  const mel = getMelodyApi()
  if (mel?.url) {
   apis.push(
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytmp3?url=${encodeURIComponent(url)}`, headers: mel.headers, extractor: res => res.result?.url || res.result },
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytdl-v2?url=${encodeURIComponent(url)}`, headers: mel.headers, extractor: res => res.result?.download?.mp3 || res.result?.mp3 },
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytdl?url=${encodeURIComponent(url)}`, headers: mel.headers, extractor: res => res.result?.mp3 },
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
  const mel = getMelodyApi()
  if (mel?.url) {
   apis.push(
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytmp4?url=${encodeURIComponent(url)}&quality=360`, headers: mel.headers, extractor: res => res.result?.url || res.result },
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytdl-v2?url=${encodeURIComponent(url)}`, headers: mel.headers, extractor: res => res.result?.download?.mp4 || res.result?.mp4 },
    { api: 'MelodyApi', endpoint: `${mel.url}/download/ytdl?url=${encodeURIComponent(url)}`, headers: mel.headers, extractor: res => res.result?.mp4 },
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
  const { api, endpoint, extractor, headers } = apis[i]
  try {
   const controller = new AbortController()
   const timeout = setTimeout(() => controller.abort(), 10000)
   const res = await fetch(endpoint, { signal: controller.signal, headers: headers || {} }).then(r => r.json())
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
