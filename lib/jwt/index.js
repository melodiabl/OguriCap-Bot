import jwt from 'jsonwebtoken'
import { randomBytes, createHash, randomUUID } from 'node:crypto'

const ACCESS_TTL_SECONDS = 900 // 15 minutes

function getSecret() {
  const raw = String(process.env.JWT_SECRET || '').trim()
  if (!raw) throw new Error('JWT_SECRET no configurada')
  return raw
}

export function createAccessToken({ username, rol }) {
  const jti = randomUUID()
  const token = jwt.sign({ sub: username, username, rol, jti }, getSecret(), { expiresIn: ACCESS_TTL_SECONDS })
  return { token, jti, expiresIn: ACCESS_TTL_SECONDS }
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getSecret())
}

export function createRefreshToken() {
  const rawToken = randomBytes(48).toString('base64url')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  return { rawToken, tokenHash }
}

export function hashRefreshToken(rawToken) {
  return createHash('sha256').update(String(rawToken)).digest('hex')
}

export const ACCESS_TOKEN_SECONDS = ACCESS_TTL_SECONDS
