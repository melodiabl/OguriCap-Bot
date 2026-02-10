// Sistema de Configuración Avanzada

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import auditLogger, { AUDIT_EVENTS } from './audit-logger.js';
import notificationSystem, { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } from './notification-system.js';

// Tipos de configuración
export const CONFIG_TYPES = {
  SYSTEM: 'system',
  BOT: 'bot',
  DATABASE: 'database',
  SECURITY: 'security',
  NOTIFICATIONS: 'notifications',
  PLUGINS: 'plugins',
  CUSTOM: 'custom'
};

// Ambientes
export const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TESTING: 'testing'
};

// Estados de configuración
export const CONFIG_STATES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  ROLLBACK: 'rollback'
};

class ConfigManager {
  constructor() {
    this.configDir = path.join(process.cwd(), '.config');
    this.backupDir = path.join(this.configDir, 'backups');
    this.versionsDir = path.join(this.configDir, 'versions');
    this.templatesDir = path.join(this.configDir, 'templates');
    
    this.currentEnvironment = process.env.NODE_ENV || ENVIRONMENTS.DEVELOPMENT;
    this.configs = new Map(); // Configuraciones en memoria
    this.validators = new Map(); // Validadores por tipo
    this.watchers = new Map(); // File watchers
    
    this.initializeDirectories();
    this.loadConfigurations();
    this.setupValidators();
    this.startConfigWatcher();
  }

  /**
   * Inicializar directorios necesarios
   */
  initializeDirectories() {
    const dirs = [
      this.configDir,
      this.backupDir,
      this.versionsDir,
      this.templatesDir,
      path.join(this.configDir, 'environments'),
      path.join(this.configDir, 'schemas')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Crear archivo de configuración principal si no existe
    const mainConfigPath = path.join(this.configDir, 'main.json');
    if (!fs.existsSync(mainConfigPath)) {
      this.createDefaultConfiguration();
    }
  }

  /**
   * Crear configuración por defecto
   */
  createDefaultConfiguration() {
    const defaultConfig = {
      version: '1.0.0',
      environment: this.currentEnvironment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      system: {
        name: 'WhatsApp Bot Panel',
        version: '2.0.0',
        debug: this.currentEnvironment === ENVIRONMENTS.DEVELOPMENT,
        logLevel: this.currentEnvironment === ENVIRONMENTS.PRODUCTION ? 'error' : 'debug',
        maxMemory: '512MB',
        timezone: 'America/Mexico_City'
      },
      
      bot: {
        name: 'Oguri Bot',
        prefix: '#',
        autoReconnect: true,
        maxRetries: 5,
        commandCooldown: 3000,
        globallyEnabled: true
      },
      
      database: {
        type: 'lowdb',
        path: './database.json',
        autoSave: true,
        backupInterval: 3600000, // 1 hora
        maxBackups: 10
      },
      
      security: {
        enableRateLimit: true,
        maxRequestsPerMinute: 100,
        enableIPBlocking: true,
        sessionTimeout: 86400000, // 24 horas
        enableAuditLog: true
      },
      
      notifications: {
        email: {
          enabled: false,
          smtp: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false
          }
        },
        webhook: {
          enabled: false,
          urls: []
        },
        whatsapp: {
          enabled: true,
          adminNumbers: []
        }
      },
      
      // Plugins removidos - funcionalidad simulada
    };

    this.saveConfiguration('main', defaultConfig);
    console.log('[Config Manager] Default configuration created');
  }

  /**
   * Cargar todas las configuraciones
   */
  loadConfigurations() {
    try {
      // Cargar configuración principal
      const mainConfigPath = path.join(this.configDir, 'main.json');
      if (fs.existsSync(mainConfigPath)) {
        const mainConfig = JSON.parse(fs.readFileSync(mainConfigPath, 'utf8'));
        this.configs.set('main', mainConfig);
      }

      // Cargar configuraciones por ambiente
      const envConfigPath = path.join(this.configDir, 'environments', `${this.currentEnvironment}.json`);
      if (fs.existsSync(envConfigPath)) {
        const envConfig = JSON.parse(fs.readFileSync(envConfigPath, 'utf8'));
        this.configs.set('environment', envConfig);
      }

      // Cargar configuraciones personalizadas
      const configFiles = fs.readdirSync(this.configDir)
        .filter(file => file.endsWith('.json') && file !== 'main.json');

      for (const file of configFiles) {
        const configName = path.basename(file, '.json');
        const configPath = path.join(this.configDir, file);
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.configs.set(configName, config);
      }

      console.log(`[Config Manager] Loaded ${this.configs.size} configurations`);
    } catch (error) {
      console.error('[Config Manager] Error loading configurations:', error);
    }
  }

  /**
   * Configurar validadores
   */
  setupValidators() {
    // Validador para configuración del sistema
    this.validators.set(CONFIG_TYPES.SYSTEM, (config) => {
      const errors = [];
      
      if (!config.name || typeof config.name !== 'string') {
        errors.push('system.name debe ser una cadena válida');
      }
      
      if (!config.version || !/^\d+\.\d+\.\d+$/.test(config.version)) {
        errors.push('system.version debe seguir el formato semver (x.y.z)');
      }
      
      if (config.maxMemory && !/^\d+(MB|GB)$/.test(config.maxMemory)) {
        errors.push('system.maxMemory debe tener formato válido (ej: 512MB, 1GB)');
      }
      
      return errors;
    });

    // Validador para configuración del bot
    this.validators.set(CONFIG_TYPES.BOT, (config) => {
      const errors = [];
      
      if (!config.name || typeof config.name !== 'string') {
        errors.push('bot.name debe ser una cadena válida');
      }
      
      if (!config.prefix || typeof config.prefix !== 'string') {
        errors.push('bot.prefix debe ser una cadena válida');
      }
      
      if (typeof config.commandCooldown !== 'number' || config.commandCooldown < 0) {
        errors.push('bot.commandCooldown debe ser un número positivo');
      }
      
      return errors;
    });

    // Validador para configuración de seguridad
    this.validators.set(CONFIG_TYPES.SECURITY, (config) => {
      const errors = [];
      
      if (typeof config.maxRequestsPerMinute !== 'number' || config.maxRequestsPerMinute <= 0) {
        errors.push('security.maxRequestsPerMinute debe ser un número positivo');
      }
      
      if (typeof config.sessionTimeout !== 'number' || config.sessionTimeout <= 0) {
        errors.push('security.sessionTimeout debe ser un número positivo');
      }
      
      return errors;
    });

    // Validador para plugins removido - funcionalidad simulada
  }

  /**
   * Obtener configuración
   */
  getConfig(key = 'main', section = null) {
    const config = this.configs.get(key);
    if (!config) return null;

    // Aplicar configuración de ambiente si existe
    const envConfig = this.configs.get('environment');
    let mergedConfig = config;
    
    if (envConfig && key === 'main') {
      mergedConfig = this.deepMerge(config, envConfig);
    }

    return section ? mergedConfig[section] : mergedConfig;
  }

  /**
   * Establecer configuración
   */
  async setConfig(key, config, options = {}) {
    try {
      const {
        validate = true,
        backup = true,
        notify = true,
        userId = 'system'
      } = options;

      // Crear backup si está habilitado
      if (backup && this.configs.has(key)) {
        await this.createBackup(key);
      }

      // Validar configuración
      if (validate) {
        const validationErrors = await this.validateConfiguration(key, config);
        if (validationErrors.length > 0) {
          throw new Error(`Errores de validación: ${validationErrors.join(', ')}`);
        }
      }

      // Crear nueva versión
      const version = await this.createVersion(key, config, userId);

      // Actualizar configuración en memoria
      this.configs.set(key, config);

      // Guardar en archivo
      await this.saveConfiguration(key, config);

      // Notificar cambio
      if (notify) {
        await notificationSystem.send({
          type: NOTIFICATION_TYPES.INFO,
          title: '⚙️ Configuración Modificada',
          message: `Se han aplicado cambios en la sección "${key}". El sistema se ha sincronizado con la nueva versión (${version.id.slice(0, 8)}).`,
          category: NOTIFICATION_CATEGORIES.SYSTEM,
          data: { configKey: key, version: version.id }
        });
      }

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
        level: 'info',
        details: {
          configKey: key,
          versionId: version.id,
          userId,
          changes: this.getConfigDiff(this.configs.get(key), config)
        }
      });

      return version;
    } catch (error) {
      console.error('[Config Manager] Error setting configuration:', error);
      throw error;
    }
  }

  /**
   * Validar configuración
   */
  async validateConfiguration(key, config) {
    const errors = [];

    try {
      // Validación básica de estructura
      if (!config || typeof config !== 'object') {
        errors.push('La configuración debe ser un objeto válido');
        return errors;
      }

      // Validar cada sección según su tipo
      for (const [section, sectionConfig] of Object.entries(config)) {
        const validator = this.validators.get(section);
        if (validator) {
          const sectionErrors = validator(sectionConfig);
          errors.push(...sectionErrors);
        }
      }

      // Validaciones personalizadas
      if (config.system?.maxMemory) {
        const memoryMB = this.parseMemorySize(config.system.maxMemory);
        if (memoryMB < 256) {
          errors.push('system.maxMemory debe ser al menos 256MB');
        }
      }

      // Validar dependencias entre configuraciones
      if (config.notifications?.email?.enabled && !String(config.notifications?.email?.smtp?.host || process.env.SMTP_HOST || '').trim()) {
        errors.push('SMTP host es requerido cuando las notificaciones por email están habilitadas');
      }

    } catch (error) {
      errors.push(`Error durante la validación: ${error.message}`);
    }

    return errors;
  }

  /**
   * Crear backup de configuración
   */
  async createBackup(key) {
    try {
      const config = this.configs.get(key);
      if (!config) return null;

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${key}-${timestamp}.json`;
      const backupPath = path.join(this.backupDir, backupName);

      const backupData = {
        key,
        config,
        timestamp: new Date().toISOString(),
        environment: this.currentEnvironment,
        version: config.version || '1.0.0'
      };

      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

      // Limpiar backups antiguos (mantener solo los últimos 20)
      await this.cleanupBackups(key, 20);

      return backupName;
    } catch (error) {
      console.error('[Config Manager] Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Crear versión de configuración
   */
  async createVersion(key, config, userId) {
    try {
      const versionId = this.generateVersionId();
      const timestamp = new Date().toISOString();

      const version = {
        id: versionId,
        key,
        config,
        userId,
        timestamp,
        environment: this.currentEnvironment,
        state: CONFIG_STATES.ACTIVE,
        checksum: this.calculateChecksum(config)
      };

      const versionPath = path.join(this.versionsDir, `${key}-${versionId}.json`);
      fs.writeFileSync(versionPath, JSON.stringify(version, null, 2));

      return version;
    } catch (error) {
      console.error('[Config Manager] Error creating version:', error);
      throw error;
    }
  }

  /**
   * Rollback a versión anterior
   */
  async rollbackToVersion(key, versionId, userId = 'system') {
    try {
      const versionPath = path.join(this.versionsDir, `${key}-${versionId}.json`);
      
      if (!fs.existsSync(versionPath)) {
        throw new Error(`Versión ${versionId} no encontrada`);
      }

      const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
      
      // Crear backup de la configuración actual
      await this.createBackup(key);

      // Aplicar configuración de la versión
      await this.setConfig(key, version.config, {
        validate: true,
        backup: false, // Ya creamos backup arriba
        notify: true,
        userId
      });

      // Marcar versión como rollback
      version.state = CONFIG_STATES.ROLLBACK;
      version.rolledBackAt = new Date().toISOString();
      version.rolledBackBy = userId;
      
      fs.writeFileSync(versionPath, JSON.stringify(version, null, 2));

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
        level: 'warning',
        details: {
          action: 'rollback',
          configKey: key,
          versionId,
          userId
        }
      });

      return version;
    } catch (error) {
      console.error('[Config Manager] Error during rollback:', error);
      throw error;
    }
  }

  /**
   * Guardar configuración en archivo
   */
  async saveConfiguration(key, config) {
    try {
      const configPath = path.join(this.configDir, `${key}.json`);
      const configData = {
        ...config,
        updatedAt: new Date().toISOString(),
        checksum: this.calculateChecksum(config)
      };

      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
    } catch (error) {
      console.error('[Config Manager] Error saving configuration:', error);
      throw error;
    }
  }

  /**
   * Obtener historial de versiones
   */
  getVersionHistory(key) {
    try {
      const versions = [];
      const files = fs.readdirSync(this.versionsDir)
        .filter(file => file.startsWith(`${key}-`) && file.endsWith('.json'));

      for (const file of files) {
        const versionPath = path.join(this.versionsDir, file);
        const version = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
        versions.push({
          id: version.id,
          timestamp: version.timestamp,
          userId: version.userId,
          state: version.state,
          checksum: version.checksum
        });
      }

      return versions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('[Config Manager] Error getting version history:', error);
      return [];
    }
  }

  /**
   * Obtener diferencias entre configuraciones
   */
  getConfigDiff(oldConfig, newConfig) {
    const changes = [];
    
    const compareObjects = (obj1, obj2, path = '') => {
      const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
      
      for (const key of keys) {
        const currentPath = path ? `${path}.${key}` : key;
        const oldValue = obj1?.[key];
        const newValue = obj2?.[key];
        
        if (oldValue !== newValue) {
          if (typeof oldValue === 'object' && typeof newValue === 'object' && 
              oldValue !== null && newValue !== null) {
            compareObjects(oldValue, newValue, currentPath);
          } else {
            changes.push({
              path: currentPath,
              oldValue,
              newValue,
              type: oldValue === undefined ? 'added' : 
                    newValue === undefined ? 'removed' : 'modified'
            });
          }
        }
      }
    };

    compareObjects(oldConfig, newConfig);
    return changes;
  }

  /**
   * Funciones de utilidad
   */
  generateVersionId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  calculateChecksum(config) {
    return crypto.createHash('md5').update(JSON.stringify(config)).digest('hex');
  }

  parseMemorySize(memoryStr) {
    const match = memoryStr.match(/^(\d+)(MB|GB)$/);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    return unit === 'GB' ? value * 1024 : value;
  }

  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  async cleanupBackups(key, maxBackups) {
    try {
      const backups = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith(`${key}-`) && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.statSync(path.join(this.backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (backups.length > maxBackups) {
        const toDelete = backups.slice(maxBackups);
        for (const backup of toDelete) {
          fs.unlinkSync(backup.path);
        }
      }
    } catch (error) {
      console.error('[Config Manager] Error cleaning up backups:', error);
    }
  }

  /**
   * Iniciar watcher de archivos de configuración
   */
  startConfigWatcher() {
    try {
      const watcher = fs.watch(this.configDir, { recursive: false }, (eventType, filename) => {
        if (filename && filename.endsWith('.json') && eventType === 'change') {
          console.log(`[Config Manager] Configuration file changed: ${filename}`);
          
          // Recargar configuración específica
          const configKey = path.basename(filename, '.json');
          this.reloadConfiguration(configKey);
        }
      });

      this.watchers.set('main', watcher);
      console.log('[Config Manager] File watcher started');
    } catch (error) {
      console.error('[Config Manager] Error starting file watcher:', error);
    }
  }

  async reloadConfiguration(key) {
    try {
      const configPath = path.join(this.configDir, `${key}.json`);
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        this.configs.set(key, config);
        
        console.log(`[Config Manager] Reloaded configuration: ${key}`);
        
        // Emitir evento de recarga
        this.emit?.('configReloaded', { key, config });
      }
    } catch (error) {
      console.error(`[Config Manager] Error reloading configuration ${key}:`, error);
    }
  }

  // Métodos públicos para gestión
  getAllConfigurations() {
    const configs = {};
    for (const [key, config] of this.configs) {
      configs[key] = config;
    }
    return configs;
  }

  getConfigurationKeys() {
    return Array.from(this.configs.keys());
  }

  async exportConfiguration(key, format = 'json') {
    const config = this.getConfig(key);
    if (!config) throw new Error(`Configuration ${key} not found`);

    switch (format) {
      case 'json':
        return JSON.stringify(config, null, 2);
      case 'yaml':
        // Implementar exportación YAML si es necesario
        throw new Error('YAML export not implemented yet');
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  async importConfiguration(key, data, format = 'json', userId = 'system') {
    let config;
    
    switch (format) {
      case 'json':
        config = typeof data === 'string' ? JSON.parse(data) : data;
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return await this.setConfig(key, config, { userId });
  }

  getStats() {
    return {
      totalConfigurations: this.configs.size,
      currentEnvironment: this.currentEnvironment,
      totalVersions: this.getTotalVersions(),
      totalBackups: this.getTotalBackups(),
      lastUpdate: this.getLastUpdateTime()
    };
  }

  getTotalVersions() {
    try {
      return fs.readdirSync(this.versionsDir).filter(f => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  getTotalBackups() {
    try {
      return fs.readdirSync(this.backupDir).filter(f => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  getLastUpdateTime() {
    let lastUpdate = null;
    
    for (const config of this.configs.values()) {
      if (config.updatedAt) {
        const updateTime = new Date(config.updatedAt);
        if (!lastUpdate || updateTime > lastUpdate) {
          lastUpdate = updateTime;
        }
      }
    }
    
    return lastUpdate?.toISOString();
  }
}

// Instancia singleton
const configManager = new ConfigManager();

export default configManager;
