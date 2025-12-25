/**
 * Database Adapter Layer
 * 
 * Provides a unified interface that maintains compatibility with existing LowDB code
 * while enabling PostgreSQL backend operations. This adapter ensures seamless
 * transition from file-based JSON storage to production PostgreSQL database.
 */

import EventEmitter from 'events';
import { PostgreSQLDriver } from './postgres-driver.js';

class DatabaseAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // PostgreSQL connection settings
      postgres: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'oguribot',
        user: process.env.POSTGRES_USER || 'bot_user',
        password: process.env.POSTGRES_PASSWORD || 'secure_bot_password_2024',
        ssl: process.env.POSTGRES_SSL === 'true',
        max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      },
      // Caching settings
      cache: {
        enabled: true,
        ttl: 300000, // 5 minutes
        maxSize: 1000,
      },
      // Fallback settings
      fallback: {
        enabled: true,
        lowdbPath: './database.json',
      },
      ...config
    };

    this.driver = null;
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    this.isConnected = false;
    this.isInitialized = false;
    this.cachedData = {};
    
    // Connection status
    this.connectionStatus = {
      postgres: false,
      lastError: null,
      retryCount: 0,
      maxRetries: 5,
    };

    // Initialize adapter
    this.initialize();
  }

  /**
   * Initialize the database adapter
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Database Adapter...');
      
      // Initialize PostgreSQL driver
      this.driver = new PostgreSQLDriver(this.config.postgres);
      
      // Test connection
      await this.connect();
      
      // Load initial data into cache
      await this.loadInitialData();
      
      this.isInitialized = true;
      console.log('✅ Database Adapter initialized successfully');
      
      this.emit('initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Database Adapter:', error.message);
      this.emit('error', error);
      
      // Try fallback if enabled
      if (this.config.fallback.enabled) {
        await this.initializeFallback();
      }
    }
  }

  /**
   * Connect to PostgreSQL database
   */
  async connect() {
    try {
      await this.driver.connect();
      this.isConnected = true;
      this.connectionStatus.postgres = true;
      this.connectionStatus.lastError = null;
      this.connectionStatus.retryCount = 0;
      
      console.log('✅ Connected to PostgreSQL database');
      this.emit('connected');
      
      return true;
    } catch (error) {
      this.isConnected = false;
      this.connectionStatus.postgres = false;
      this.connectionStatus.lastError = error.message;
      this.connectionStatus.retryCount++;
      
      console.error('❌ PostgreSQL connection failed:', error.message);
      this.emit('connection_error', error);
      
      // Retry logic with exponential backoff
      if (this.connectionStatus.retryCount < this.connectionStatus.maxRetries) {
        const delay = Math.pow(2, this.connectionStatus.retryCount) * 1000;
        console.log(`🔄 Retrying connection in ${delay}ms (attempt ${this.connectionStatus.retryCount}/${this.connectionStatus.maxRetries})`);
        
        setTimeout(() => this.connect(), delay);
      }
      
      throw error;
    }
  }

  /**
   * Load initial data into cache for LowDB compatibility
   */
  async loadInitialData() {
    try {
      console.log('🔄 Loading initial data into cache...');
      
      // Load usuarios
      const usuarios = await this.driver.query('SELECT * FROM usuarios');
      this.cachedData.usuarios = {};
      usuarios.forEach(user => {
        this.cachedData.usuarios[user.username] = {
          id: user.id,
          username: user.username,
          password: user.password,
          rol: user.rol,
          whatsapp_number: user.whatsapp_number,
          fecha_registro: user.fecha_registro,
          activo: user.activo,
          temp_password: user.temp_password,
          temp_password_expires: user.temp_password_expires,
          require_password_change: user.require_password_change,
          last_login: user.last_login,
          login_ip: user.login_ip,
          ...user.metadata
        };
      });

      // Load WhatsApp users
      const whatsappUsers = await this.driver.query('SELECT * FROM whatsapp_users');
      this.cachedData.users = {};
      whatsappUsers.forEach(user => {
        this.cachedData.users[user.jid] = {
          name: user.name,
          ...user.stats,
          ...user.settings,
          ...user.activity
        };
      });

      // Load chats
      const chats = await this.driver.query('SELECT * FROM chats');
      this.cachedData.chats = {};
      chats.forEach(chat => {
        this.cachedData.chats[chat.jid] = {
          ...chat.settings,
          ...chat.messages,
          ...chat.message_settings
        };
      });

      // Load settings
      const settings = await this.driver.query('SELECT * FROM settings');
      this.cachedData.settings = {};
      settings.forEach(setting => {
        this.cachedData.settings[setting.key_name] = setting.value;
      });

      console.log('✅ Initial data loaded into cache');
    } catch (error) {
      console.error('❌ Failed to load initial data:', error.message);
      throw error;
    }
  }

  /**
   * Initialize fallback to LowDB (compatibility mode)
   */
  async initializeFallback() {
    try {
      console.log('🔄 Initializing LowDB fallback...');
      
      const { Low, JSONFile } = await import('lowdb');
      const adapter = new JSONFile(this.config.fallback.lowdbPath);
      this.fallbackDb = new Low(adapter);
      
      await this.fallbackDb.read();
      this.cachedData = this.fallbackDb.data || {};
      
      console.log('✅ LowDB fallback initialized');
      this.emit('fallback_initialized');
    } catch (error) {
      console.error('❌ Failed to initialize LowDB fallback:', error.message);
      throw error;
    }
  }

  /**
   * LowDB compatibility: get data property
   */
  get data() {
    return this.cachedData;
  }

  /**
   * LowDB compatibility: read method
   */
  async read() {
    if (this.isConnected) {
      await this.loadInitialData();
    } else if (this.fallbackDb) {
      await this.fallbackDb.read();
      this.cachedData = this.fallbackDb.data || {};
    }
    return this.cachedData;
  }

  /**
   * LowDB compatibility: write method
   */
  async write() {
    if (this.isConnected) {
      // Write cached data back to PostgreSQL
      await this.syncCacheToDatabase();
    } else if (this.fallbackDb) {
      this.fallbackDb.data = this.cachedData;
      await this.fallbackDb.write();
    }
  }

  /**
   * Sync cached data back to PostgreSQL database
   */
  async syncCacheToDatabase() {
    try {
      console.log('🔄 Syncing cache to PostgreSQL...');
      
      // Sync usuarios
      if (this.cachedData.usuarios) {
        for (const [username, userData] of Object.entries(this.cachedData.usuarios)) {
          await this.driver.query(`
            INSERT INTO usuarios (username, password, rol, whatsapp_number, activo, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (username) DO UPDATE SET
              password = EXCLUDED.password,
              rol = EXCLUDED.rol,
              whatsapp_number = EXCLUDED.whatsapp_number,
              activo = EXCLUDED.activo,
              metadata = EXCLUDED.metadata,
              updated_at = CURRENT_TIMESTAMP
          `, [
            username,
            userData.password,
            userData.rol,
            userData.whatsapp_number,
            userData.activo !== false,
            JSON.stringify({
              temp_password: userData.temp_password,
              temp_password_expires: userData.temp_password_expires,
              require_password_change: userData.require_password_change,
              last_login: userData.last_login,
              login_ip: userData.login_ip
            })
          ]);
        }
      }

      // Sync WhatsApp users
      if (this.cachedData.users) {
        for (const [jid, userData] of Object.entries(this.cachedData.users)) {
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
          `, [jid, userData.name, JSON.stringify(stats), JSON.stringify(settings), JSON.stringify(activity)]);
        }
      }

      console.log('✅ Cache synced to PostgreSQL');
    } catch (error) {
      console.error('❌ Failed to sync cache to PostgreSQL:', error.message);
      throw error;
    }
  }

  /**
   * Execute raw SQL query
   */
  async query(sql, params = []) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return await this.driver.query(sql, params);
  }

  /**
   * Execute transaction
   */
  async transaction(callback) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    return await this.driver.transaction(callback);
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isInitialized: this.isInitialized,
      postgres: this.connectionStatus.postgres,
      lastError: this.connectionStatus.lastError,
      retryCount: this.connectionStatus.retryCount,
      cacheSize: this.cache.size,
      hasData: Object.keys(this.cachedData).length > 0
    };
  }

  /**
   * Close database connections
   */
  async close() {
    try {
      if (this.driver) {
        await this.driver.close();
      }
      this.isConnected = false;
      this.connectionStatus.postgres = false;
      console.log('✅ Database connections closed');
    } catch (error) {
      console.error('❌ Error closing database connections:', error.message);
    }
  }
}

export default DatabaseAdapter;