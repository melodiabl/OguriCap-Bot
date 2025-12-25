/**
 * Data Migration System
 * 
 * Migrates all data from LowDB (database.json) to PostgreSQL
 * with validation, integrity checks, and rollback capabilities.
 */

import fs from 'fs/promises';
import path from 'path';
import { PostgreSQLDriver } from './postgres-driver.js';
import EventEmitter from 'events';

class DataMigrationSystem extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      lowdbPath: config.lowdbPath || './database.json',
      backupPath: config.backupPath || './database/backups',
      batchSize: config.batchSize || 100,
      validateData: config.validateData !== false,
      createBackup: config.createBackup !== false,
      postgres: config.postgres || {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'oguribot',
        user: process.env.POSTGRES_USER || 'bot_user',
        password: process.env.POSTGRES_PASSWORD || 'secure_bot_password_2024',
      }
    };

    this.driver = null;
    this.migrationStats = {
      startTime: null,
      endTime: null,
      totalRecords: 0,
      migratedRecords: 0,
      failedRecords: 0,
      errors: [],
      tables: {}
    };
  }

  /**
   * Initialize migration system
   */
  async initialize() {
    try {
      console.log('🔄 Initializing Data Migration System...');
      
      // Initialize PostgreSQL driver
      this.driver = new PostgreSQLDriver(this.config.postgres);
      await this.driver.connect();
      
      // Create backup directory
      await fs.mkdir(this.config.backupPath, { recursive: true });
      
      console.log('✅ Data Migration System initialized');
      this.emit('initialized');
      
    } catch (error) {
      console.error('❌ Failed to initialize migration system:', error.message);
      throw error;
    }
  }

  /**
   * Extract data from LowDB file
   */
  async extractLowDBData() {
    try {
      console.log('🔄 Extracting data from LowDB...');
      console.log(`📁 Reading: ${this.config.lowdbPath}`);
      
      const fileContent = await fs.readFile(this.config.lowdbPath, 'utf8');
      const data = JSON.parse(fileContent);
      
      console.log('✅ LowDB data extracted successfully');
      console.log(`📊 Found sections: ${Object.keys(data).join(', ')}`);
      
      // Log data statistics
      if (data.users) {
        console.log(`👥 WhatsApp Users: ${Object.keys(data.users).length}`);
      }
      if (data.chats) {
        console.log(`💬 Chats: ${Object.keys(data.chats).length}`);
      }
      if (data.settings) {
        console.log(`⚙️ Settings: ${Object.keys(data.settings).length}`);
      }
      if (data.usuarios) {
        console.log(`🔐 Panel Users: ${Object.keys(data.usuarios).length}`);
      }
      
      this.emit('data_extracted', data);
      return data;
      
    } catch (error) {
      console.error('❌ Failed to extract LowDB data:', error.message);
      
      if (error.code === 'ENOENT') {
        console.error('💡 File not found. Make sure database.json exists');
      } else if (error instanceof SyntaxError) {
        console.error('💡 Invalid JSON format in database.json');
      }
      
      throw error;
    }
  }

  /**
   * Validate extracted data
   */
  validateData(data) {
    console.log('🔄 Validating extracted data...');
    
    const errors = [];
    let totalRecords = 0;

    // Validate WhatsApp users
    if (data.users) {
      for (const [jid, user] of Object.entries(data.users)) {
        totalRecords++;
        
        if (!jid || typeof jid !== 'string') {
          errors.push(`Invalid JID: ${jid}`);
          continue;
        }
        
        if (!user.name) {
          console.warn(`⚠️ User ${jid} has no name, using JID`);
        }
        
        // Validate numeric fields
        const numericFields = ['exp', 'coin', 'bank', 'level', 'health', 'commands', 'warn'];
        for (const field of numericFields) {
          if (user[field] !== undefined && (typeof user[field] !== 'number' || isNaN(user[field]))) {
            console.warn(`⚠️ User ${jid} has invalid ${field}: ${user[field]}, setting to 0`);
            user[field] = 0;
          }
        }
        
        // Validate boolean fields
        const booleanFields = ['premium', 'banned'];
        for (const field of booleanFields) {
          if (user[field] !== undefined && typeof user[field] !== 'boolean') {
            console.warn(`⚠️ User ${jid} has invalid ${field}: ${user[field]}, setting to false`);
            user[field] = false;
          }
        }
      }
    }

    // Validate chats
    if (data.chats) {
      for (const [jid, chat] of Object.entries(data.chats)) {
        totalRecords++;
        
        if (!jid || typeof jid !== 'string') {
          errors.push(`Invalid chat JID: ${jid}`);
          continue;
        }
        
        // Validate boolean settings
        if (chat.isBanned !== undefined && typeof chat.isBanned !== 'boolean') {
          console.warn(`⚠️ Chat ${jid} has invalid isBanned: ${chat.isBanned}, setting to false`);
          chat.isBanned = false;
        }
      }
    }

    // Validate panel users
    if (data.usuarios) {
      for (const [id, user] of Object.entries(data.usuarios)) {
        totalRecords++;
        
        if (!user.username) {
          errors.push(`Panel user ${id} missing username`);
          continue;
        }
        
        if (!user.password) {
          errors.push(`Panel user ${user.username} missing password`);
          continue;
        }
        
        if (!user.rol) {
          console.warn(`⚠️ Panel user ${user.username} missing role, setting to 'usuario'`);
          user.rol = 'usuario';
        }
      }
    }

    this.migrationStats.totalRecords = totalRecords;
    
    if (errors.length > 0) {
      console.error(`❌ Validation found ${errors.length} errors:`);
      errors.forEach(error => console.error(`  - ${error}`));
      
      if (this.config.validateData) {
        throw new Error(`Data validation failed with ${errors.length} errors`);
      }
    } else {
      console.log('✅ Data validation passed');
    }
    
    return { valid: errors.length === 0, errors, totalRecords };
  }

  /**
   * Create backup before migration
   */
  async createBackup() {
    if (!this.config.createBackup) {
      console.log('⏭️ Backup creation disabled');
      return null;
    }

    try {
      console.log('🔄 Creating backup before migration...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.config.backupPath, `database-backup-${timestamp}.json`);
      
      // Copy original file
      const originalData = await fs.readFile(this.config.lowdbPath, 'utf8');
      await fs.writeFile(backupFile, originalData, 'utf8');
      
      console.log(`✅ Backup created: ${backupFile}`);
      this.emit('backup_created', backupFile);
      
      return backupFile;
      
    } catch (error) {
      console.error('❌ Failed to create backup:', error.message);
      throw error;
    }
  }

  /**
   * Migrate WhatsApp users to PostgreSQL
   */
  async migrateWhatsAppUsers(users) {
    if (!users || Object.keys(users).length === 0) {
      console.log('⏭️ No WhatsApp users to migrate');
      return;
    }

    console.log(`🔄 Migrating ${Object.keys(users).length} WhatsApp users...`);
    
    const userEntries = Object.entries(users);
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < userEntries.length; i += this.config.batchSize) {
      batches.push(userEntries.slice(i, i + this.config.batchSize));
    }
    
    let migratedCount = 0;
    
    for (const [batchIndex, batch] of batches.entries()) {
      console.log(`📦 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} users)`);
      
      const columns = ['jid', 'name', 'stats', 'settings', 'activity'];
      const rows = batch.map(([jid, user]) => {
        const stats = {
          exp: user.exp || 0,
          coin: user.coin || 0,
          bank: user.bank || 0,
          level: user.level || 0,
          health: user.health || 100
        };
        
        const settings = {
          premium: user.premium || false,
          banned: user.banned || false,
          warn: user.warn || 0
        };
        
        const activity = {
          commands: user.commands || 0,
          afk: user.afk || -1,
          afk_reason: user.afkReason || ""
        };
        
        return [
          jid,
          user.name || jid.split('@')[0],
          JSON.stringify(stats),
          JSON.stringify(settings),
          JSON.stringify(activity)
        ];
      });
      
      try {
        await this.driver.bulkInsert(
          'whatsapp_users',
          columns,
          rows,
          'jid',
          ['name', 'stats', 'settings', 'activity']
        );
        
        migratedCount += batch.length;
        console.log(`✅ Batch ${batchIndex + 1} completed (${migratedCount}/${userEntries.length})`);
        
      } catch (error) {
        console.error(`❌ Batch ${batchIndex + 1} failed:`, error.message);
        this.migrationStats.errors.push(`WhatsApp users batch ${batchIndex + 1}: ${error.message}`);
      }
    }
    
    this.migrationStats.tables.whatsapp_users = {
      total: userEntries.length,
      migrated: migratedCount,
      failed: userEntries.length - migratedCount
    };
    
    console.log(`✅ WhatsApp users migration completed: ${migratedCount}/${userEntries.length}`);
  }

  /**
   * Migrate chats to PostgreSQL
   */
  async migrateChats(chats) {
    if (!chats || Object.keys(chats).length === 0) {
      console.log('⏭️ No chats to migrate');
      return;
    }

    console.log(`🔄 Migrating ${Object.keys(chats).length} chats...`);
    
    const chatEntries = Object.entries(chats);
    let migratedCount = 0;
    
    for (const [jid, chat] of chatEntries) {
      try {
        const settings = {
          is_banned: chat.isBanned || false,
          antilink: chat.antilink || false,
          ...chat.settings
        };
        
        const messages = {
          welcome: chat.sWelcome || null,
          bye: chat.sBye || null,
          promote: chat.sPromote || null,
          demote: chat.sDemote || null,
          ...chat.messages
        };
        
        const messageSettings = {
          s_welcome: chat.welcome || false,
          s_bye: chat.bye || false,
          s_promote: chat.promote || false,
          s_demote: chat.demote || false,
          ...chat.messageSettings
        };
        
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
          JSON.stringify(settings),
          JSON.stringify(messages),
          JSON.stringify(messageSettings)
        ]);
        
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ Failed to migrate chat ${jid}:`, error.message);
        this.migrationStats.errors.push(`Chat ${jid}: ${error.message}`);
      }
    }
    
    this.migrationStats.tables.chats = {
      total: chatEntries.length,
      migrated: migratedCount,
      failed: chatEntries.length - migratedCount
    };
    
    console.log(`✅ Chats migration completed: ${migratedCount}/${chatEntries.length}`);
  }

  /**
   * Migrate panel users to PostgreSQL
   */
  async migratePanelUsers(usuarios) {
    if (!usuarios || Object.keys(usuarios).length === 0) {
      console.log('⏭️ No panel users to migrate');
      return;
    }

    console.log(`🔄 Migrating ${Object.keys(usuarios).length} panel users...`);
    
    const userEntries = Object.entries(usuarios);
    let migratedCount = 0;
    
    for (const [id, user] of userEntries) {
      try {
        const metadata = {
          temp_password: user.temp_password || null,
          temp_password_expires: user.temp_password_expires || null,
          require_password_change: user.require_password_change || false,
          last_login: user.last_login || null,
          login_ip: user.login_ip || null
        };
        
        await this.driver.query(`
          INSERT INTO usuarios (username, password, rol, whatsapp_number, activo, metadata, fecha_registro)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (username) DO UPDATE SET
            password = EXCLUDED.password,
            rol = EXCLUDED.rol,
            whatsapp_number = EXCLUDED.whatsapp_number,
            activo = EXCLUDED.activo,
            metadata = EXCLUDED.metadata,
            updated_at = CURRENT_TIMESTAMP
        `, [
          user.username,
          user.password,
          user.rol,
          user.whatsapp_number || null,
          user.activo !== false,
          JSON.stringify(metadata),
          user.fecha_registro || new Date().toISOString()
        ]);
        
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ Failed to migrate panel user ${user.username}:`, error.message);
        this.migrationStats.errors.push(`Panel user ${user.username}: ${error.message}`);
      }
    }
    
    this.migrationStats.tables.usuarios = {
      total: userEntries.length,
      migrated: migratedCount,
      failed: userEntries.length - migratedCount
    };
    
    console.log(`✅ Panel users migration completed: ${migratedCount}/${userEntries.length}`);
  }

  /**
   * Migrate settings to PostgreSQL
   */
  async migrateSettings(settings) {
    if (!settings || Object.keys(settings).length === 0) {
      console.log('⏭️ No settings to migrate');
      return;
    }

    console.log(`🔄 Migrating ${Object.keys(settings).length} settings...`);
    
    const settingsEntries = Object.entries(settings);
    let migratedCount = 0;
    
    for (const [key, value] of settingsEntries) {
      try {
        await this.driver.query(`
          INSERT INTO settings (key_name, value, description)
          VALUES ($1, $2, $3)
          ON CONFLICT (key_name) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP
        `, [
          key,
          JSON.stringify(value),
          `Migrated from LowDB: ${key}`
        ]);
        
        migratedCount++;
        
      } catch (error) {
        console.error(`❌ Failed to migrate setting ${key}:`, error.message);
        this.migrationStats.errors.push(`Setting ${key}: ${error.message}`);
      }
    }
    
    this.migrationStats.tables.settings = {
      total: settingsEntries.length,
      migrated: migratedCount,
      failed: settingsEntries.length - migratedCount
    };
    
    console.log(`✅ Settings migration completed: ${migratedCount}/${settingsEntries.length}`);
  }

  /**
   * Run complete migration process
   */
  async migrate() {
    try {
      console.log('🚀 Starting complete data migration...');
      this.migrationStats.startTime = new Date();
      
      // Initialize system
      await this.initialize();
      
      // Create backup
      const backupFile = await this.createBackup();
      
      // Extract data
      const data = await this.extractLowDBData();
      
      // Validate data
      const validation = this.validateData(data);
      
      // Start migration transaction
      await this.driver.transaction(async (query) => {
        console.log('🔄 Starting migration transaction...');
        
        // Migrate all data types
        await this.migrateWhatsAppUsers(data.users);
        await this.migrateChats(data.chats);
        await this.migratePanelUsers(data.usuarios);
        await this.migrateSettings(data.settings);
        
        // Update migration status
        await query(`
          INSERT INTO settings (key_name, value, description)
          VALUES ('migration_status', $1, 'Migration completion status')
          ON CONFLICT (key_name) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP
        `, [JSON.stringify({
          completed: true,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          backup_file: backupFile,
          stats: this.migrationStats
        })]);
        
        console.log('✅ Migration transaction completed');
      });
      
      this.migrationStats.endTime = new Date();
      const duration = this.migrationStats.endTime - this.migrationStats.startTime;
      
      console.log('🎉 Migration completed successfully!');
      console.log(`⏱️ Duration: ${Math.round(duration / 1000)}s`);
      console.log(`📊 Total records: ${this.migrationStats.totalRecords}`);
      console.log(`✅ Migrated: ${Object.values(this.migrationStats.tables).reduce((sum, table) => sum + table.migrated, 0)}`);
      console.log(`❌ Failed: ${Object.values(this.migrationStats.tables).reduce((sum, table) => sum + table.failed, 0)}`);
      
      if (this.migrationStats.errors.length > 0) {
        console.log(`⚠️ Errors: ${this.migrationStats.errors.length}`);
        this.migrationStats.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      this.emit('migration_completed', this.migrationStats);
      return this.migrationStats;
      
    } catch (error) {
      this.migrationStats.endTime = new Date();
      console.error('❌ Migration failed:', error.message);
      this.emit('migration_failed', error);
      throw error;
    }
  }

  /**
   * Get migration statistics
   */
  getStats() {
    return this.migrationStats;
  }
}

export default DataMigrationSystem;