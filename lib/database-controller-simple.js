/**
 * Simple PostgreSQL Database Controller
 * 
 * Direct PostgreSQL controller without complex adapters
 * Maintains compatibility with existing bot code
 */

import { PostgreSQLDriver } from './postgres-driver.js';
import EventEmitter from 'events';

class DatabaseController extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      postgres: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'oguribot',
        user: process.env.POSTGRES_USER || 'bot_user',
        password: process.env.POSTGRES_PASSWORD || 'melodia',
        ssl: process.env.POSTGRES_SSL === 'true',
        max: 20,
      },
      ...config
    };

    this.driver = null;
    this.isInitialized = false;
    this.data = {
      users: {},
      chats: {},
      settings: {},
      usuarios: {},
    };
  }

  /**
   * Initialize the database controller
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Simple PostgreSQL Database Controller...');
      
      this.driver = new PostgreSQLDriver(this.config.postgres);
      await this.driver.connect();
      
      // Load initial data
      await this.loadData();
      
      this.isInitialized = true;
      console.log('✅ Simple Database Controller initialized successfully');
      
      this.emit('initialized');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize Simple Database Controller:', error.message);
      throw error;
    }
  }

  /**
   * Load data from PostgreSQL into memory cache
   */
  async loadData() {
    try {
      console.log('🔄 Loading data from PostgreSQL...');
      
      // Load users
      const users = await this.driver.query('SELECT * FROM whatsapp_users');
      this.data.users = {};
      if (users && Array.isArray(users)) {
        for (const user of users) {
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
        }
      }

      // Load chats
      const chats = await this.driver.query('SELECT * FROM chats');
      this.data.chats = {};
      if (chats && Array.isArray(chats)) {
        for (const chat of chats) {
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
        }
      }

      // Load settings
      const settings = await this.driver.query('SELECT * FROM settings');
      this.data.settings = {};
      if (settings && Array.isArray(settings)) {
        for (const setting of settings) {
          try {
            // Try to parse as JSON
            this.data.settings[setting.key_name] = JSON.parse(setting.value);
          } catch (error) {
            // If not valid JSON, store as string
            console.warn(`⚠️ Setting '${setting.key_name}' is not valid JSON, storing as string`);
            this.data.settings[setting.key_name] = setting.value;
          }
        }
      }

      // Load panel users
      const usuarios = await this.driver.query('SELECT * FROM usuarios');
      this.data.usuarios = {};
      if (usuarios && Array.isArray(usuarios)) {
        for (const usuario of usuarios) {
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
        }
      }

      console.log('✅ Data loaded successfully');
      console.log(`👥 Users: ${Object.keys(this.data.users).length}`);
      console.log(`💬 Chats: ${Object.keys(this.data.chats).length}`);
      console.log(`⚙️ Settings: ${Object.keys(this.data.settings).length}`);
      console.log(`🔐 Panel Users: ${Object.keys(this.data.usuarios).length}`);
      
    } catch (error) {
      console.error('❌ Failed to load data:', error.message);
      throw error;
    }
  }

  /**
   * Save data to PostgreSQL
   */
  async saveData() {
    try {
      console.log('💾 Saving data to PostgreSQL...');
      
      // Save users
      for (const [jid, userData] of Object.entries(this.data.users)) {
        const stats = {
          exp: userData.exp || 0,
          coin: userData.coin || 0,
          bank: userData.bank || 0,
          level: userData.level || 0,
          health: userData.health || 100
        };
        
        const settings = {
          premium: userData.premium || false,
          banned: userData.banned || false,
          warn: userData.warn || 0
        };
        
        const activity = {
          commands: userData.commands || 0,
          afk: userData.afk || -1,
          afk_reason: userData.afkReason || ""
        };

        await this.driver.query(`
          INSERT INTO whatsapp_users (jid, name, stats, settings, activity)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (jid) DO UPDATE SET
            name = EXCLUDED.name,
            stats = EXCLUDED.stats,
            settings = EXCLUDED.settings,
            activity = EXCLUDED.activity,
            updated_at = CURRENT_TIMESTAMP
        `, [
          jid,
          userData.name || jid.split('@')[0],
          JSON.stringify(stats),
          JSON.stringify(settings),
          JSON.stringify(activity)
        ]);
      }

      // Save chats
      for (const [jid, chatData] of Object.entries(this.data.chats)) {
        await this.driver.query(`
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
        await this.driver.query(`
          INSERT INTO settings (key_name, value, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (key_name) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP
        `, [
          key,
          JSON.stringify(value),
          `Bot setting: ${key}`
        ]);
      }

      console.log('✅ Data saved successfully');
      
    } catch (error) {
      console.error('❌ Failed to save data:', error.message);
      throw error;
    }
  }

  /**
   * Get database interface (LowDB compatible)
   */
  getDatabase() {
    const self = this;
    
    return {
      data: this.data,
      
      // LowDB compatible methods
      async read() {
        await self.loadData();
        return self.data;
      },
      
      async write() {
        await self.saveData();
        return self.data;
      },
      
      // Chain method for compatibility
      chain: (data) => ({
        get: (path) => {
          const keys = path.split('.');
          let result = data;
          for (const key of keys) {
            result = result?.[key];
          }
          return { value: () => result };
        }
      })
    };
  }

  /**
   * Get controller status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      usingPostgreSQL: true,
      usingFallback: false,
      migrationCompleted: true
    };
  }

  /**
   * Close database connections
   */
  async close() {
    if (this.driver) {
      await this.driver.close();
    }
    this.isInitialized = false;
  }
}

export default DatabaseController;