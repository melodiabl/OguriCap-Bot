# DB Audit + JWT/Crypto Security — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add access/refresh token rotation with DB-backed revocation (keeping `jsonwebtoken`), encrypt PII (email, whatsapp) with AES-256-GCM + HMAC blind indexes, clean up the DB schema, and fix the WhatsApp JID normalization bug affecting 16 users.

**Architecture:** A new `lib/crypto/` module handles HKDF key derivation and PII encryption; `lib/jwt/index.js` wraps the existing `jsonwebtoken` for short-lived access tokens (15min) and adds opaque refresh tokens stored hashed in DB. Auth middleware gets a JTI blacklist check. No library migration needed.

**Tech Stack:** `jsonwebtoken` (existing, kept as-is), Node.js built-in `node:crypto` (HKDF, AES-256-GCM, HMAC-SHA256), PostgreSQL, Next.js/Axios frontend.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/crypto/keys.js` | CREATE | HKDF key derivation — encryption key + HMAC key from master secret |
| `lib/crypto/pii.js` | CREATE | `encryptPII`, `decryptPII`, `blindIndex` |
| `lib/jwt/index.js` | CREATE | `createAccessToken`, `verifyAccessToken`, `createRefreshToken`, `hashRefreshToken` (wraps jsonwebtoken) |
| `database/migrations/003_security_pii.sql` | CREATE | Schema: `refresh_tokens`, `token_blacklist`, PII columns on `usuarios` |
| `database/migrations/migrate-pii.mjs` | CREATE | One-time data migration: normalize JIDs, migrate email, encrypt PII |
| `api/lib/pg-usuarios.js` | MODIFY | Decrypt PII in `normalizeUser`, blind-index lookups, new allowed fields |
| `api/routes/auth.js` | MODIFY | Login issues short-lived token + refresh, add `/api/auth/refresh`, revoke on logout |
| `api/middleware/core.js` | MODIFY | Short access token expiry (15min), add JTI blacklist check in `getJwtAuth` |
| `plugins/panel-registro.js` | MODIFY | Normalize `m.sender` JID before sending to auto-register |
| `frontend-next/src/services/api.ts` | MODIFY | Add refresh interceptor on 401 |
| `frontend-next/src/contexts/AuthContext.tsx` | MODIFY | Logout calls `POST /api/auth/logout` |
| `test/crypto-keys.test.mjs` | CREATE | Tests for key derivation |
| `test/crypto-pii.test.mjs` | CREATE | Tests for PII encrypt/decrypt/blindIndex |
| `test/jwt-helpers.test.mjs` | CREATE | Tests for createAccessToken / verifyAccessToken / createRefreshToken |
| `.env` / `.env.example` | MODIFY | Add `DB_ENCRYPTION_KEY` |

---

## Task 1: Add `DB_ENCRYPTION_KEY` to env

**Files:**
- Modify: `/home/OguriCap-Bot/.env`
- Modify: `/home/OguriCap-Bot/.env.example`

- [ ] **Step 1: Add DB_ENCRYPTION_KEY to .env**

```bash
echo "DB_ENCRYPTION_KEY=\"$(openssl rand -hex 32)\"" >> /home/OguriCap-Bot/.env
```

Verify it was added:
```bash
grep DB_ENCRYPTION_KEY /home/OguriCap-Bot/.env
```

- [ ] **Step 3: Add DB_ENCRYPTION_KEY to .env.example** (already done in previous session — verify it's there)

```bash
grep DB_ENCRYPTION_KEY /home/OguriCap-Bot/.env.example
```

Expected: line present.

- [ ] **Step 4: Commit**

```bash
cd /home/OguriCap-Bot
git add .env.example
git commit -m "chore: add DB_ENCRYPTION_KEY to env template"
```

---

## Task 2: `lib/crypto/keys.js` — HKDF key derivation

**Files:**
- Create: `lib/crypto/keys.js`
- Create: `test/crypto-keys.test.mjs`

- [ ] **Step 1: Write failing test**

Create `/home/OguriCap-Bot/test/crypto-keys.test.mjs`:

```js
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

process.env.DB_ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes as hex

const { getEncryptionKey, getHmacKey } = await import('../lib/crypto/keys.js')

describe('getEncryptionKey', () => {
  test('returns a 32-byte Buffer', () => {
    const key = getEncryptionKey()
    assert.ok(Buffer.isBuffer(key))
    assert.strictEqual(key.length, 32)
  })
  test('is deterministic', () => {
    assert.deepStrictEqual(getEncryptionKey(), getEncryptionKey())
  })
})

describe('getHmacKey', () => {
  test('returns a 32-byte Buffer', () => {
    const key = getHmacKey()
    assert.ok(Buffer.isBuffer(key))
    assert.strictEqual(key.length, 32)
  })
  test('is different from encryptionKey', () => {
    assert.notDeepStrictEqual(getEncryptionKey(), getHmacKey())
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /home/OguriCap-Bot
node --test test/crypto-keys.test.mjs 2>&1 | tail -10
```

Expected: error "Cannot find module '../lib/crypto/keys.js'"

- [ ] **Step 3: Create `lib/crypto/keys.js`**

```js
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
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd /home/OguriCap-Bot
node --test test/crypto-keys.test.mjs 2>&1 | tail -10
```

Expected: `# pass 4`

- [ ] **Step 5: Commit**

```bash
git add lib/crypto/keys.js test/crypto-keys.test.mjs
git commit -m "feat(crypto): add HKDF key derivation module"
```

---

## Task 3: `lib/crypto/pii.js` — PII encrypt/decrypt/blindIndex

**Files:**
- Create: `lib/crypto/pii.js`
- Create: `test/crypto-pii.test.mjs`

- [ ] **Step 1: Write failing test**

Create `/home/OguriCap-Bot/test/crypto-pii.test.mjs`:

```js
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

process.env.DB_ENCRYPTION_KEY = 'b'.repeat(64)

const { encryptPII, decryptPII, blindIndex } = await import('../lib/crypto/pii.js')

describe('encryptPII / decryptPII', () => {
  test('round-trips correctly', () => {
    const enc = encryptPII('test@example.com')
    assert.strictEqual(decryptPII(enc), 'test@example.com')
  })
  test('encrypted value starts with v2:', () => {
    assert.ok(encryptPII('hello').startsWith('v2:'))
  })
  test('two encryptions of same input differ (random IV)', () => {
    assert.notStrictEqual(encryptPII('hello'), encryptPII('hello'))
  })
  test('decryptPII(null) returns null', () => {
    assert.strictEqual(decryptPII(null), null)
  })
  test('decryptPII(malformed) returns null', () => {
    assert.strictEqual(decryptPII('not-valid-format'), null)
  })
  test('encryptPII(null) returns null', () => {
    assert.strictEqual(encryptPII(null), null)
  })
})

describe('blindIndex', () => {
  test('is deterministic', () => {
    assert.strictEqual(blindIndex('test@example.com'), blindIndex('test@example.com'))
  })
  test('normalizes case', () => {
    assert.strictEqual(blindIndex('TEST@EXAMPLE.COM'), blindIndex('test@example.com'))
  })
  test('returns hex string of 64 chars (SHA-256)', () => {
    const idx = blindIndex('hello')
    assert.match(idx, /^[0-9a-f]{64}$/)
  })
  test('blindIndex(null) returns null', () => {
    assert.strictEqual(blindIndex(null), null)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /home/OguriCap-Bot
node --test test/crypto-pii.test.mjs 2>&1 | tail -10
```

Expected: "Cannot find module '../lib/crypto/pii.js'"

- [ ] **Step 3: Create `lib/crypto/pii.js`**

```js
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
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd /home/OguriCap-Bot
node --test test/crypto-pii.test.mjs 2>&1 | tail -10
```

Expected: `# pass 10`

- [ ] **Step 5: Commit**

```bash
git add lib/crypto/pii.js test/crypto-pii.test.mjs
git commit -m "feat(crypto): add PII AES-256-GCM encryption and HMAC blind index"
```

---

## Task 4: `lib/jwt/index.js` — jose JWT helpers

**Files:**
- Create: `lib/jwt/index.js`
- Create: `test/jwt-helpers.test.mjs`

- [ ] **Step 1: Write failing test**

Create `/home/OguriCap-Bot/test/jwt-helpers.test.mjs`:

```js
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET = 'test-secret-for-jwt-tests-minimum-32-chars-long'

const { createAccessToken, verifyAccessToken, createRefreshToken, hashRefreshToken } =
  await import('../lib/jwt/index.js')

describe('createAccessToken', () => {
  test('returns token, jti, expiresIn', () => {
    const { token, jti, expiresIn } = createAccessToken({ username: 'juan', rol: 'usuario' })
    assert.ok(typeof token === 'string' && token.length > 20)
    assert.ok(typeof jti === 'string' && jti.length > 10)
    assert.strictEqual(expiresIn, 900)
  })
  test('verifyAccessToken decodes sub and rol', () => {
    const { token } = createAccessToken({ username: 'maria', rol: 'admin' })
    const payload = verifyAccessToken(token)
    assert.strictEqual(payload.sub, 'maria')
    assert.strictEqual(payload.rol, 'admin')
  })
  test('verifyAccessToken throws on invalid token', () => {
    assert.throws(() => verifyAccessToken('bad.token.value'))
  })
})

describe('createRefreshToken', () => {
  test('returns rawToken and tokenHash', () => {
    const { rawToken, tokenHash } = createRefreshToken()
    assert.ok(typeof rawToken === 'string' && rawToken.length > 30)
    assert.ok(typeof tokenHash === 'string' && tokenHash.length === 64) // SHA-256 hex
    assert.notStrictEqual(rawToken, tokenHash)
  })
  test('hashRefreshToken is deterministic', () => {
    const { rawToken, tokenHash } = createRefreshToken()
    assert.strictEqual(hashRefreshToken(rawToken), tokenHash)
  })
  test('two calls produce different tokens', () => {
    const a = createRefreshToken()
    const b = createRefreshToken()
    assert.notStrictEqual(a.rawToken, b.rawToken)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd /home/OguriCap-Bot
node --test test/jwt-helpers.test.mjs 2>&1 | tail -10
```

Expected: "Cannot find module '../lib/jwt/index.js'"

- [ ] **Step 3: Create `lib/jwt/index.js`**

```js
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
  return jwt.verify(token, getSecret()) // throws on invalid/expired
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
```

- [ ] **Step 4: Run test — expect PASS**

```bash
cd /home/OguriCap-Bot
node --test test/jwt-helpers.test.mjs 2>&1 | tail -10
```

Expected: `# pass 7`

- [ ] **Step 5: Commit**

```bash
git add lib/jwt/index.js test/jwt-helpers.test.mjs
git commit -m "feat(jwt): add jose-based JWT helpers with access/refresh token support"
```

---

## Task 5: DB migration SQL

**Files:**
- Create: `database/migrations/003_security_pii.sql`

- [ ] **Step 1: Create the migration file**

Create `/home/OguriCap-Bot/database/migrations/003_security_pii.sql`:

```sql
-- ============================================================
-- 003: Security — refresh_tokens, token_blacklist, PII columns
-- ============================================================

-- Refresh token storage (one row per active session)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          SERIAL PRIMARY KEY,
  token_hash  TEXT UNIQUE NOT NULL,
  user_id     INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  family_id   UUID NOT NULL,
  device_hint TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user     ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family   ON refresh_tokens(family_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires  ON refresh_tokens(expires_at);

-- JTI blacklist for revoked access tokens (short-lived)
CREATE TABLE IF NOT EXISTS token_blacklist (
  jti        TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- PII columns on usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS email         TEXT,
  ADD COLUMN IF NOT EXISTS email_hash    TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_hash TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_enc  TEXT;

-- Unique constraint on email_hash (enforces one account per email)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuarios_email_hash_key'
  ) THEN
    ALTER TABLE usuarios ADD CONSTRAINT usuarios_email_hash_key UNIQUE (email_hash);
  END IF;
END $$;

-- Index for whatsapp_hash lookups
CREATE INDEX IF NOT EXISTS idx_usuarios_whatsapp_hash ON usuarios(whatsapp_hash);

-- Remove plaintext temp_password columns (already cleared by code)
ALTER TABLE usuarios DROP COLUMN IF EXISTS temp_password;
ALTER TABLE usuarios DROP COLUMN IF EXISTS temp_password_expires;
```

- [ ] **Step 2: Apply migration to running DB**

```bash
docker exec oguricap-postgres psql -U bot_user -d oguribot \
  -f /dev/stdin < /home/OguriCap-Bot/database/migrations/003_security_pii.sql
```

- [ ] **Step 3: Verify tables and columns**

```bash
docker exec oguricap-postgres psql -U bot_user -d oguribot -c \
  "\dt refresh_tokens; \dt token_blacklist; \d usuarios;" 2>/dev/null | grep -E "refresh_tokens|token_blacklist|email|whatsapp"
```

Expected: `refresh_tokens`, `token_blacklist` tables exist; `email`, `email_hash`, `whatsapp_hash`, `whatsapp_enc` columns visible on `usuarios`.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/003_security_pii.sql
git commit -m "feat(db): add refresh_tokens, token_blacklist, PII columns migration"
```

---

## Task 6: One-time data migration — normalize JIDs + encrypt PII

**Files:**
- Create: `database/migrations/migrate-pii.mjs`

- [ ] **Step 1: Create the migration script**

Create `/home/OguriCap-Bot/database/migrations/migrate-pii.mjs`:

```js
#!/usr/bin/env node
/**
 * One-time data migration:
 * 1. Normalize whatsapp_number: strip @s.whatsapp.net (16 users affected)
 * 2. Migrate email from metadata JSONB to dedicated column + encrypt + blind index
 * 3. Encrypt whatsapp_number → whatsapp_enc + compute whatsapp_hash
 */
import pg from 'pg'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dir, '../../.env') })

// Load crypto modules AFTER dotenv so env vars are set
const { encryptPII, blindIndex } = await import('../../lib/crypto/pii.js')

const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || 'oguribot',
  user: process.env.POSTGRES_USER || 'bot_user',
  password: process.env.POSTGRES_PASSWORD,
})

const DRY_RUN = process.argv.includes('--dry-run')
console.log(DRY_RUN ? '=== DRY RUN ===' : '=== LIVE MIGRATION ===')

async function run() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. Normalize JIDs: strip @s.whatsapp.net
    const { rows: jidRows } = await client.query(
      `SELECT id, username, whatsapp_number FROM usuarios WHERE whatsapp_number LIKE '%@%'`
    )
    console.log(`\nStep 1: Normalize JIDs — ${jidRows.length} users affected`)
    for (const row of jidRows) {
      const normalized = row.whatsapp_number.split('@')[0]
      console.log(`  [${row.id}] ${row.username}: "${row.whatsapp_number}" → "${normalized}"`)
      if (!DRY_RUN) {
        await client.query('UPDATE usuarios SET whatsapp_number = $1 WHERE id = $2', [normalized, row.id])
      }
    }

    // 2. Migrate email from metadata → column + encrypt + blind index
    const { rows: emailRows } = await client.query(
      `SELECT id, username, metadata FROM usuarios WHERE metadata->>'email' IS NOT NULL AND (email IS NULL OR email = '')`
    )
    console.log(`\nStep 2: Migrate email from metadata — ${emailRows.length} users`)
    for (const row of emailRows) {
      const emailPlain = row.metadata?.email
      if (!emailPlain) continue
      const enc = encryptPII(emailPlain)
      const hash = blindIndex(emailPlain)
      console.log(`  [${row.id}] ${row.username}: email="${emailPlain.slice(0,3)}***"`)
      if (!DRY_RUN) {
        // Remove email from metadata, write to column
        const newMeta = { ...row.metadata }
        delete newMeta.email
        await client.query(
          `UPDATE usuarios SET email = $1, email_hash = $2, metadata = $3::jsonb WHERE id = $4`,
          [enc, hash, JSON.stringify(newMeta), row.id]
        )
      }
    }

    // 3. Encrypt whatsapp_number for all users that have one and haven't been encrypted yet
    const { rows: waRows } = await client.query(
      `SELECT id, username, whatsapp_number FROM usuarios WHERE whatsapp_number IS NOT NULL AND whatsapp_enc IS NULL`
    )
    console.log(`\nStep 3: Encrypt whatsapp_number — ${waRows.length} users`)
    for (const row of waRows) {
      const enc = encryptPII(row.whatsapp_number)
      const hash = blindIndex(row.whatsapp_number)
      console.log(`  [${row.id}] ${row.username}: wa="${row.whatsapp_number.slice(0,4)}***"`)
      if (!DRY_RUN) {
        await client.query(
          `UPDATE usuarios SET whatsapp_enc = $1, whatsapp_hash = $2 WHERE id = $3`,
          [enc, hash, row.id]
        )
      }
    }

    if (!DRY_RUN) {
      await client.query('COMMIT')
      console.log('\n✅ Migration complete')
    } else {
      await client.query('ROLLBACK')
      console.log('\n✅ Dry run complete — no changes made')
    }
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

run()
```

- [ ] **Step 2: Run dry run first**

```bash
cd /home/OguriCap-Bot
node database/migrations/migrate-pii.mjs --dry-run
```

Expected: Shows 16 JID normalizations, 17 email migrations, and whatsapp encryptions with no changes made.

- [ ] **Step 3: Run live migration**

```bash
cd /home/OguriCap-Bot
node database/migrations/migrate-pii.mjs
```

Expected: "✅ Migration complete"

- [ ] **Step 4: Verify migration results**

```bash
docker exec oguricap-postgres psql -U bot_user -d oguribot -c \
  "SELECT COUNT(*) as jids_remaining FROM usuarios WHERE whatsapp_number LIKE '%@%';
   SELECT COUNT(*) as emails_in_metadata FROM usuarios WHERE metadata->>'email' IS NOT NULL;
   SELECT COUNT(*) as encrypted_wa FROM usuarios WHERE whatsapp_enc IS NOT NULL;
   SELECT COUNT(*) as encrypted_email FROM usuarios WHERE email IS NOT NULL;"
```

Expected: `jids_remaining=0`, `emails_in_metadata=0`, both encrypted counts > 0.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/migrate-pii.mjs
git commit -m "feat(db): one-time PII migration — normalize JIDs, encrypt email+whatsapp"
```

---

## Task 7: Update `api/lib/pg-usuarios.js` — decrypt on read, blind-index lookups

**Files:**
- Modify: `api/lib/pg-usuarios.js`

- [ ] **Step 1: Read the current file top to understand normalizeUser**

The current `normalizeUser` function is defined in `api/lib/pg-usuarios.js`. The imports section and `normalizeUser` need to be updated.

- [ ] **Step 2: Add PII imports and update normalizeUser**

At the top of `api/lib/pg-usuarios.js`, add after the first line:

```js
import { decryptPII, blindIndex } from '../../lib/crypto/pii.js'
```

Replace the existing `normalizeUser` function (find it — it's a small helper at the top of the file):

```js
function normalizeUser(row) {
  if (!row) return null
  const { email_hash, whatsapp_hash, ...rest } = row
  return {
    ...rest,
    // Transparently decrypt PII for callers — they receive plaintext
    email: decryptPII(row.email) ?? row.metadata?.email ?? null,
    whatsapp_number: decryptPII(row.whatsapp_enc) ?? row.whatsapp_number ?? null,
  }
}
```

- [ ] **Step 3: Update `pgFindUserByEmail` to use blind index**

Replace:
```js
export async function pgFindUserByEmail(email) {
  try {
    const { rows } = await pool().query(`SELECT * FROM usuarios WHERE metadata->>'email' = $1 LIMIT 1`, [email])
    return rows[0] ? normalizeUser(rows[0]) : null
  } catch { return null }
}
```

With:
```js
export async function pgFindUserByEmail(email) {
  try {
    const hash = blindIndex(String(email).toLowerCase().trim())
    const { rows } = await pool().query(
      `SELECT * FROM usuarios WHERE email_hash = $1 OR metadata->>'email' = $2 LIMIT 1`,
      [hash, email]
    )
    return rows[0] ? normalizeUser(rows[0]) : null
  } catch { return null }
}
```

- [ ] **Step 4: Add `pgFindUserByWhatsapp` (new function)**

After `pgFindUserByEmail`, add:

```js
export async function pgFindUserByWhatsapp(whatsappNumber) {
  try {
    const normalized = String(whatsappNumber).replace(/\D/g, '').replace(/^0+/, '')
    const hash = blindIndex(normalized)
    const { rows } = await pool().query(
      `SELECT * FROM usuarios WHERE whatsapp_hash = $1 OR whatsapp_number = $2 LIMIT 1`,
      [hash, normalized]
    )
    return rows[0] ? normalizeUser(rows[0]) : null
  } catch { return null }
}
```

- [ ] **Step 5: Update `pgUpdateUser` allowed fields**

In the `pgUpdateUser` function, extend the `allowed` array:

```js
const allowed = [
  'password', 'rol', 'activo', 'whatsapp_number', 'require_password_change',
  'email', 'email_hash', 'whatsapp_hash', 'whatsapp_enc',
]
```

(Remove `temp_password` and `temp_password_expires` — columns were dropped in Task 5.)

- [ ] **Step 6: Verify no runtime errors**

```bash
cd /home/OguriCap-Bot
node --input-type=module <<'EOF'
import { pgFindUser } from './api/lib/pg-usuarios.js'
console.log('import OK')
EOF
```

Expected: "import OK" (no error)

- [ ] **Step 7: Commit**

```bash
git add api/lib/pg-usuarios.js
git commit -m "feat(db): decrypt PII in normalizeUser, blind-index email/whatsapp lookups"
```

---

## Task 8: Update `api/routes/auth.js` — login issues access + refresh tokens

**Files:**
- Modify: `api/routes/auth.js`

- [ ] **Step 1: Replace `jwt` import with new helpers**

At the top of `api/routes/auth.js`, replace:
```js
import jwt from 'jsonwebtoken'
```
With:
```js
import { createAccessToken, createRefreshToken, ACCESS_TOKEN_SECONDS } from '../../lib/jwt/index.js'
```

Also remove `signJwt` from the destructured `core.js` import (it's no longer needed).

- [ ] **Step 2: Update login to issue new token pair**

Find the section in `handleAuth` login that currently does:
```js
const config = getConfig()
const jwtSecret = safeString(process.env.JWT_SECRET || config?.security?.jwtSecret || '').trim()
if (!jwtSecret) throw new Error('JWT_SECRET no configurado')
const token = jwt.sign({ username: user.username, rol: user.rol }, jwtSecret, { expiresIn: process.env.JWT_EXPIRY || config?.security?.jwtExpiry || '24h' })
```

Replace with:
```js
const { token, jti, expiresIn } = await createAccessToken({ username: user.username, rol: user.rol })
const { rawToken: refreshRaw, tokenHash: refreshHash } = createRefreshToken()

// Store refresh token in DB
const familyId = crypto.randomUUID()
const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const deviceHint = createHash('sha256').update(userAgent || '').digest('hex').slice(0, 16)
try {
  await db.pool.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, family_id, device_hint, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [refreshHash, user.id, familyId, deviceHint, refreshExpires]
  )
} catch {}

// Set refresh token as httpOnly cookie (7 days)
const isSecure = process.env.NODE_ENV === 'production'
const securePart = isSecure ? '; Secure' : ''
res.setHeader('Set-Cookie', [
  `auth_token=${token}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${ACCESS_TOKEN_SECONDS}`,
  `refresh_token=${refreshRaw}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/api/auth/refresh; Max-Age=${7 * 24 * 3600}`,
])
```

And update the json response to include `expiresIn`:
```js
json(res, 200, {
  token,
  expiresIn,
  user: { id: user.id, username: user.username, rol: user.rol, email: user.email || user.correo || null,
    last_login: user.last_login, require_password_change: user.require_password_change || false,
    isTemporaryPassword: !user.temp_password_used },
  message: user.require_password_change ? 'Se requiere cambio de contraseña' : undefined,
})
```

Also add these imports to auth.js (they're needed for the above code):
```js
import { createHash } from 'node:crypto'
```

(Note: `crypto` is already imported as `import crypto, { createHash } from 'node:crypto'` at line 2 — so `createHash` is already available.)

- [ ] **Step 3: Commit**

```bash
git add api/routes/auth.js
git commit -m "feat(auth): login issues jose access token + refresh token with DB storage"
```

---

## Task 9: Add `/api/auth/refresh` endpoint to `auth.js`

**Files:**
- Modify: `api/routes/auth.js`

- [ ] **Step 1: Add the refresh endpoint**

After the logout endpoint block (`if (pathname === '/api/auth/logout'...`), add:

```js
// ── POST /api/auth/refresh ─────────────────────────────────────────────────
if (pathname === '/api/auth/refresh' && method === 'POST') {
  // Parse refresh_token cookie
  const cookies = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  const rawRefresh = cookies['refresh_token']
  if (!rawRefresh) return json(res, 401, { error: 'Refresh token requerido' })

  const { hashRefreshToken, createAccessToken, createRefreshToken, ACCESS_TOKEN_SECONDS } =
    await import('../../lib/jwt/index.js')
  const tokenHash = hashRefreshToken(rawRefresh)

  let row
  try {
    const { rows } = await db.pool.query(
      `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1`,
      [tokenHash]
    )
    row = rows[0]
  } catch { return json(res, 500, { error: 'Error de base de datos' }) }

  if (!row) return json(res, 401, { error: 'Refresh token inválido o expirado' })

  // Detect token reuse (theft): if already used, revoke entire family
  if (row.used_at) {
    await db.pool.query('DELETE FROM refresh_tokens WHERE family_id = $1', [row.family_id]).catch(() => {})
    return json(res, 401, { error: 'Token reutilizado — sesión revocada por seguridad' })
  }

  // Mark current token as used
  await db.pool.query('UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1', [row.id]).catch(() => {})

  // Find user
  const { pgFindUserById } = await import('../lib/pg-usuarios.js')
  const user = await pgFindUserById(row.user_id)
  if (!user || !user.activo) return json(res, 401, { error: 'Usuario no válido' })

  // Issue new pair
  const { token, jti, expiresIn } = await createAccessToken({ username: user.username, rol: user.rol })
  const { rawToken: newRawRefresh, tokenHash: newRefreshHash } = createRefreshToken()

  const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db.pool.query(
    `INSERT INTO refresh_tokens (token_hash, user_id, family_id, device_hint, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [newRefreshHash, user.id, row.family_id, row.device_hint, newExpires]
  ).catch(() => {})

  // Cleanup expired blacklist entries lazily
  db.pool.query('DELETE FROM token_blacklist WHERE expires_at < NOW()').catch(() => {})

  const isSecure = process.env.NODE_ENV === 'production'
  res.setHeader('Set-Cookie', [
    `auth_token=${token}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${ACCESS_TOKEN_SECONDS}`,
    `refresh_token=${newRawRefresh}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/api/auth/refresh; Max-Age=${7 * 24 * 3600}`,
  ])

  return json(res, 200, { token, expiresIn })
}
```

- [ ] **Step 2: Update logout to revoke server-side**

Find the current logout block:
```js
if (pathname === '/api/auth/logout' && method === 'POST') {
  res.setHeader('Set-Cookie', 'auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0')
  return json(res, 200, { success: true })
}
```

Replace with:
```js
if (pathname === '/api/auth/logout' && method === 'POST') {
  // Parse cookies
  const cookies = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }

  // Revoke refresh token from DB
  const rawRefresh = cookies['refresh_token']
  if (rawRefresh && db?.pool) {
    const { hashRefreshToken } = await import('../../lib/jwt/index.js')
    const hash = hashRefreshToken(rawRefresh)
    await db.pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hash]).catch(() => {})
  }

  // Blacklist access token JTI (so it can't be used until it expires in 15min)
  const bearerToken = getBearerToken(req) || cookies['auth_token']
  if (bearerToken && db?.pool) {
    try {
      const { verifyAccessToken } = await import('../../lib/jwt/index.js')
      const payload = await verifyAccessToken(bearerToken)
      if (payload?.jti) {
        const expMs = (payload.exp || 0) * 1000
        await db.pool.query(
          'INSERT INTO token_blacklist (jti, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [payload.jti, new Date(expMs)]
        ).catch(() => {})
      }
    } catch {}
  }

  const isSecure = process.env.NODE_ENV === 'production'
  res.setHeader('Set-Cookie', [
    `auth_token=; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=0`,
    `refresh_token=; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/api/auth/refresh; Max-Age=0`,
  ])
  return json(res, 200, { success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add api/routes/auth.js
git commit -m "feat(auth): add /api/auth/refresh with rotation + /api/auth/logout revocation"
```

---

## Task 10: Update `api/middleware/core.js` — add JTI blacklist check

**Files:**
- Modify: `api/middleware/core.js`

- [ ] **Step 1: Update `getJwtAuth` to add blacklist check**

`core.js` already uses `jsonwebtoken` via `verifyJwt`. Just add the JTI blacklist check after successful verification. Find:

```js
export async function getJwtAuth(req) {
  const token = getBearerToken(req) || parseCookies(req)['auth_token'] || ''
  if (!token) return { ok: false, status: 401, error: 'Token requerido' }
  try {
    const decoded = verifyJwt(token)
    const username = decoded?.username
```

Replace with:

```js
export async function getJwtAuth(req) {
  const token = getBearerToken(req) || parseCookies(req)['auth_token'] || ''
  if (!token) return { ok: false, status: 401, error: 'Token requerido' }
  try {
    const decoded = verifyJwt(token)
    const username = decoded?.sub || decoded?.username

    // Check JTI blacklist for revoked tokens
    const jti = decoded?.jti
    if (jti && global.db?.pool) {
      try {
        const { rows } = await global.db.pool.query(
          'SELECT 1 FROM token_blacklist WHERE jti = $1 AND expires_at > NOW() LIMIT 1', [jti]
        )
        if (rows.length > 0) return { ok: false, status: 401, error: 'Token revocado' }
      } catch {}
    }
```

- [ ] **Step 2: Commit**

```bash
git add api/middleware/core.js
git commit -m "feat(auth): add JTI blacklist check in getJwtAuth"
```

---

## Task 11: Fix `plugins/panel-registro.js` — normalize JID before auto-register  

**Files:**
- Modify: `plugins/panel-registro.js`

- [ ] **Step 1: Find the whatsapp_number being sent**

Read around line 130 of `plugins/panel-registro.js` where `whatsapp_number: m.sender` is sent.

- [ ] **Step 2: Normalize the number before the fetch call**

Find:
```js
body: JSON.stringify({
  whatsapp_number: m.sender,
  username: username,
  grupo_jid: m.chat,
}),
```

Replace with:
```js
body: JSON.stringify({
  whatsapp_number: String(m.sender || '').split('@')[0].replace(/\D/g, '').replace(/^0+/, ''),
  username: username,
  grupo_jid: m.chat,
}),
```

- [ ] **Step 3: Commit**

```bash
git add plugins/panel-registro.js
git commit -m "fix(plugin): normalize WhatsApp JID to number before auto-register"
```

---

## Task 12: Frontend `api.ts` — refresh interceptor on 401

**Files:**
- Modify: `frontend-next/src/services/api.ts`

- [ ] **Step 1: Add refresh state and interceptor**

In `api.ts`, inside the `ApiService` class constructor, find the response error interceptor:

```typescript
// Auth: hard fail -> logout
if ((status === 401 || status === 403) && typeof window !== 'undefined') {
  const msg = error?.response?.data?.error || ''
  if (status === 401 || msg === 'Token inválido') {
    localStorage.removeItem('token')
    try {
      const secure = window.location.protocol === 'https:' ? '; Secure' : ''
      document.cookie = `token=; Path=/; Max-Age=0; SameSite=Lax${secure}`
    } catch {}
    if (window.location.pathname !== '/login') window.location.href = '/login'
    return Promise.reject(error)
  }
}
```

Replace with:

```typescript
// Auth: try refresh on 401, hard fail on 403
if (status === 401 && typeof window !== 'undefined' && !(config as any).__isRefresh) {
  // Attempt silent refresh
  try {
    const refreshRes = await this.api.post(
      '/api/auth/refresh',
      {},
      { withCredentials: true, __isRefresh: true } as any
    )
    const newToken = refreshRes.data?.token
    if (newToken) {
      localStorage.setItem('token', newToken)
      config.headers = config.headers || {}
      config.headers['Authorization'] = `Bearer ${newToken}`
      return this.api.request(config)
    }
  } catch {
    // Refresh failed — clear and redirect
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (window.location.pathname !== '/login') window.location.href = '/login'
    return Promise.reject(error)
  }
}
if (status === 403 && typeof window !== 'undefined') {
  const msg = error?.response?.data?.error || ''
  if (msg === 'Token inválido' || msg === 'Token revocado') {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    if (window.location.pathname !== '/login') window.location.href = '/login'
    return Promise.reject(error)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-next/src/services/api.ts
git commit -m "feat(frontend): add silent token refresh on 401 via /api/auth/refresh"
```

---

## Task 13: Frontend `AuthContext.tsx` — server logout

**Files:**
- Modify: `frontend-next/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Update logout to call server**

Find the `logout` function:
```typescript
const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  clearTokenCookie();
  setToken(null);
  setUser(null);
  notify.success('Sesión cerrada correctamente');
};
```

Replace with:
```typescript
const logout = async () => {
  // Revoke refresh token server-side (fire-and-forget)
  const currentToken = token || localStorage.getItem('token')
  fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
    headers: currentToken ? { Authorization: `Bearer ${currentToken}` } : {},
  }).catch(() => {})

  localStorage.removeItem('token')
  localStorage.removeItem('user')
  clearTokenCookie()
  setToken(null)
  setUser(null)
  notify.success('Sesión cerrada correctamente')
}
```

Also update the `AuthContextType` interface to mark `logout` as potentially async:
```typescript
logout: () => void;
```
(Keep as `void` — we don't await it, fire-and-forget is fine.)

- [ ] **Step 2: Commit**

```bash
git add frontend-next/src/contexts/AuthContext.tsx
git commit -m "feat(frontend): logout calls /api/auth/logout to revoke refresh token"
```

---

## Task 14: Build and verify everything

- [ ] **Step 1: Run all tests**

```bash
cd /home/OguriCap-Bot
node --test test/crypto-keys.test.mjs test/crypto-pii.test.mjs test/jwt-helpers.test.mjs test/email-templates-new.test.mjs 2>&1 | tail -15
```

Expected: all pass, `# fail 0`

- [ ] **Step 2: Build frontend**

```bash
cd /home/OguriCap-Bot/frontend-next
npm run build 2>&1 | tail -20
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 3: Verify jose is resolved**

```bash
cd /home/OguriCap-Bot
node --input-type=module <<'EOF'
import { jwtVerify, SignJWT } from 'jose'
import { createAccessToken, verifyAccessToken } from './lib/jwt/index.js'
const { token } = await createAccessToken({ username: 'test', rol: 'usuario' })
const p = await verifyAccessToken(token)
console.log('JWT OK:', p.sub, p.rol)
EOF
```

Expected: `JWT OK: test usuario`

- [ ] **Step 4: Verify PII round-trip with real DB_ENCRYPTION_KEY**

```bash
cd /home/OguriCap-Bot
node --env-file=.env --input-type=module <<'EOF'
import { encryptPII, decryptPII, blindIndex } from './lib/crypto/pii.js'
const enc = encryptPII('test@example.com')
const dec = decryptPII(enc)
const idx = blindIndex('test@example.com')
console.log('PII OK:', dec === 'test@example.com', idx.length === 64)
EOF
```

Expected: `PII OK: true true`

- [ ] **Step 5: Final commit**

```bash
cd /home/OguriCap-Bot
git log --oneline -12
```

All tasks committed. Plan complete.
