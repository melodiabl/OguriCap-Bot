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
const { encryptPII, blindIndex } = await import('../../api/crypto/pii.js')

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
        await client.query(
          'UPDATE usuarios SET whatsapp_number = $1, whatsapp_enc = NULL, whatsapp_hash = NULL WHERE id = $2',
          [normalized, row.id]
        )
      }
    }

    // 2. Migrate email from metadata → column + encrypt + blind index
    const { rows: emailRows } = await client.query(
      `SELECT id, username, metadata FROM usuarios WHERE metadata->>'email' IS NOT NULL AND metadata->>'email' != 'null' AND (email IS NULL OR email = '')`
    )
    console.log(`\nStep 2: Migrate email from metadata — ${emailRows.length} users`)

    // Pre-flight: detect duplicate emails to avoid mid-migration constraint violation
    const { rows: dupRows } = await client.query(
      `SELECT metadata->>'email' AS email, COUNT(*)
       FROM usuarios
       WHERE metadata->>'email' IS NOT NULL AND (email IS NULL OR email = '')
       GROUP BY 1 HAVING COUNT(*) > 1`
    )
    if (dupRows.length > 0) {
      console.error('❌ Duplicate emails in metadata would violate unique constraint:')
      for (const dup of dupRows) console.error(`  "${dup.email}" — ${dup.count} users`)
      await client.query('ROLLBACK')
      await pool.end()
      process.exit(1)
    }

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

    // Step 3 intentionally runs after Step 1: the SELECT reads in-transaction updated rows,
    // ensuring whatsapp_number values are already JID-normalized before encryption.
    // 3. Encrypt whatsapp_number for all users that have one and haven't been encrypted yet
    const { rows: waRows } = await client.query(
      `SELECT id, username, whatsapp_number FROM usuarios WHERE whatsapp_number IS NOT NULL AND whatsapp_number != '' AND whatsapp_enc IS NULL`
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

run().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1) })
