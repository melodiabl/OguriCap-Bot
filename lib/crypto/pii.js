import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'node:crypto'
import { getEncryptionKey, getHmacKey } from './keys.js'

export function encryptPII(plaintext) {
  if (plaintext == null) return null
  const key = getEncryptionKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v2:${iv.toString('base64')}:${ct.toString('base64')}:${tag.toString('base64')}`
}

export function decryptPII(payload) {
  if (payload == null) return null
  const parts = String(payload).split(':')
  if (parts.length !== 4 || parts[0] !== 'v2') return null
  try {
    const key = getEncryptionKey()
    const iv = Buffer.from(parts[1], 'base64')
    const ct = Buffer.from(parts[2], 'base64')
    const tag = Buffer.from(parts[3], 'base64')
    if (!iv.length || !ct.length || !tag.length) return null
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch { return null }
}

export function blindIndex(value) {
  if (value == null) return null
  const key = getHmacKey()
  return createHmac('sha256', key).update(String(value).toLowerCase().trim()).digest('hex')
}
