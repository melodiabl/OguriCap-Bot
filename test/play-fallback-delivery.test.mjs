import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import dns from 'node:dns'
import { register } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

// Only external search and the WhatsApp connection are replaced. HTTP downloads,
// provider selection and FFmpeg conversion run against a real local WAV file.
const fixture = { videos: [{ type: 'video', videoId: 'F4llback001', title: 'Fixture song official audio', url: 'https://www.youtube.com/watch?v=F4llback001', author: { name: 'Fixture' }, seconds: 2, timestamp: '0:02', thumbnail: 'https://images.test/fixture.png' }] }
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oguri-fallback-delivery-'))
const cacheRoot = path.join(directory, 'cache')
const previousCache = process.env.OGURI_AUDIO_CACHE_PATH
process.env.OGURI_AUDIO_CACHE_PATH = cacheRoot
test.after(async () => {
 if (previousCache === undefined) delete process.env.OGURI_AUDIO_CACHE_PATH
 else process.env.OGURI_AUDIO_CACHE_PATH = previousCache
 await fs.rm(directory, { recursive: true, force: true })
})
const searchUrl = 'data:text/javascript,' + encodeURIComponent(`export default async () => (${JSON.stringify(fixture)})`)
register('data:text/javascript,' + encodeURIComponent(`export function resolve(name, context, next) {
 if (name === 'yt-search') return { url: ${JSON.stringify(searchUrl)}, shortCircuit: true }
 return next(name, context)
}`))
const { default: handler } = await import('../plugins/downloads-play.js')
const execute = promisify(execFile)
const wavPath = path.join(directory, 'source.wav')
await execute('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=550:duration=2', '-ac', '2', wavPath])
const wav = await fs.readFile(wavPath)
const technicalFailure = /fall[oó]|\b503\b|\breport\b|\berror\b|\bAPI\b|\bHTTP\b|stack|at .*\.js:\d/i

async function runFallback(t, { failFirstMedia = false, failAll = false, spotify, text = 'https://www.youtube.com/watch?v=F4llback001' } = {}) {
 await fs.rm(cacheRoot, { recursive: true, force: true })
 const events = []
 let metadataRequests = 0
 let base
 const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, base)
  events.push({ request: requestUrl.pathname, search: requestUrl.search })
  if (requestUrl.pathname === '/downloader/v1/ytmp3') {
   metadataRequests++
   const media = new URL(`/media/${metadataRequests}.wav`, base)
   media.hostname = 'fallback-media.fixture.test'
   res.writeHead(200, { 'content-type': 'application/json' })
   res.end(JSON.stringify({ status: true, result: { url: media.toString() } }))
  } else if (requestUrl.pathname === '/downloader/spotifyplay' && spotify) {
   const media = new URL('/media/spotify.wav', base)
   media.hostname = 'fallback-media.fixture.test'
   res.writeHead(200, { 'content-type': 'application/json' })
   res.end(JSON.stringify({ status: true, result: { title: 'Fixture song', artist: 'Fixture', duration: '0:02', download_url: media.toString(), url: 'https://open.spotify.com/track/abc', ...spotify } }))
  } else if ((spotify && requestUrl.pathname === '/media/spotify.wav') || (requestUrl.pathname.startsWith('/media/') && !failAll && !(failFirstMedia && requestUrl.pathname === '/media/1.wav'))) {
   res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': wav.length })
   res.end(wav)
  } else {
   res.writeHead(503, { 'content-type': 'application/json' })
   res.end(JSON.stringify({ status: false, error: 'Fixture provider unavailable HTTP503' }))
  }
 })
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 base = `http://127.0.0.1:${server.address().port}`
 t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
 const originalLookup = dns.lookup
 dns.lookup = (hostname, options, callback) => {
  if (hostname !== 'fallback-media.fixture.test') return originalLookup(hostname, options, callback)
  if (typeof options === 'function') { callback = options; options = {} }
  if (options?.all) callback(null, [{ address: '127.0.0.1', family: 4 }])
  else callback(null, '127.0.0.1', 4)
 }
 const originalAPIs = global.APIs, originalProgress = global.downloadProgress, originalBackup = process.env.NEXRAY_API_URL
 global.APIs = { MelodyApi: { url: base, key: 'offline-fixture-key' } }
 global.downloadProgress = { enabled: true }
 process.env.NEXRAY_API_URL = base
 t.after(() => {
  dns.lookup = originalLookup
  global.APIs = originalAPIs
  global.downloadProgress = originalProgress
  if (originalBackup === undefined) delete process.env.NEXRAY_API_URL
  else process.env.NEXRAY_API_URL = originalBackup
 })
 let messageNumber = 0
 const conn = {
  getFile: async () => ({ data: Buffer.from('fixture thumbnail') }),
  sendMessage: async (chat, content) => {
   const key = { id: `offline-message-${++messageNumber}` }
   events.push({ content, key })
   return { key }
  },
  reply: async (chat, text) => { events.push({ content: { text } }); return { key: { id: `offline-reply-${++messageNumber}` } } }
 }
 await handler({ chat: 'offline-fixture', react: async () => {} }, { conn, text, usedPrefix: '.', command: 'play' })
 return { events, metadataRequests }
}

function userText(events) {
 return events.flatMap(event => [event.content?.text, event.content?.caption]).filter(Boolean).join('\n')
}

async function assertVoiceAudio(events, outputName) {
 const audio = events.find(event => event.content?.audio)?.content
 assert.ok(Buffer.isBuffer(audio?.audio), 'a usable backup must deliver the audio')
 assert.equal(audio.ptt, true)
 assert.equal(audio.mimetype, 'audio/ogg; codecs=opus')
 assert.equal(audio.audio.subarray(0, 4).toString(), 'OggS')
 const file = path.join(directory, outputName)
 await fs.writeFile(file, audio.audio)
 const { stdout } = await execute('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate:format=duration', '-of', 'json', file])
 const profile = JSON.parse(stdout)
 assert.equal(profile.streams[0].codec_name, 'opus')
 assert.equal(profile.streams[0].channels, 1)
 assert.equal(profile.streams[0].sample_rate, '48000')
 assert.ok(Number(profile.format.duration) >= 2 && Number(profile.format.duration) < 2.1)
}

function assertSuccessfulServerAnnouncement(events) {
 const audioIndex = events.findIndex(event => event.content?.audio)
 const announcements = events.map((event, index) => ({ text: event.content?.text || '', index })).filter(event => /Servidor/i.test(event.text))
 assert.equal(announcements.length, 1, 'only the provider that delivered audio is announced')
 assert.match(announcements[0].text, /Servidor[^\n]*Nexray/i)
 assert.ok(announcements[0].index > audioIndex, 'the provider is announced after successful audio delivery')
}

test('a raw503 removes its progress bar before quietly switching to a working backup', async t => {
 const { events } = await runFallback(t)
 await assertVoiceAudio(events, 'quiet-fallback.ogg')
 const progress = events.find(event => event.content?.text && /0\.0%/.test(event.content.text))
 assert.ok(progress, 'the raw provider initially displays a progress bar')
 const deletionIndex = events.findIndex(event => event.content?.delete?.id === progress.key.id)
 assert.ok(deletionIndex >= 0, 'the abandoned progress message is deleted')
 assert.ok(deletionIndex < events.findIndex(event => event.request === '/downloader/v1/ytmp3'), 'the progress bar is removed before the backup starts')
 assert.doesNotMatch(userText(events), technicalFailure)
 assertSuccessfulServerAnnouncement(events)
})

test('a backup media503 continues to the next candidate and sends real Opus before naming the server', async t => {
 const { events, metadataRequests } = await runFallback(t, { failFirstMedia: true })
 await assertVoiceAudio(events, 'retry-fallback.ogg')
 assert.equal(metadataRequests, 2, 'a rejected media URL must not abort the remaining provider candidate')
 assert.doesNotMatch(userText(events), technicalFailure)
 assertSuccessfulServerAnnouncement(events)
})

test('exhausted providers give a friendly message without status codes or a false successful server announcement', async t => {
 const { events, metadataRequests } = await runFallback(t, { failAll: true })
 assert.equal(metadataRequests, 2, 'all available backup candidates are tried')
 assert.equal(events.some(event => event.content?.audio), false)
 const lastText = events.filter(event => event.content?.text).at(-1)?.content.text
 assert.match(lastText || '', /audio|canci[oó]n|descarga/i)
 assert.doesNotMatch(userText(events), technicalFailure)
 assert.doesNotMatch(userText(events), /Servidor/i)
 assert.ok(events.some(event => event.content?.delete), 'the abandoned progress bar is removed even when all backups are unavailable')
})

test('a matching Spotify result rescues a song search after both YouTube media candidates return503', async t => {
 const { events, metadataRequests } = await runFallback(t, { failAll: true, spotify: {}, text: 'fixture music' })
 assert.equal(metadataRequests, 2)
 const spotifyRequest = events.find(event => event.request === '/downloader/spotifyplay')
 assert.ok(spotifyRequest, 'the final song-search backup uses the Spotify route')
 assert.ok(new URLSearchParams(spotifyRequest.search).get('q'), 'Spotify search includes a song query')
 await assertVoiceAudio(events, 'spotify-fallback.ogg')
 assert.doesNotMatch(userText(events), technicalFailure)
 assertSuccessfulServerAnnouncement(events)
 const announcement = events.find(event => /Servidor/i.test(event.content?.text || '')).content.text
 assert.match(announcement, /Nexray \(Spotify\)/)
 await assert.rejects(fs.access(path.join(cacheRoot, 'F4llback001.cache')), { code: 'ENOENT' }, 'a Spotify recording must not become the cached source for an explicit YouTube URL')
})

test('an explicit YouTube URL never switches to a different Spotify recording', async t => {
 const { events, metadataRequests } = await runFallback(t, { failAll: true, spotify: {} })
 assert.equal(metadataRequests, 2)
 assert.equal(events.some(event => event.request === '/downloader/spotifyplay'), false)
 assert.equal(events.some(event => event.content?.audio), false)
 assert.doesNotMatch(userText(events), /Servidor/i)
 assert.doesNotMatch(userText(events), technicalFailure)
})

for (const [label, spotify] of [
 ['title', { title: 'Completely different recording' }],
 ['artist', { artist: 'Unrelated performer' }],
 ['duration', { duration: '3:30' }]
]) test(`Spotify backup refuses a mismatched ${label} instead of sending the wrong song`, async t => {
 const { events, metadataRequests } = await runFallback(t, { failAll: true, spotify, text: 'fixture music' })
 assert.equal(metadataRequests, 2)
 assert.ok(events.some(event => event.request === '/downloader/spotifyplay'), 'the candidate metadata is checked')
 assert.equal(events.some(event => event.content?.audio), false)
 assert.equal(events.some(event => event.request === '/media/spotify.wav'), false, 'a mismatched song is rejected before its audio is downloaded')
 assert.doesNotMatch(userText(events), /Servidor/i)
 assert.doesNotMatch(userText(events), technicalFailure)
})
