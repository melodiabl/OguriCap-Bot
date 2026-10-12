import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import baileys from 'baileys'
import { ffmpegToOggOpus } from '../plugins/downloads-play.js'

const execute = promisify(execFile)
async function sample(t) {
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oguri-whatsapp-audio-'))
 t.after(() => fs.rm(directory, { recursive: true, force: true }))
 const input = path.join(directory, 'stereo.wav'), output = path.join(directory, 'voice.ogg')
 await execute('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-ac', '2', '-ar', '44100', input])
 await ffmpegToOggOpus(input, output)
 return { output, audio: await fs.readFile(output) }
}

test('stereo source becomes a WhatsApp voice note with mono Opus at 48kHz', async t => {
 const { output, audio } = await sample(t)
 const { stdout } = await execute('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration', '-of', 'json', output])
 const decoded = JSON.parse(stdout)
 assert.equal(audio.subarray(0, 4).toString(), 'OggS')
 assert.equal(decoded.streams[0].codec_name, 'opus')
 assert.equal(decoded.streams[0].channels, 1)
 assert.equal(decoded.streams[0].sample_rate, '48000')
 assert.ok(Number(decoded.format.duration) >= 2 && Number(decoded.format.duration) < 2.1)
})

test('Baileys voice-note payload encrypts the same complete audio described by its metadata', async t => {
 const { audio } = await sample(t)
 let uploaded
 const logger = { debug() {}, warn() {}, error() {} }
 const message = await baileys.prepareWAMessageMedia({ audio, mimetype: 'audio/ogg; codecs=opus', ptt: true }, {
  logger,
  upload: async stream => {
   const chunks = []
   for await (const chunk of stream) chunks.push(chunk)
   uploaded = Buffer.concat(chunks)
   return { mediaUrl: 'https://mmg.whatsapp.net/offline-test.enc', directPath: '/offline-test.enc' }
  }
 })
 // Use the real protocol implementation and serialize the message as on the wire.
 const wire = baileys.proto.Message.decode(baileys.proto.Message.encode(message).finish()).audioMessage
 assert.equal(wire.mimetype, 'audio/ogg; codecs=opus')
 assert.equal(wire.ptt, true)
 assert.equal(Number(wire.fileLength), audio.length)
 assert.equal(wire.seconds, 2)
 assert.deepEqual(Buffer.from(wire.fileSha256), crypto.createHash('sha256').update(audio).digest())
 assert.deepEqual(Buffer.from(wire.fileEncSha256), crypto.createHash('sha256').update(uploaded).digest())
 const keys = await baileys.getMediaKeys(wire.mediaKey, 'audio')
 const ciphertext = uploaded.subarray(0, -10), mac = uploaded.subarray(-10)
 assert.deepEqual(mac, crypto.createHmac('sha256', keys.macKey).update(keys.iv).update(ciphertext).digest().subarray(0, 10))
 const decipher = crypto.createDecipheriv('aes-256-cbc', keys.cipherKey, keys.iv)
 assert.deepEqual(Buffer.concat([decipher.update(ciphertext), decipher.final()]), audio)
})
