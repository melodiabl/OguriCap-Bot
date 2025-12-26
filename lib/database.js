/**
 * Simple PostgreSQL Database
 * Uses pg directly - no complex drivers or adapters
 */

import pkg from 'pg'
const { Pool } = pkg

class Database {
  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB || 'oguribot',
      user: process.env.POSTGRES_USER || 'bot_user',
      password: process.env.POSTGRES_PASSWORD || 'melodia',
      max: 20,
    })

    this.data = {
      users: {},
      chats: {},
      settings: {},
      usuarios: {},
    }
  }

  async init() {
    console.log('ÐY"" Connecting to PostgreSQL...')

    const client = await this.pool.connect()
    console.log('ƒo. PostgreSQL connected')
    client.release()

    await this.loadData()
    console.log('ƒo. Data loaded')
  }

  async loadData() {
    // Load WhatsApp users
    const users = await this.pool.query('SELECT * FROM whatsapp_users')
    this.data.users = {}
    users.rows.forEach((user) => {
      try {
        this.data.users[user.jid] = {
          name: user.name,
          ...JSON.parse(user.stats || '{}'),
          ...JSON.parse(user.settings || '{}'),
          ...JSON.parse(user.activity || '{}'),
        }
      } catch (error) {
        console.warn(`ƒsÿ‹÷? Invalid JSON in user ${user.jid}, using defaults`)
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
        this.data.chats[chat.jid] = {
          ...JSON.parse(chat.settings || '{}'),
          ...JSON.parse(chat.messages || '{}'),
          ...JSON.parse(chat.message_settings || '{}'),
        }
      } catch (error) {
        console.warn(`ƒsÿ‹÷? Invalid JSON in chat ${chat.jid}, using defaults`)
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
      try {
        this.data.settings[setting.key_name] = JSON.parse(setting.value)
      } catch (error) {
        console.warn(`ƒsÿ‹÷? Setting '${setting.key_name}' is not valid JSON, storing as string`)
        this.data.settings[setting.key_name] = setting.value
      }
    })

    // Load panel users (JWT/Panel)
    const usuarios = await this.pool.query('SELECT * FROM usuarios')
    this.data.usuarios = {}
    usuarios.rows.forEach((usuario) => {
      try {
        const metadata = JSON.parse(usuario.metadata || '{}')
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
        console.warn(`ƒsÿ‹÷? Invalid JSON in usuario ${usuario.username}, using defaults`)
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

    console.log(`ÐY'¾ Users: ${Object.keys(this.data.users).length}`)
    console.log(`ÐY'ª Chats: ${Object.keys(this.data.chats).length}`)
    console.log(`ƒsT‹÷? Settings: ${Object.keys(this.data.settings).length}`)
    console.log(`ÐY"? Panel Users: ${Object.keys(this.data.usuarios).length}`)
  }

  async saveData() {
    // Save WhatsApp users
    for (const [jid, userData] of Object.entries(this.data.users)) {
      const stats = JSON.stringify({
        exp: userData.exp || 0,
        coin: userData.coin || 0,
        bank: userData.bank || 0,
        level: userData.level || 0,
        health: userData.health || 100,
      })

      const settings = JSON.stringify({
        premium: userData.premium || false,
        banned: userData.banned || false,
        warn: userData.warn || 0,
      })

      const activity = JSON.stringify({
        commands: userData.commands || 0,
        afk: userData.afk || -1,
        afk_reason: userData.afkReason || '',
      })

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
          JSON.stringify(chatData.settings || {}),
          JSON.stringify(chatData.messages || {}),
          JSON.stringify(chatData.message_settings || {}),
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

    console.log('ƒo. Data saved successfully')
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

export default Database

