import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { register } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createAudioCache } from '../lib/play-audio-cache.js'

// Stub only the external search; download, conversion and the handler are real.
const fixture = { videos: [{ type: 'video', videoId: 'PbD5tyvPycw', title: 'Fixture song official audio', url: 'https://www.youtube.com/watch?v=PbD5tyvPycw', author: { name: 'Fixture' }, seconds: 2, timestamp: '0:02', thumbnail: 'https://images.test/fixture.png' }] }
const cacheRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'oguri-music-cache-'))
process.env.OGURI_AUDIO_CACHE_PATH = cacheRoot
test.after(async () => { delete process.env.OGURI_AUDIO_CACHE_PATH; await fs.rm(cacheRoot, { recursive: true, force: true }) })
const searchUrl = 'data:text/javascript,' + encodeURIComponent(`export default async () => (${JSON.stringify(fixture)})`)
register('data:text/javascript,' + encodeURIComponent(`export function resolve(name, context, next) {
 if (name === 'yt-search') return { url: ${JSON.stringify(searchUrl)}, shortCircuit: true }
 return next(name, context)
}`))
const { default: handler } = await import('../plugins/downloads-play.js')

for (const command of ['ytmp3', 'play']) test(`${command} downloads and sends the requested audio format`, async t => {
 await fs.rm(path.join(cacheRoot, 'PbD5tyvPycw.cache'), { force: true })
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oguri-play-music-'))
 t.after(() => fs.rm(directory, { recursive: true, force: true }))
 const sourcePath = path.join(directory, 'source.wav')
 const execute = promisify(execFile)
 await execute('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ac', '2', sourcePath])
 const source = await fs.readFile(sourcePath)
 const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'audio/wav', 'content-length': source.length }); res.end(source) })
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
 const originalAPIs = global.APIs, originalProgress = global.downloadProgress
 global.APIs = { MelodyApi: { url: `http://127.0.0.1:${server.address().port}`, key: 'fixture-key' } }
 global.downloadProgress = { enabled: true }
 t.after(() => { global.APIs = originalAPIs; global.downloadProgress = originalProgress })
 let audioMessage
 let preview
 const errors = []
 const conn = {
  getFile: async () => ({ data: Buffer.from('fixture thumbnail') }),
  sendMessage: async (chat, content) => { if (content.audio) audioMessage = content; if (content.image) preview = content.caption; return { key: { id: 'fixture' } } },
  reply: async (chat, text) => { errors.push(text) }
 }
 await handler({ chat: 'offline-fixture', react: async () => {} }, { conn, text: 'fixture music', usedPrefix: '.', command })
 assert.deepEqual(errors, [])
 assert.match(preview, /Fixture song official audio/)
 assert.ok(Buffer.isBuffer(audioMessage?.audio))
 const ptt = command === 'play'
 assert.equal(audioMessage.mimetype, ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg')
 assert.equal(audioMessage.ptt, ptt)
 assert.equal(audioMessage.fileName, ptt ? undefined : 'Fixture song official audio.mp3')
 const file = path.join(directory, 'sent.mp3')
 await fs.writeFile(file, audioMessage.audio)
 const { stdout } = await execute('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate:format=duration', '-of', 'json', file])
 const profile = JSON.parse(stdout)
 assert.equal(profile.streams[0].codec_name, ptt ? 'opus' : 'mp3')
 if (ptt) {
  assert.equal(profile.streams[0].channels, 1)
  assert.equal(profile.streams[0].sample_rate, '48000')
  assert.equal(audioMessage.audio.subarray(0, 4).toString(), 'OggS')
 }
 assert.ok(Number(profile.format.duration) >= 2 && Number(profile.format.duration) < 2.1)
})

for (const command of ['play', 'playaudio', 'ytmp3']) test(`${command} reuses a validated cached song even when every download provider returns403`, async t => {
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oguri-cached-music-'))
 t.after(() => fs.rm(directory, { recursive: true, force: true }))
 const file = path.join(directory, 'cached.mp3')
 await promisify(execFile)('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-c:a', 'libmp3lame', file])
 const audio = await fs.readFile(file)
 await createAudioCache({ root: cacheRoot }).put('PbD5tyvPycw', audio)
 let requests = 0
 const server = http.createServer((req, res) => { requests++; res.writeHead(403, { 'content-type': 'application/json' }); res.end('{"status":false}') })
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
 t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections() }))
 const originalAPIs = global.APIs, originalBackup = process.env.NEXRAY_API_URL
 const base = `http://127.0.0.1:${server.address().port}`
 global.APIs = { MelodyApi: { url: base, key: 'fixture' } }
 process.env.NEXRAY_API_URL = base
 t.after(() => { global.APIs = originalAPIs; if (originalBackup === undefined) delete process.env.NEXRAY_API_URL; else process.env.NEXRAY_API_URL = originalBackup })
 let received
 const errors = []
 await handler({ chat: 'offline-fixture', react: async () => {} }, {
  conn: { getFile: async () => ({ data: Buffer.from('thumbnail') }), sendMessage: async (chat, content) => { if (content.audio) received = content; return { key: { id: 'fixture' } } }, reply: async (chat, value) => { errors.push(value) } },
  text: 'https://www.youtube.com/watch?v=PbD5tyvPycw', usedPrefix: '.', command
 })
 assert.deepEqual(errors, [])
 const ptt = command !== 'ytmp3'
 assert.ok(Buffer.isBuffer(received?.audio))
 assert.equal(received.mimetype, ptt ? 'audio/ogg; codecs=opus' : 'audio/mpeg')
 assert.equal(received.ptt, ptt)
 if (ptt) {
  assert.equal(received.audio.subarray(0, 4).toString(), 'OggS')
  const sent = path.join(directory, 'sent.ogg')
  await fs.writeFile(sent, received.audio)
  const { stdout } = await promisify(execFile)('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate:format=duration', '-of', 'json', sent])
  const profile = JSON.parse(stdout)
  assert.equal(profile.streams[0].codec_name, 'opus')
  assert.equal(profile.streams[0].channels, 1)
  assert.equal(profile.streams[0].sample_rate, '48000')
  assert.ok(Number(profile.format.duration) >= 2 && Number(profile.format.duration) < 2.1)
 } else assert.deepEqual(received.audio, audio)
 assert.equal(requests, 0)
})
