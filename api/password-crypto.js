import crypto from 'crypto'

function deriveKey(secret) {
  const raw = typeof secret === 'string' ? secret : ''
  if (!raw) return null
  // Derivación simple (estable) a 32 bytes.
  return crypto.createHash('sha256').update(raw, 'utf8').digest()
}

export function encryptPassword(plaintext, secret) {
  const key = deriveKey(secret)
  const text = typeof plaintext === 'string' ? plaintext : ''
  if (!key || !text) return null

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return `v1:${iv.toString('base64')}:${ciphertext.toString('base64')}:${tag.toString('base64')}`
}

export function decryptPassword(payload, secret) {
  const key = deriveKey(secret)
  const raw = typeof payload === 'string' ? payload : ''
  if (!key || !raw) return null

  const parts = raw.split(':')
  if (parts.length !== 4) return null
  const [version, ivB64, cipherB64, tagB64] = parts
  if (version !== 'v1') return null

  const iv = Buffer.from(ivB64, 'base64')
  const ciphertext = Buffer.from(cipherB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  if (!iv.length || !ciphertext.length || !tag.length) return null

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  try {
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
    return plaintext || null
  } catch {
    return null
  }
}

