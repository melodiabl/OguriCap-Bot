import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createAudioCache } from '../lib/play-audio-cache.js'

const firstId = 'PbD5tyvPycw'
const secondId = 'dQw4w9WgXcQ'
const thirdId = 'a_b-C123456'

async function temporaryRoot(t) {
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'oguri-audio-cache-'))
 t.after(() => fs.rm(directory, { recursive: true, force: true }))
 return directory
}

async function filesWithin(directory) {
 const files = []
 for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
  const file = path.join(directory, entry.name)
  if (entry.isDirectory()) files.push(...await filesWithin(file))
  else if (entry.isFile()) files.push(file)
 }
 return files
}

async function storedPayloadFile(root, payload) {
 for (const file of await filesWithin(root)) {
  if ((await fs.readFile(file)).subarray(-payload.length).equals(payload)) return file
 }
 assert.fail('Expected downloaded audio bytes to be persisted in the cache')
}

test('downloaded audio is reusable by video ID after reopening the cache', async t => {
 const root = await temporaryRoot(t)
 const audio = Buffer.from('ID3 downloaded MP3 fixture')
 const cache = createAudioCache({ root })
 assert.equal(await cache.get(firstId), null)
 assert.equal(await cache.put(firstId, audio), true)

 const reopened = createAudioCache({ root })
 const result = await reopened.get(firstId)
 assert.ok(Buffer.isBuffer(result))
 assert.deepEqual(result, audio)
 assert.equal(await reopened.get(secondId), null)
})

test('default expiry keeps audio for one hour and expires at the boundary', async t => {
 const root = await temporaryRoot(t)
 let time = 1_000
 const audio = Buffer.from('ID3 default expiry fixture')
 const cache = createAudioCache({ root, now: () => time })
 assert.equal(await cache.put(firstId, audio), true)
 time += 3_600_000 - 1
 assert.deepEqual(await cache.get(firstId), audio)
 time += 1
 assert.equal(await cache.get(firstId), null)
})

test('custom expiry survives reopening and cache reads do not extend it', async t => {
 const root = await temporaryRoot(t)
 let time = 10_000
 const audio = Buffer.from('ID3 short expiry fixture')
 const options = { root, ttlMs: 100, now: () => time }
 assert.equal(await createAudioCache(options).put(firstId, audio), true)
 time += 99
 assert.deepEqual(await createAudioCache(options).get(firstId), audio)
 time += 1
 assert.equal(await createAudioCache(options).get(firstId), null)
})

test('same-length corruption is rejected even after reopening the cache', async t => {
 const root = await temporaryRoot(t)
 const audio = Buffer.from('ID3 original downloaded MP3')
 const cache = createAudioCache({ root })
 assert.equal(await cache.put(firstId, audio), true)
 const file = await storedPayloadFile(root, audio)
 const corrupted = await fs.readFile(file)
 corrupted[corrupted.length - 1] ^= 1
 await fs.writeFile(file, corrupted)

 assert.equal(await createAudioCache({ root }).get(firstId), null)
})

test('a missing or truncated audio file is a cache miss', async t => {
 const root = await temporaryRoot(t)
 const audio = Buffer.from('ID3 complete downloaded MP3')
 const cache = createAudioCache({ root })
 assert.equal(await cache.put(firstId, audio), true)
 const file = await storedPayloadFile(root, audio)
 await fs.writeFile(file, audio.subarray(0, 4))
 assert.equal(await cache.get(firstId), null)

 assert.equal(await cache.put(firstId, audio), true)
 await fs.unlink(await storedPayloadFile(root, audio))
 assert.equal(await cache.get(firstId), null)
})

test('invalid keys cannot read or write outside the cache root', async t => {
 const directory = await temporaryRoot(t)
 const root = path.join(directory, 'cache')
 const outside = path.join(directory, 'outside.mp3')
 const sentinel = Buffer.from('must remain unchanged')
 await fs.writeFile(outside, sentinel)
 await fs.mkdir(root)
 const cache = createAudioCache({ root })
 const invalidIds = [
  '../outside', '../outside.mp3', '/etc/passwd', '..\\outside',
  '', 'a'.repeat(10), 'a'.repeat(12), 'abc defghij',
  'abc.defghij', 'PbD5tyvPycw\n', null, undefined, 123,
  'https://youtu.be/PbD5tyvPycw'
 ]
 for (const videoId of invalidIds) {
  assert.equal(await cache.get(videoId), null, `get rejects ${String(videoId)}`)
  assert.equal(await cache.put(videoId, Buffer.from('replacement')), false, `put rejects ${String(videoId)}`)
 }
 assert.deepEqual(await fs.readFile(outside), sentinel)
 assert.deepEqual(await filesWithin(root), [])
 assert.equal(await cache.put(thirdId, Buffer.from('valid ID with underscore and hyphen')), true)
})

test('an oversized entry is rejected without evicting existing audio', async t => {
 const root = await temporaryRoot(t)
 const cache = createAudioCache({ root, maxBytes: 16 })
 const audio = Buffer.alloc(16, 1)
 assert.equal(await cache.put(firstId, audio), true)
 assert.equal(await cache.put(secondId, Buffer.alloc(17, 2)), false)
 assert.deepEqual(await cache.get(firstId), audio)
 assert.equal(await cache.get(secondId), null)
})

test('aggregate capacity evicts the oldest stored audio across cache instances', async t => {
 const root = await temporaryRoot(t)
 let time = 1_000
 const options = { root, maxBytes: 12, now: () => time }
 const first = Buffer.alloc(6, 1)
 const second = Buffer.alloc(6, 2)
 const third = Buffer.alloc(6, 3)
 const cache = createAudioCache(options)
 assert.equal(await cache.put(firstId, first), true)
 time += 1
 assert.equal(await cache.put(secondId, second), true)
 assert.deepEqual(await cache.get(firstId), first)
 time += 1
 const reopened = createAudioCache(options)
 assert.equal(await reopened.put(thirdId, third), true)

 assert.equal(await reopened.get(firstId), null)
 assert.deepEqual(await reopened.get(secondId), second)
 assert.deepEqual(await reopened.get(thirdId), third)
 for (const file of await filesWithin(root)) {
  assert.equal((await fs.readFile(file)).subarray(-first.length).equals(first), false, 'evicted audio must release disk space')
 }
})

test('replacing an existing entry counts only its new payload toward capacity', async t => {
 const root = await temporaryRoot(t)
 const cache = createAudioCache({ root, maxBytes: 12 })
 const otherAudio = Buffer.alloc(6, 2)
 assert.equal(await cache.put(firstId, Buffer.alloc(6, 1)), true)
 assert.equal(await cache.put(secondId, otherAudio), true)
 const replacement = Buffer.alloc(6, 3)
 assert.equal(await cache.put(firstId, replacement), true)
 assert.deepEqual(await cache.get(firstId), replacement)
 assert.deepEqual(await cache.get(secondId), otherAudio)
})

test('concurrent puts across cache instances cannot exceed aggregate capacity', async t => {
 const root = await temporaryRoot(t)
 const maxBytes = 32
 const cache = createAudioCache({ root, maxBytes })
 const otherCache = createAudioCache({ root, maxBytes })
 const entries = Array.from({ length: 20 }, (_, index) => ({
  id: `v${String(index).padStart(10, '0')}`,
  audio: Buffer.alloc(8, index + 1)
 }))
 const results = await Promise.all(entries.map(({ id, audio }, index) => (index % 2 ? otherCache : cache).put(id, audio)))
 assert.ok(results.every(result => typeof result === 'boolean'))
 const reopened = createAudioCache({ root, maxBytes })
 let retainedBytes = 0
 for (const { id, audio } of entries) {
  const result = await reopened.get(id)
  if (result !== null) {
   assert.deepEqual(result, audio)
   retainedBytes += result.length
  }
 }
 assert.ok(retainedBytes > 0, 'concurrent writes should retain usable audio')
 assert.ok(retainedBytes <= maxBytes, `retained ${retainedBytes} audio bytes with a ${maxBytes}-byte cap`)
 let persistedBytes = 0
 for (const file of await filesWithin(root)) {
  const contents = await fs.readFile(file)
  const entry = entries.find(({ audio }) => contents.subarray(-audio.length).equals(audio))
  if (entry) persistedBytes += entry.audio.length
 }
 assert.ok(persistedBytes <= maxBytes, 'evicted audio must not remain on disk')
})

test('replacement writes publish complete audio atomically to concurrent readers', async t => {
 const root = await temporaryRoot(t)
 const oldAudio = Buffer.alloc(512 * 1024, 1)
 const newAudio = Buffer.alloc(oldAudio.length, 2)
 const cache = createAudioCache({ root, maxBytes: 2 * oldAudio.length })
 assert.equal(await cache.put(firstId, oldAudio), true)
 const file = await storedPayloadFile(root, oldAudio)
 await Promise.all([
  (async () => {
   for (let index = 0; index < 60; index++) {
    const result = (await fs.readFile(file)).subarray(-oldAudio.length)
    assert.ok(result.equals(oldAudio) || result.equals(newAudio), 'readers must see one complete committed payload')
   }
  })(),
  (async () => {
   for (let index = 0; index < 24; index++) {
    assert.equal(await cache.put(firstId, index % 2 === 0 ? newAudio : oldAudio), true)
   }
  })()
 ])
 assert.deepEqual(await cache.get(firstId), oldAudio)
})
