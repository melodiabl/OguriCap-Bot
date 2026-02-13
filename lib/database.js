/**
 * Simple PostgreSQL Database
 * Uses pg directly - no complex drivers or adapters
 */

import fs from 'fs/promises'
import pkg from 'pg'
const { Pool } = pkg

const EXTRA_BLOB_KEY = '__oguri_extra'

function parseBoolean(value, fallback = false) {
  if (value == null) return fallback
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 't', 'yes', 'y', 'on', 'require', 'required'].includes(normalized)) return true
  if (['0', 'false', 'f', 'no', 'n', 'off'].includes(normalized)) return false
  return fallback
}

function parseInteger(value, fallback) {
  if (value == null) return fallback
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function inferSslFromConnectionString(connectionString) {
  if (!connectionString) return false
  const text = String(connectionString).toLowerCase()
  return text.includes('sslmode=require') || text.includes('ssl=true') || text.includes('ssl=1')
}

function parseJsonValue(value, fallback = {}) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function compactObject(obj) {
  const out = {}
  for (const [key, value] of Object.entries(obj || {})) {
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

class Database {
  constructor() {
    const databaseUrl =
      (process.env.DATABASE_URL || '').trim() ||
      (process.env.POSTGRES_URL || '').trim() ||
      (process.env.POSTGRES_URI || '').trim() ||
      (process.env.POSTGRES_CONNECTION_STRING || '').trim() ||
      null

    const max = parseInteger(process.env.POSTGRES_MAX_CONNECTIONS, 20)
    const connectionTimeoutMillis = parseInteger(process.env.DB_CONNECTION_TIMEOUT, undefined)
    const idleTimeoutMillis = parseInteger(process.env.DB_IDLE_TIMEOUT, undefined)

    const sslEnabled =
      process.env.POSTGRES_SSL != null
        ? parseBoolean(process.env.POSTGRES_SSL, false)
        : process.env.PGSSLMODE != null
          ? !['disable', 'disabled', 'off', 'false', '0'].includes(String(process.env.PGSSLMODE).trim().toLowerCase())
          : inferSslFromConnectionString(databaseUrl)
    const sslRejectUnauthorized = parseBoolean(process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED, true)

    const poolConfig = compactObject({
      ...(databaseUrl
        ? { connectionString: databaseUrl }
        : {
            host: process.env.PGHOST || process.env.POSTGRES_HOST || 'localhost',
            port: parseInteger(process.env.PGPORT || process.env.POSTGRES_PORT, 5432),
            database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'oguribot',
            user: process.env.PGUSER || process.env.POSTGRES_USER || 'bot_user',
            password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || 'melodia',
          }),
      max,
      connectionTimeoutMillis,
      idleTimeoutMillis,
      ssl: sslEnabled ? { rejectUnauthorized: sslRejectUnauthorized } : undefined,
    })

    this.pool = new Pool(poolConfig)

    this.data = {
      users: {},
      chats: {},
      settings: {},
      usuarios: {},
      panel: {},
      characters: {},
      aportes: [],
      aportesCounter: 0,
      config: {},
    }
  }

  async init() {
    console.log(' Connecting to PostgreSQL...')

    const client = await this.pool.connect()
    console.log(' PostgreSQL connected')
    client.release()

    await this.ensureSchema()

    await this.loadData()
    console.log(' Data loaded')
  }

  async ensureSchema() {
    const { rows } = await this.pool.query(`SELECT to_regclass('public.settings') AS reg`)
    const exists = Boolean(rows?.[0]?.reg)
    if (exists) return

    console.log(' Bootstrapping database schema...')

    const schemaUrl = new URL('../database/init/01-schema.sql', import.meta.url)
    const sql = await fs.readFile(schemaUrl, 'utf8')

    await this.pool.query(sql)

    console.log(' Schema ready')
  }

  async loadData() {
    // Load WhatsApp users
    const users = await this.pool.query('SELECT * FROM whatsapp_users')
    this.data.users = {}
    users.rows.forEach((user) => {
      try {
        const stats = parseJsonValue(user.stats, {})
        const settings = parseJsonValue(user.settings, {})
        const activity = parseJsonValue(user.activity, {})

        const merged = {
          name: user.name,
          ...stats,
          ...settings,
          ...activity,
        }

        // Normalizar claves snake_case -> camelCase (compat plugins)
        if (merged.afkReason == null && typeof merged.afk_reason === 'string') merged.afkReason = merged.afk_reason
        if (merged.afk_reason !== undefined) delete merged.afk_reason

        this.data.users[user.jid] = merged
      } catch (error) {
        console.warn(` Invalid JSON in user ${user.jid}, using defaults`)
        this.data.users[user.jid] = {
          name: user.name || user.jid.split('@')[0],
          exp: 0,
          coin: 0,
          level: 0,
          health: 100,
          premium: false,
          banned: false,
        }
      }
    })

    // Load chats
    const chats = await this.pool.query('SELECT * FROM chats')
    this.data.chats = {}
    chats.rows.forEach((chat) => {
      try {
        const settings = parseJsonValue(chat.settings, {})
        const messages = parseJsonValue(chat.messages, {})
        const messageSettings = parseJsonValue(chat.message_settings, {})

        const merged = {
          ...settings,
        }

        // Compat schema (snake_case) -> memoria (camelCase)
        if (merged.isBanned == null && typeof merged.is_banned === 'boolean') merged.isBanned = merged.is_banned
        if (merged.is_banned !== undefined) delete merged.is_banned

        // Mensajes/flags de bienvenida
        if (merged.sWelcome == null && typeof messages?.welcome === 'string') merged.sWelcome = messages.welcome
        if (merged.sBye == null && typeof messages?.bye === 'string') merged.sBye = messages.bye
        if (merged.welcome == null && typeof messageSettings?.s_welcome === 'boolean') merged.welcome = messageSettings.s_welcome

        this.data.chats[chat.jid] = merged
      } catch (error) {
        console.warn(`Invalid JSON in chat ${chat.jid}, using defaults`)
        this.data.chats[chat.jid] = {
          isBanned: false,
          antilink: false,
          welcome: false,
        }
      }
    })

    // Load settings
    const settings = await this.pool.query('SELECT * FROM settings')
    this.data.settings = {}
    settings.rows.forEach((setting) => {
      if (setting.value != null && typeof setting.value === 'object') {
        this.data.settings[setting.key_name] = setting.value
        return
      }
      const parsed = parseJsonValue(setting.value, null)
      if (parsed === null) {
        console.warn(` Setting '${setting.key_name}' is not valid JSON, storing as string`)
        this.data.settings[setting.key_name] = setting.value
      } else {
        this.data.settings[setting.key_name] = parsed
      }
    })

    // Cargar data extra (panel, characters, config, etc.) desde settings
    try {
      const extraRaw = this.data.settings?.[EXTRA_BLOB_KEY]
      const extra = parseJsonValue(extraRaw, null)
      if (extra && typeof extra === 'object') {
        for (const [key, value] of Object.entries(extra)) {
          if (key === 'users' || key === 'chats' || key === 'settings' || key === 'usuarios') continue
          this.data[key] = value
        }
      }
      if (this.data.settings && EXTRA_BLOB_KEY in this.data.settings) delete this.data.settings[EXTRA_BLOB_KEY]
    } catch {}

    // Load panel users (JWT/Panel)
    const usuarios = await this.pool.query('SELECT * FROM usuarios')
    this.data.usuarios = {}
    usuarios.rows.forEach((usuario) => {
      try {
        const metadata = parseJsonValue(usuario.metadata, {})
        this.data.usuarios[usuario.id] = {
          id: usuario.id,
          username: usuario.username,
          password: usuario.password,
          rol: usuario.rol,
          whatsapp_number: usuario.whatsapp_number,
          fecha_registro: usuario.fecha_registro,
          activo: usuario.activo,
          temp_password: usuario.temp_password,
          temp_password_expires: usuario.temp_password_expires,
          require_password_change: usuario.require_password_change,
          last_login: usuario.last_login,
          login_ip: usuario.login_ip,
          created_at: usuario.created_at,
          updated_at: usuario.updated_at,
          ...metadata,
        }
      } catch (error) {
        console.warn(` Invalid JSON in usuario ${usuario.username}, using defaults`)
        this.data.usuarios[usuario.id] = {
          id: usuario.id,
          username: usuario.username,
          password: usuario.password,
          rol: usuario.rol,
          whatsapp_number: usuario.whatsapp_number,
          fecha_registro: usuario.fecha_registro,
          activo: usuario.activo,
          temp_password: usuario.temp_password,
          temp_password_expires: usuario.temp_password_expires,
          require_password_change: usuario.require_password_change,
          last_login: usuario.last_login,
          login_ip: usuario.login_ip,
          created_at: usuario.created_at,
          updated_at: usuario.updated_at,
        }
      }
    })

    console.log(` Users: ${Object.keys(this.data.users).length}`)
    console.log(` Chats: ${Object.keys(this.data.chats).length}`)
    console.log(` Settings: ${Object.keys(this.data.settings).length}`)
    console.log(` Panel Users: ${Object.keys(this.data.usuarios).length}`)
  }

  async saveData() {
    // Save WhatsApp users
    for (const [jid, userData] of Object.entries(this.data.users)) {
      const statsPayload = {
        exp: isFiniteNumber(userData.exp) ? userData.exp : 0,
        coin: isFiniteNumber(userData.coin) ? userData.coin : 0,
        bank: isFiniteNumber(userData.bank) ? userData.bank : 0,
        level: isFiniteNumber(userData.level) ? userData.level : 0,
        health: isFiniteNumber(userData.health) ? userData.health : 100,
      }

      const afkReason =
        typeof userData.afkReason === 'string'
          ? userData.afkReason
          : typeof userData.afk_reason === 'string'
            ? userData.afk_reason
            : ''

      const activityPayload = compactObject({
        commands: isFiniteNumber(userData.commands) ? userData.commands : 0,
        afk: isFiniteNumber(userData.afk) ? userData.afk : -1,
        afk_reason: afkReason,
        lastSeen: userData.lastSeen,
        messageCount: userData.messageCount,
        commandCount: userData.commandCount,
      })

      const omitKeys = new Set([
        'name',
        ...Object.keys(statsPayload),
        'commands',
        'afk',
        'afkReason',
        'afk_reason',
        'lastSeen',
        'messageCount',
        'commandCount',
      ])
      const settingsPayload = {}
      for (const [key, value] of Object.entries(userData || {})) {
        if (omitKeys.has(key)) continue
        if (value === undefined) continue
        settingsPayload[key] = value
      }

      // Asegurar flags comunes aunque no existan en memoria aún
      if (settingsPayload.premium == null) settingsPayload.premium = Boolean(userData.premium)
      if (settingsPayload.banned == null) settingsPayload.banned = Boolean(userData.banned)
      if (settingsPayload.warn == null) settingsPayload.warn = isFiniteNumber(userData.warn) ? userData.warn : 0

      const stats = JSON.stringify(statsPayload)
      const settings = JSON.stringify(settingsPayload)
      const activity = JSON.stringify(activityPayload)

      await this.pool.query(
        `
        INSERT INTO whatsapp_users (jid, name, stats, settings, activity)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (jid) DO UPDATE SET
          name = EXCLUDED.name,
          stats = EXCLUDED.stats,
          settings = EXCLUDED.settings,
          activity = EXCLUDED.activity,
          updated_at = CURRENT_TIMESTAMP
        `,
        [jid, userData.name || jid.split('@')[0], stats, settings, activity]
      )
    }

    // Save chats
    for (const [jid, chatData] of Object.entries(this.data.chats)) {
      const settingsPayload = { ...(chatData || {}) }
      delete settingsPayload.settings
      delete settingsPayload.messages
      delete settingsPayload.message_settings

      // Compat: reflejar snake_case útil para queries/index si existe el valor camelCase
      if (typeof settingsPayload.isBanned === 'boolean' && settingsPayload.is_banned == null) {
        settingsPayload.is_banned = settingsPayload.isBanned
      }

      const messagesPayload = isPlainObject(chatData?.messages) ? { ...chatData.messages } : {}
      if (typeof chatData?.sWelcome === 'string') messagesPayload.welcome = chatData.sWelcome
      if (typeof chatData?.sBye === 'string') messagesPayload.bye = chatData.sBye

      const messageSettingsPayload = isPlainObject(chatData?.message_settings) ? { ...chatData.message_settings } : {}
      if (typeof chatData?.welcome === 'boolean') messageSettingsPayload.s_welcome = chatData.welcome
      if (messageSettingsPayload.s_bye == null) {
        const hasByeText = typeof chatData?.sBye === 'string' && chatData.sBye.trim().length > 0
        messageSettingsPayload.s_bye = Boolean(chatData?.welcome) || hasByeText
      }

      await this.pool.query(
        `
        INSERT INTO chats (jid, settings, messages, message_settings)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (jid) DO UPDATE SET
          settings = EXCLUDED.settings,
          messages = EXCLUDED.messages,
          message_settings = EXCLUDED.message_settings,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          jid,
          JSON.stringify(settingsPayload),
          JSON.stringify(messagesPayload),
          JSON.stringify(messageSettingsPayload),
        ]
      )
    }

    // Save settings (ensure valid JSON)
    for (const [key, value] of Object.entries(this.data.settings)) {
      let jsonValue
      try {
        if (typeof value === 'string') {
          JSON.parse(value)
          jsonValue = value
        } else {
          jsonValue = JSON.stringify(value)
        }
      } catch {
        jsonValue = JSON.stringify(value)
      }

      await this.pool.query(
        `
        INSERT INTO settings (key_name, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key_name) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
        `,
        [key, jsonValue, `Bot setting: ${key}`]
      )
    }

    // Persistir "data extra" (panel, characters, config, etc.) en settings (JSONB)
    try {
      const extras = {}
      for (const [key, value] of Object.entries(this.data || {})) {
        if (key === 'users' || key === 'chats' || key === 'settings' || key === 'usuarios') continue
        if (value === undefined) continue
        extras[key] = value
      }

      await this.pool.query(
        `
        INSERT INTO settings (key_name, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key_name) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
        `,
        [EXTRA_BLOB_KEY, JSON.stringify(extras), 'Internal bot state (panel/characters/config/etc.)']
      )
    } catch (err) {
      console.warn(' Warning: could not persist extra bot state:', err?.message || err)
    }

    // Save panel users (JWT/Panel)
    const usuarioEntries = Object.entries(this.data.usuarios || {})
    const knownColumns = new Set([
      'id',
      'username',
      'password',
      'rol',
      'whatsapp_number',
      'fecha_registro',
      'activo',
      'temp_password',
      'temp_password_expires',
      'require_password_change',
      'last_login',
      'login_ip',
      'created_at',
      'updated_at',
    ])

    for (const [key, usuario] of usuarioEntries) {
      const username = usuario?.username
      if (!username) continue

      const parsedId = Number.parseInt(String(usuario?.id ?? key), 10)
      const id = Number.isFinite(parsedId) ? parsedId : null

      const metadata = {}
      for (const [field, fieldValue] of Object.entries(usuario || {})) {
        if (knownColumns.has(field)) continue
        if (fieldValue === undefined) continue
        metadata[field] = fieldValue
      }

      const fechaRegistro = usuario?.fecha_registro || usuario?.created_at || new Date().toISOString()

      const result = await this.pool.query(
        `
        INSERT INTO usuarios (
          id, username, password, rol, whatsapp_number, fecha_registro, activo,
          temp_password, temp_password_expires, require_password_change,
          last_login, login_ip, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13::jsonb
        )
        ON CONFLICT (username) DO UPDATE SET
          password = EXCLUDED.password,
          rol = EXCLUDED.rol,
          whatsapp_number = EXCLUDED.whatsapp_number,
          activo = EXCLUDED.activo,
          temp_password = EXCLUDED.temp_password,
          temp_password_expires = EXCLUDED.temp_password_expires,
          require_password_change = EXCLUDED.require_password_change,
          last_login = EXCLUDED.last_login,
          login_ip = EXCLUDED.login_ip,
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id
        `,
        [
          id,
          username,
          usuario?.password || '',
          usuario?.rol || 'usuario',
          usuario?.whatsapp_number ?? null,
          fechaRegistro,
          usuario?.activo ?? true,
          usuario?.temp_password ?? null,
          usuario?.temp_password_expires ?? null,
          usuario?.require_password_change ?? false,
          usuario?.last_login ?? null,
          usuario?.login_ip ?? null,
          JSON.stringify(metadata),
        ]
      )

      const returnedId = result?.rows?.[0]?.id
      if (returnedId && usuario?.id !== returnedId) {
        usuario.id = returnedId
        if (String(key) !== String(returnedId)) {
          delete this.data.usuarios[key]
          this.data.usuarios[returnedId] = usuario
        }
      }
    }

    console.log(' Data saved successfully')
  }

  // LowDB compatibility
  async read() {
    await this.loadData()
    return this.data
  }

  async write() {
    await this.saveData()
    return this.data
  }
}

const db = new Database();
export default db;
