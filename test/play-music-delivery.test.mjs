import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { register } from 'node:module'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

// Stub only the external search; download, conversion and the handler are real.
const fixture = { videos: [{ type: 'video', videoId: 'PbD5tyvPycw', title: 'Fixture song official audio', url: 'https://www.youtube.com/watch?v=PbD5tyvPycw', author: { name: 'Fixture' }, seconds: 2, timestamp: '0:02', thumbnail: 'https://images.test/fixture.png' }] }
const searchUrl = 'data:text/javascript,' + encodeURIComponent(`export default async () => (${JSON.stringify(fixture)})`)
register('data:text/javascript,' + encodeURIComponent(`export function resolve(name, context, next) {
 if (name === 'yt-search') return { url: ${JSON.stringify(searchUrl)}, shortCircuit: true }
 return next(name, context)
}`))
const { default: handler } = await import('../plugins/downloads-play.js')

test('play downloads and sends a real MP3 music attachment instead of a voice note', async t => {
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
 await handler({ chat: 'offline-fixture', react: async () => {} }, { conn, text: 'fixture music', usedPrefix: '.', command: 'play' })
 assert.deepEqual(errors, [])
 assert.match(preview, /Fixture song official audio/)
 assert.ok(Buffer.isBuffer(audioMessage?.audio))
 assert.equal(audioMessage.mimetype, 'audio/mpeg')
 assert.equal(audioMessage.ptt, false)
 assert.equal(audioMessage.fileName, 'Fixture song official audio.mp3')
 const file = path.join(directory, 'sent.mp3')
 await fs.writeFile(file, audioMessage.audio)
 const { stdout } = await execute('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name:format=duration', '-of', 'json', file])
 const profile = JSON.parse(stdout)
 assert.equal(profile.streams[0].codec_name, 'mp3')
 assert.ok(Number(profile.format.duration) >= 2 && Number(profile.format.duration) < 2.1)
})
