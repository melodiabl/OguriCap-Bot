import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const queues = new Map()
export function createAudioCache({ root = path.join(process.cwd(), 'storage/audio-cache'), ttlMs = 60 * 60 * 1000, maxBytes = 128 * 1024 * 1024, now = Date.now } = {}) {
 root = path.resolve(root)
 const valid = id => typeof id === 'string' && id.length === 11 && /^[A-Za-z0-9_-]{11}$/.test(id)
 const filename = id => path.join(root, id + '.cache')
 const locked = task => {
  const work = (queues.get(root) || Promise.resolve()).catch(() => {}).then(task)
  queues.set(root, work)
  const clean = () => { if (queues.get(root) === work) queues.delete(root) }
  work.then(clean, clean)
  return work
 }
 async function read(file) {
  try {
   const record = await fs.readFile(file)
   const separator = record.indexOf(10)
   if (separator < 0 || separator > 1024) return null
   const meta = JSON.parse(record.subarray(0, separator).toString())
   const audio = record.subarray(separator + 1)
   if (meta.version !== 1 || meta.bytes !== audio.length || !Number.isFinite(meta.expiresAt) || !Number.isFinite(meta.createdAt)) return null
   if (crypto.createHash('sha256').update(audio).digest('hex') !== meta.sha256) return null
   return { meta, audio }
  } catch { return null }
 }
 return {
  get(id) {
   if (!valid(id)) return Promise.resolve(null)
   return locked(async () => {
    const record = await read(filename(id))
    return record && record.meta.expiresAt > now() ? record.audio : null
   })
  },
  put(id, audio) {
   if (!valid(id) || !Buffer.isBuffer(audio) || !audio.length || audio.length > maxBytes) return Promise.resolve(false)
   return locked(async () => {
    await fs.mkdir(root, { recursive: true, mode: 0o700 })
    const records = []
    for (const name of await fs.readdir(root)) {
     if (!/^[A-Za-z0-9_-]{11}\.cache$/.test(name)) continue
     const file = path.join(root, name)
     const record = await read(file)
     if (!record || record.meta.expiresAt <= now()) await fs.unlink(file).catch(() => {})
     else if (file !== filename(id)) records.push({ file, ...record.meta })
    }
    records.sort((a, b) => a.createdAt - b.createdAt || a.file.localeCompare(b.file))
    let used = records.reduce((total, record) => total + record.bytes, 0)
    while (used + audio.length > maxBytes && records.length) {
     const oldest = records.shift()
     await fs.unlink(oldest.file)
     used -= oldest.bytes
    }
    const createdAt = now()
    const header = JSON.stringify({ version: 1, createdAt, expiresAt: createdAt + ttlMs, bytes: audio.length, sha256: crypto.createHash('sha256').update(audio).digest('hex') })
    const temporary = filename(id) + '.' + crypto.randomUUID() + '.tmp'
    try {
     await fs.writeFile(temporary, Buffer.concat([Buffer.from(header + '\n'), audio]), { mode: 0o600, flag: 'wx' })
     await fs.rename(temporary, filename(id))
     return true
    } finally { await fs.unlink(temporary).catch(() => {}) }
   })
  }
 }
}
