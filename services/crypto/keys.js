import { hkdfSync } from 'node:crypto'

let _encKey = null
let _hmacKey = null

function getMasterKey() {
  const raw = String(process.env.DB_ENCRYPTION_KEY || '').trim()
  if (!raw) throw new Error('DB_ENCRYPTION_KEY no configurada')
  return Buffer.from(raw, 'hex')
}

export function getEncryptionKey() {
  if (_encKey) return _encKey
  _encKey = Buffer.from(hkdfSync('sha256', getMasterKey(), Buffer.alloc(0), 'pii-encryption', 32))
  return _encKey
}

export function getHmacKey() {
  if (_hmacKey) return _hmacKey
  _hmacKey = Buffer.from(hkdfSync('sha256', getMasterKey(), Buffer.alloc(0), 'blind-index', 32))
  return _hmacKey
}

export function resetKeys() {
  _encKey = null
  _hmacKey = null
}
