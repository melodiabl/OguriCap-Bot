import 'dotenv/config'
import pg from 'pg'

const required = [
  'JWT_SECRET',
  'DB_ENCRYPTION_KEY',
  'INTERNAL_BOT_SECRET',
  'PANEL_ADMIN_USER',
  'PANEL_ADMIN_PASS',
  'POSTGRES_PASSWORD',
]

const invalid = required.filter((key) => {
  const value = String(process.env[key] || '').trim()
  return !value || value.startsWith('CHANGE_ME') || value.startsWith('your-')
})

if (invalid.length) {
  console.error(`Configuración incompleta: ${invalid.join(', ')}`)
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.DATABASE_URL ? undefined : (process.env.POSTGRES_HOST || '127.0.0.1'),
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || 'oguribot',
  user: process.env.POSTGRES_USER || 'bot_user',
  password: process.env.POSTGRES_PASSWORD,
  ssl: process.env.DATABASE_URL && process.env.POSTGRES_SSL === 'true'
    ? { rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false' }
    : false,
})

try {
  await pool.query('SELECT 1')
  console.log('Configuración válida y PostgreSQL disponible.')
} catch (error) {
  console.error(`No se pudo conectar a PostgreSQL: ${error.message}`)
  process.exitCode = 1
} finally {
  await pool.end()
}
