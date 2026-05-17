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
