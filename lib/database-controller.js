/**
 * Database Controller
 * 
 * Main controller that replaces LowDB with PostgreSQL while maintaining
 * full backward compatibility. Handles automatic migration, fallback,
 * and seamless integration with existing code.
 */

import DatabaseAdapter from './database-adapter.js';
import DataMigrationSystem from './data-migration-system.js';
import { PostgreSQLDriver } from './postgres-driver.js';
import EventEmitter from 'events';
import fs from 'fs/promises';

class DatabaseController extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      // Migration settings - FULLY AUTOMATIC
      autoMigrate: config.autoMigrate !== false,  // Default TRUE
      migrationRequired: true,
      silentMode: config.silentMode !== false,    // Don't ask questions
      forceAutoSetup: config.forceAutoSetup !== false, // Auto-setup everything
      
      // Database paths
      lowdbPath: config.lowdbPath || './database.json',
      
      // PostgreSQL settings
      postgres: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'oguribot',
        user: process.env.POSTGRES_USER || 'bot_user',
        password: process.env.POSTGRES_PASSWORD || 'secure_bot_password_2024',
        ssl: process.env.POSTGRES_SSL === 'true',
        max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS) || 20,
      },
      
      // Fallback settings - AUTOMATIC
      fallback: {
        enabled: true,
        timeout: 3000, // Shorter timeout for faster fallback
        autoFallback: true, // Automatic fallback without user intervention
      },
      
      ...config
    };

    this.adapter = null;
    this.migrationSystem = null;
    this.isInitialized = false;
    this.migrationCompleted = false;
    this.usingFallback = false;
    
    // Status tracking
    this.status = {
      database: 'initializing',
      migration: 'pending',
      lastError: null,
      startTime: new Date(),
    };
  }

  /**
   * Initialize the database controller - FULLY AUTOMATIC
   */
  async initialize() {
    try {
      console.log('🤖 AUTOMATIC: Initializing Database Controller...');
      console.log('🤖 AUTOMATIC: Configuration:');
      console.log(`  - Auto Migration: ${this.config.autoMigrate} (ENABLED)`);
      console.log(`  - PostgreSQL Host: ${this.config.postgres.host}:${this.config.postgres.port}`);
      console.log(`  - Database: ${this.config.postgres.database}`);
      console.log(`  - Auto Fallback: ${this.config.fallback.autoFallback} (ENABLED)`);
      
      // AUTOMATIC: Check if migration is needed
      const migrationNeeded = await this.checkMigrationStatus();
      
      if (migrationNeeded && this.config.autoMigrate) {
        console.log('🤖 AUTOMATIC: Migration required - starting automatic migration...');
        try {
          await this.runMigration();
        } catch (migrationError) {
          console.error('🤖 AUTOMATIC: Migration failed, will continue with fallback:', migrationError.message);
          // Don't throw - let it continue to fallback
        }
      }
      
      // AUTOMATIC: Initialize database adapter
      this.adapter = new DatabaseAdapter({
        postgres: this.config.postgres,
        fallback: {
          enabled: this.config.fallback.enabled,
          lowdbPath: this.config.lowdbPath,
        }
      });
      
      // Set up event listeners
      this.setupEventListeners();
      
      // AUTOMATIC: Initialize adapter with timeout
      const initPromise = this.adapter.initialize();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('PostgreSQL initialization timeout')), this.config.fallback.timeout)
      );
      
      try {
        await Promise.race([initPromise, timeoutPromise]);
        this.isInitialized = true;
        this.status.database = 'connected';
        console.log('🤖 AUTOMATIC: Database Controller initialized successfully with PostgreSQL');
      } catch (timeoutError) {
        console.log('🤖 AUTOMATIC: PostgreSQL timeout, switching to fallback mode...');
        throw timeoutError; // This will trigger fallback
      }
      
      this.emit('initialized');
      return this.adapter;
      
    } catch (error) {
      this.status.database = 'error';
      this.status.lastError = error.message;
      
      console.log('🤖 AUTOMATIC: PostgreSQL failed, initializing fallback mode...');
      
      // AUTOMATIC: Try fallback mode
      if (this.config.fallback.enabled && this.config.fallback.autoFallback) {
        console.log('🤖 AUTOMATIC: Attempting automatic fallback to LowDB...');
        await this.initializeFallback();
      } else {
        throw error;
      }
    }
  }

  /**
   * Check if migration is needed
   */
  async checkMigrationStatus() {
    try {
      // Check if PostgreSQL is available and has migration status
      const driver = new PostgreSQLDriver(this.config.postgres);
      await driver.connect();
      
      const result = await driver.query(`
        SELECT value FROM settings WHERE key_name = 'migration_status'
      `);
      
      await driver.close();
      
      if (result.length > 0) {
        const migrationStatus = result[0].value;
        this.migrationCompleted = migrationStatus.completed === true;
        this.status.migration = this.migrationCompleted ? 'completed' : 'partial';
        
        console.log(`📊 Migration status: ${this.migrationCompleted ? 'Completed' : 'Partial'}`);
        return !this.migrationCompleted;
      }
      
      // No migration status found - migration needed
      console.log('📊 No migration status found - migration required');
      return true;
      
    } catch (error) {
      // PostgreSQL not available or no migration table - migration needed
      console.log('📊 PostgreSQL not available or no migration data - migration required');
      return true;
    }
  }

  /**
   * Run data migration from LowDB to PostgreSQL
   */
  async runMigration() {
    try {
      console.log('🚀 Starting data migration process...');
      this.status.migration = 'running';
      
      // Check if LowDB file exists
      try {
        await fs.access(this.config.lowdbPath);
      } catch (error) {
        console.log('⚠️ No LowDB file found - skipping migration');
        this.status.migration = 'skipped';
        return;
      }
      
      // Initialize migration system
      this.migrationSystem = new DataMigrationSystem({
        lowdbPath: this.config.lowdbPath,
        postgres: this.config.postgres,
        validateData: true,
        createBackup: true,
      });
      
      // Set up migration event listeners
      this.migrationSystem.on('migration_completed', (stats) => {
        this.migrationCompleted = true;
        this.status.migration = 'completed';
        console.log('🎉 Migration completed successfully!');
        this.emit('migration_completed', stats);
      });
      
      this.migrationSystem.on('migration_failed', (error) => {
        this.status.migration = 'failed';
        this.status.lastError = error.message;
        console.error('❌ Migration failed:', error.message);
        this.emit('migration_failed', error);
      });
      
      // Run migration
      const stats = await this.migrationSystem.migrate();
      
      console.log('✅ Migration process completed');
      return stats;
      
    } catch (error) {
      this.status.migration = 'failed';
      this.status.lastError = error.message;
      console.error('❌ Migration process failed:', error.message);
      throw error;
    }
  }

  /**
   * Initialize fallback to LowDB - AUTOMATIC
   */
  async initializeFallback() {
    try {
      console.log('🤖 AUTOMATIC: Initializing LowDB fallback mode...');
      
      const { Low, JSONFile } = await import('lowdb');
      const adapter = new JSONFile(this.config.lowdbPath);
      this.fallbackDb = new Low(adapter);
      
      await this.fallbackDb.read();
      this.fallbackDb.data ||= { users: {}, chats: {}, settings: {}, usuarios: {} };
      
      // Create a simple adapter interface for fallback
      this.adapter = {
        data: this.fallbackDb.data,
        read: () => this.fallbackDb.read(),
        write: () => this.fallbackDb.write(),
        getConnectionStatus: () => ({
          isConnected: false,
          isInitialized: true,
          postgres: false,
          fallback: true,
          hasData: true
        }),
        close: () => Promise.resolve()
      };
      
      this.usingFallback = true;
      this.status.database = 'fallback';
      this.isInitialized = true;
      
      console.log('🤖 AUTOMATIC: LowDB fallback mode initialized successfully');
      this.emit('fallback_initialized');
      
    } catch (error) {
      console.error('🤖 AUTOMATIC: Fallback initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Set up event listeners for adapter
   */
  setupEventListeners() {
    if (!this.adapter) return;
    
    this.adapter.on('connected', () => {
      console.log('✅ Database adapter connected');
      this.status.database = 'connected';
      this.emit('database_connected');
    });
    
    this.adapter.on('connection_error', (error) => {
      console.error('❌ Database connection error:', error.message);
      this.status.lastError = error.message;
      this.emit('database_error', error);
    });
    
    this.adapter.on('error', (error) => {
      console.error('❌ Database adapter error:', error.message);
      this.status.lastError = error.message;
      this.emit('database_error', error);
    });
  }

  /**
   * Get database instance (LowDB compatibility)
   */
  getDatabase() {
    if (!this.isInitialized) {
      throw new Error('Database controller not initialized');
    }
    
    return this.adapter;
  }

  /**
   * Get data property (LowDB compatibility)
   */
  get data() {
    return this.adapter?.data || {};
  }

  /**
   * Read data (LowDB compatibility)
   */
  async read() {
    if (!this.adapter) {
      throw new Error('Database not initialized');
    }
    return await this.adapter.read();
  }

  /**
   * Write data (LowDB compatibility)
   */
  async write() {
    if (!this.adapter) {
      throw new Error('Database not initialized');
    }
    return await this.adapter.write();
  }

  /**
   * Execute raw query (PostgreSQL only)
   */
  async query(sql, params = []) {
    if (!this.adapter || this.usingFallback) {
      throw new Error('Raw queries not available in fallback mode');
    }
    return await this.adapter.query(sql, params);
  }

  /**
   * Execute transaction (PostgreSQL only)
   */
  async transaction(callback) {
    if (!this.adapter || this.usingFallback) {
      throw new Error('Transactions not available in fallback mode');
    }
    return await this.adapter.transaction(callback);
  }

  /**
   * Get controller status
   */
  getStatus() {
    return {
      ...this.status,
      isInitialized: this.isInitialized,
      migrationCompleted: this.migrationCompleted,
      usingFallback: this.usingFallback,
      adapter: this.adapter?.getConnectionStatus?.() || null,
      uptime: Date.now() - this.status.startTime.getTime()
    };
  }

  /**
   * Force migration (manual trigger)
   */
  async forceMigration() {
    console.log('🔄 Force migration requested...');
    this.migrationCompleted = false;
    this.status.migration = 'pending';
    return await this.runMigration();
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const status = this.getStatus();
      
      if (this.usingFallback) {
        return {
          healthy: true,
          mode: 'fallback',
          status: status
        };
      }
      
      if (this.adapter && typeof this.adapter.healthCheck === 'function') {
        const adapterHealth = await this.adapter.healthCheck();
        return {
          healthy: adapterHealth.healthy,
          mode: 'postgresql',
          status: status,
          adapter: adapterHealth
        };
      }
      
      return {
        healthy: this.isInitialized,
        mode: 'unknown',
        status: status
      };
      
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        status: this.getStatus()
      };
    }
  }

  /**
   * Close database connections
   */
  async close() {
    try {
      if (this.adapter && typeof this.adapter.close === 'function') {
        await this.adapter.close();
      }
      
      if (this.migrationSystem && typeof this.migrationSystem.close === 'function') {
        await this.migrationSystem.close();
      }
      
      console.log('✅ Database controller closed');
      this.emit('closed');
      
    } catch (error) {
      console.error('❌ Error closing database controller:', error.message);
    }
  }
}

export default DatabaseController;