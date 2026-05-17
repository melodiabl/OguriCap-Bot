# DB Audit + JWT/Crypto Security — Design Spec
**Date:** 2026-05-17  
**Status:** Approved

---

## 1. Context

Audit of the live PostgreSQL database revealed three categories of issues:

1. **Data format inconsistency:** 16 of 35 users have `whatsapp_number` stored as full WhatsApp JID (`573127476432@s.whatsapp.net`) instead of normalized number only. Origin: `panel-registro.js` passes `m.sender` (JID format) directly to the API without normalization.

2. **Email in wrong place:** 17 users have email stored in `metadata JSONB` (`metadata->>'email'`) with no uniqueness constraint or dedicated index. Lookup by email requires a JSONB expression query.

3. **JWT architecture:** Single 24h access token, no refresh mechanism, no revocation. `jsonwebtoken` library is unmaintained compared to `jose`. PII (email, whatsapp) stored in plaintext.

---

## 2. JWT Architecture (jose + Access/Refresh)

**Library migration:** Replace `jsonwebtoken` with `jose` (JOSE RFC compliant, zero dependencies, actively maintained by Cloudflare).

### Token flow

| Token | Type | Duration | Storage |
|---|---|---|---|
| Access | HS256 JWT | 15 min | Response body + httpOnly cookie |
| Refresh | Opaque 48-byte | 7 days | httpOnly cookie only |

**Access token payload:**
```json
{ "sub": "username", "rol": "usuario", "jti": "<uuid-v4>", "iat": ..., "exp": ... }
```

**Refresh token storage:**
- Client: httpOnly Secure SameSite=Strict cookie `refresh_token`
- Server: SHA-256 hash stored in `refresh_tokens` table with `family_id`, `expires_at`, `used_at`

**Rotation:** Every `/api/auth/refresh` call:
1. Looks up refresh token hash in DB
2. If `used_at != null` → token already consumed → revoke entire family → 401
3. Marks token as used, issues new access + refresh token pair
4. Stores new refresh token hash (same `family_id`)

**Revocation on logout:**
1. Delete refresh token row from DB
2. Insert access token's `jti` into `token_blacklist` with `expires_at = now() + 15 minutes`
3. Clear both cookies

**`verifyAccessToken`** (in middleware):
1. Verify HS256 signature + expiry (no DB call)
2. Check `jti` not in `token_blacklist` (O(1) PK lookup)

### New/modified endpoints

| Endpoint | Change |
|---|---|
| `POST /api/auth/login` | Issues access + refresh tokens, sets both cookies |
| `POST /api/auth/refresh` | Rotates refresh token, issues new access token |
| `POST /api/auth/logout` | Revokes refresh token, blacklists JTI, clears cookies |
| `GET /api/auth/verify` | Validates access token + blacklist check |

---

## 3. Database Changes

### Migration `003_security_pii.sql`

```sql
-- Refresh token storage
CREATE TABLE refresh_tokens (
  id          SERIAL PRIMARY KEY,
  token_hash  TEXT UNIQUE NOT NULL,
  user_id     INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
  family_id   UUID NOT NULL,
  device_hint TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- JTI blacklist (short-lived, TTL = access token duration)
CREATE TABLE token_blacklist (
  jti        TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_token_blacklist_expires ON token_blacklist(expires_at);

-- PII columns on usuarios
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS email         TEXT,
  ADD COLUMN IF NOT EXISTS email_hash    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS whatsapp_hash TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_enc  TEXT;

-- Remove plaintext temp_password columns
ALTER TABLE usuarios DROP COLUMN IF EXISTS temp_password;
ALTER TABLE usuarios DROP COLUMN IF EXISTS temp_password_expires;
```

### Data migration script (Node.js, run once)

1. **Normalize JID format:** `UPDATE usuarios SET whatsapp_number = SPLIT_PART(whatsapp_number, '@', 1) WHERE whatsapp_number LIKE '%@%'` — fixes 16 users.

2. **Migrate email from metadata:** For each user with `metadata->>'email'`, compute `email_hash = HMAC-SHA256(hmacKey, email.toLowerCase())`, encrypt email with AES-256-GCM, write to `email` and `email_hash` columns, remove `email` key from metadata.

3. **Encrypt whatsapp_number:** For each user with `whatsapp_number`, encrypt it → `whatsapp_enc`, compute `whatsapp_hash`, set `whatsapp_number = null` (remove plaintext after validation).

4. **Validate:** Run queries to confirm 0 rows with `whatsapp_number LIKE '%@%'` and 0 rows with `metadata->>'email' IS NOT NULL`.

### Plugin fix

`plugins/panel-registro.js`: Apply `normalizeWhatsAppNumber(m.sender)` before sending to `/api/auth/auto-register`. Same for any other plugin that writes `whatsapp_number`.

---

## 4. Cryptography

### Key derivation — `lib/crypto/keys.js`

Use Node.js built-in `crypto.hkdfSync` to derive purpose-specific keys from a single master key (`DB_ENCRYPTION_KEY`):

```js
// HKDF with SHA-256
encryptionKey = hkdfSync('sha256', masterKey, salt='', 'pii-encryption', 32)
hmacKey       = hkdfSync('sha256', masterKey, salt='', 'blind-index', 32)
```

- Old `lib/password-crypto.js` used `SHA256(secret)` as key — weak (no salt, single-purpose key).
- New approach: one master key, purpose-separated derived keys.
- `DB_ENCRYPTION_KEY` must be 32+ bytes. Generated with `openssl rand -hex 32`.

### PII encryption — `lib/crypto/pii.js`

```
encryptPII(plaintext) → "v2:<iv_b64>:<ct_b64>:<tag_b64>"
decryptPII(payload)   → plaintext | null
blindIndex(plaintext) → hex string (for DB lookup)
```

- Algorithm: AES-256-GCM, 12-byte random IV, 16-byte auth tag
- Format prefix `v2:` distinguishes from old `v1:` password_enc format
- `blindIndex` uses HMAC-SHA256 with the dedicated hmacKey
- Input is normalized before hashing: `value.toLowerCase().trim()`

### JWT — `lib/jwt/index.js`

```js
// Uses jose
createAccessToken({ username, rol }) → { token, jti }
createRefreshToken()                 → { rawToken, tokenHash } // hash stored in DB
verifyAccessToken(token)             → { username, rol, jti } | throws
```

- Algorithm: HS256
- `jti`: UUID v4 (crypto.randomUUID())
- Blacklist check: `SELECT 1 FROM token_blacklist WHERE jti = $1 AND expires_at > NOW()`

### Updated `pgUpdateUser` allowed fields

Add `email`, `email_hash`, `whatsapp_hash`, `whatsapp_enc` to the allowed list in `pg-usuarios.js`.

---

## 5. New Environment Variables

```bash
# Master key for PII encryption (generate with: openssl rand -hex 32)
DB_ENCRYPTION_KEY="<32-byte-hex>"
```

`JWT_SECRET` already exists — used unchanged as the HS256 signing key for `jose`.

---

## 6. Backward Compatibility

- `getJwtAuth` will accept both old 24h tokens (until they expire naturally) and new 15min tokens, checking the blacklist for both.
- After 24h, all old tokens expire naturally. No forced logout.
- Frontend: after receiving 401 on an expired access token, it calls `/api/auth/refresh` automatically. If refresh also fails (expired or revoked), it redirects to login.

---

## 7. Files Modified / Created

| File | Action |
|---|---|
| `lib/crypto/keys.js` | NEW — HKDF key derivation |
| `lib/crypto/pii.js` | NEW — PII encrypt/decrypt/blindIndex |
| `lib/jwt/index.js` | NEW — jose-based JWT helpers |
| `lib/password-crypto.js` | KEEP — still needed for v1 password_enc display |
| `api/middleware/core.js` | UPDATE — use new verifyAccessToken, cookie handling |
| `api/routes/auth.js` | UPDATE — login/refresh/logout endpoints, new token flow |
| `api/lib/pg-usuarios.js` | UPDATE — email/hash fields, normalized whatsapp lookup |
| `database/init/03-security-pii.sql` | NEW — schema migration |
| `database/migrations/migrate-pii.mjs` | NEW — one-time data migration script |
| `plugins/panel-registro.js` | FIX — normalize whatsapp JID before auto-register |
| `package.json` | UPDATE — add `jose`, remove `jsonwebtoken` |
| `.env.example` | UPDATE — add DB_ENCRYPTION_KEY |

---

## 8. Out of Scope

- Argon2id for password hashing (bcrypt cost=10 is sufficient for now)
- Asymmetric JWT (RS256) — HS256 is adequate for single-server deployment
- Encryption of `password_enc` in metadata — it's already AES-256-GCM encrypted
