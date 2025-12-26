/**
 * Simple PostgreSQL Database
 * Uses pg directly - no complex drivers or adapters
 */

import pkg from 'pg';
const { Pool } = pkg;

class Database {
  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      database: process.env.POSTGRES_DB || 'oguribot',
      user: process.env.POSTGRES_USER || 'bot_user',
      password: process.env.POSTGRES_PASSWORD || 'melodia',
      max: 20,
    });

    this.data = {
      users: {},
      chats: {},
      settings: {},
      usuarios: {},
    };
  }

  async init() {
    console.log('🔄 Connecting to PostgreSQL...');
    
    // Test connection
    const client = await this.pool.connect();
    console.log('✅ PostgreSQL connected');
    client.release();
    
    // Load data
    await this.loadData();
    console.log('✅ Data loaded');
  }

  async loadData() {
    // Load users
    const users = await this.pool.query('SELECT * FROM whatsapp_users');
    this.data.users = {};
    users.rows.forEach(user => {
      try {
        this.data.users[user.jid] = {
          name: user.name,
          ...JSON.parse(user.stats || '{}'),
          ...JSON.parse(user.settings || '{}'),
          ...JSON.parse(user.activity || '{}')
        };
      } catch (error) {
        console.warn(`⚠️ Invalid JSON in user ${user.jid}, using defaults`);
        this.data.users[user.jid] = {
          name: user.name || user.jid.split('@')[0],
          exp: 0,
          coin: 0,
          level: 0,
          health: 100,
          premium: false,
          banned: false
        };
      }
    });

    // Load chats
    const chats = await this.pool.query('SELECT * FROM chats');
    this.data.chats = {};
    chats.rows.forEach(chat => {
      try {
        this.data.chats[chat.jid] = {
          ...JSON.parse(chat.settings || '{}'),
          ...JSON.parse(chat.messages || '{}'),
          ...JSON.parse(chat.message_settings || '{}')
        };
      } catch (error) {
        console.warn(`⚠️ Invalid JSON in chat ${chat.jid}, using defaults`);
        this.data.chats[chat.jid] = {
          isBanned: false,
          antilink: false,
          welcome: false
        };
      }
    });

    // Load settings
    const settings = await this.pool.query('SELECT * FROM settings');
    this.data.settings = {};
    settings.rows.forEach(setting => {
      try {
        // Try to parse as JSON
        this.data.settings[setting.key_name] = JSON.parse(setting.value);
      } catch (error) {
        // If not valid JSON, store as string
        console.warn(`⚠️ Setting '${setting.key_name}' is not valid JSON, storing as string`);
        this.data.settings[setting.key_name] = setting.value;
      }
    });

    // Load panel users
    const usuarios = await this.pool.query('SELECT * FROM usuarios');
    this.data.usuarios = {};
    usuarios.rows.forEach(usuario => {
      try {
        this.data.usuarios[usuario.id] = {
          username: usuario.username,
          password: usuario.password,
          rol: usuario.rol,
          whatsapp_number: usuario.whatsapp_number,
          activo: usuario.activo,
          ...JSON.parse(usuario.metadata || '{}')
        };
      } catch (error) {
        console.warn(`⚠️ Invalid JSON in usuario ${usuario.username}, using defaults`);
        this.data.usuarios[usuario.id] = {
          username: usuario.username,
          password: usuario.password,
          rol: usuario.rol,
          whatsapp_number: usuario.whatsapp_number,
          activo: usuario.activo
        };
      }
    });

    console.log(`👥 Users: ${Object.keys(this.data.users).length}`);
    console.log(`💬 Chats: ${Object.keys(this.data.chats).length}`);
    console.log(`⚙️ Settings: ${Object.keys(this.data.settings).length}`);
    console.log(`🔐 Panel Users: ${Object.keys(this.data.usuarios).length}`);
  }

  async saveData() {
    // Save users
    for (const [jid, userData] of Object.entries(this.data.users)) {
      const stats = JSON.stringify({
        exp: userData.exp || 0,
        coin: userData.coin || 0,
        bank: userData.bank || 0,
        level: userData.level || 0,
        health: userData.health || 100
      });
      
      const settings = JSON.stringify({
        premium: userData.premium || false,
        banned: userData.banned || false,
        warn: userData.warn || 0
      });
      
      const activity = JSON.stringify({
        commands: userData.commands || 0,
        afk: userData.afk || -1,
        afk_reason: userData.afkReason || ""
      });

      await this.pool.query(`
        INSERT INTO whatsapp_users (jid, name, stats, settings, activity)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (jid) DO UPDATE SET
          name = EXCLUDED.name,
          stats = EXCLUDED.stats,
          settings = EXCLUDED.settings,
          activity = EXCLUDED.activity,
          updated_at = CURRENT_TIMESTAMP
      `, [jid, userData.name || jid.split('@')[0], stats, settings, activity]);
    }

    // Save chats
    for (const [jid, chatData] of Object.entries(this.data.chats)) {
      await this.pool.query(`
        INSERT INTO chats (jid, settings, messages, message_settings)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (jid) DO UPDATE SET
          settings = EXCLUDED.settings,
          messages = EXCLUDED.messages,
          message_settings = EXCLUDED.message_settings,
          updated_at = CURRENT_TIMESTAMP
      `, [
        jid,
        JSON.stringify(chatData.settings || {}),
        JSON.stringify(chatData.messages || {}),
        JSON.stringify(chatData.message_settings || {})
      ]);
    }

    // Save settings
    for (const [key, value] of Object.entries(this.data.settings)) {
      await this.pool.query(`
        INSERT INTO settings (key_name, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key_name) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = CURRENT_TIMESTAMP
      `, [key, JSON.stringify(value), `Bot setting: ${key}`]);
    }
  }

  // LowDB compatibility
  async read() {
    await this.loadData();
    return this.data;
  }

  async write() {
    await this.saveData();
    return this.data;
  }
}

export default Database;