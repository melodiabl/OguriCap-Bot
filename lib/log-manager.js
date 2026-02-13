// Sistema de Gestión de Logs Avanzado

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createWriteStream } from 'fs';
import { EventEmitter } from 'events';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import auditLogger, { AUDIT_EVENTS } from './audit-logger.js';
import notificationSystem, { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } from './notification-system.js';

// Niveles de log
export const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

// Categorías de logs
export const LOG_CATEGORIES = {
  SYSTEM: 'system',
  BOT: 'bot',
  API: 'api',
  DATABASE: 'database',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  USER: 'user',
  PLUGIN: 'plugin',
  NETWORK: 'network',
  ERROR: 'error'
};

// Tipos de rotación
export const ROTATION_TYPES = {
  SIZE: 'size',
  TIME: 'time',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly'
};

class LogManager extends EventEmitter {
  constructor() {
    super();
    
    // LogManager deshabilitado - solo mantener logs del index.js
    this.disabled = true;
    this.logsDir = path.join(process.cwd(), 'logs');
    this.archivedDir = path.join(this.logsDir, 'archived');
    this.currentStreams = new Map();
    this.rotationTimers = new Map();
    
    this.config = {
      level: LOG_LEVELS.ERROR, // Solo errores críticos
      enableConsole: false, // Deshabilitado
      enableFile: false, // Deshabilitado
      enableRemote: false,
      filters: []
    };
    
    this.buffer = [];
    this.stats = {
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      infoCount: 0,
      debugCount: 0,
      traceCount: 0,
      filesCreated: 0,
      filesRotated: 0,
      filesCompressed: 0,
      lastLogTime: null,
      startTime: Date.now()
    };
  }

  /**
   * Inicializar directorios necesarios
   */
  initializeDirectories() {
    const dirs = [
      this.logsDir,
      this.archivedDir,
      path.join(this.logsDir, 'system'),
      path.join(this.logsDir, 'bot'),
      path.join(this.logsDir, 'api'),
      path.join(this.logsDir, 'security'),
      path.join(this.logsDir, 'errors')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Configurar el log manager
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.setupRotationTimers();
    console.log('[Log Manager] Configuration updated');
    auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
      level: 'info',
      details: {
        action: 'log_manager_configured',
        config: this.config
      }
    });
  }

  /**
   * Escribir log
   */
  log(level, category, message, data = {}, options = {}) {
    if (this.disabled) return;
    try {
      if (level > this.config.level) return;
      if (!this.passesFilters(level, category, message, data)) return;
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        level: this.getLevelName(level),
        category,
        message,
        data,
        pid: process.pid,
        hostname: os.hostname(),
        ...options
      };
      if (level === LOG_LEVELS.ERROR && this.config.includeStackTrace) {
        const stack = new Error().stack;
        logEntry.stack = stack.split('\n').slice(2);
      }
      this.updateStats(level);
      this.stats.lastLogTime = timestamp;
      this.buffer.push(logEntry);
      if (this.config.enableConsole) this.logToConsole(logEntry);
      if (this.buffer.length >= this.config.bufferSize) this.flush();
      this.emit('log', logEntry);
      if (level === LOG_LEVELS.ERROR && data.critical) this.handleCriticalError(logEntry);
    } catch (error) {
      console.error('[Log Manager] Error writing log:', error);
    }
  }

  error(category, message, data = {}, options = {}) {
    if (this.disabled) return;
    this.log(LOG_LEVELS.ERROR, category, message, data, options);
  }

  warn(category, message, data = {}, options = {}) {
    if (this.disabled) return;
    this.log(LOG_LEVELS.WARN, category, message, data, options);
  }

  info(category, message, data = {}, options = {}) {
    if (this.disabled) return;
    this.log(LOG_LEVELS.INFO, category, message, data, options);
  }

  debug(category, message, data = {}, options = {}) {
    if (this.disabled) return;
    this.log(LOG_LEVELS.DEBUG, category, message, data, options);
  }

  trace(category, message, data = {}, options = {}) {
    this.log(LOG_LEVELS.TRACE, category, message, data, options);
  }

  async flush() {
    if (this.buffer.length === 0) return;
    const logsToWrite = [...this.buffer];
    this.buffer = [];
    try {
      const logsByCategory = {};
      for (const logEntry of logsToWrite) {
        const category = logEntry.category || 'general';
        if (!logsByCategory[category]) logsByCategory[category] = [];
        logsByCategory[category].push(logEntry);
      }
      for (const [category, logs] of Object.entries(logsByCategory)) {
        await this.writeLogsToFile(category, logs);
      }
      if (this.config.enableRemote && this.config.remoteEndpoint) {
        await this.sendLogsRemote(logsToWrite);
      }
    } catch (error) {
      console.error('[Log Manager] Error flushing logs:', error);
      this.buffer.unshift(...logsToWrite);
    }
  }

  async writeLogsToFile(category, logs) {
    try {
      const filename = this.getLogFilename(category);
      const filepath = path.join(this.logsDir, category, filename);
      if (await this.needsRotation(filepath)) await this.rotateLogFile(filepath);
      let stream = this.currentStreams.get(filepath);
      if (!stream) {
        stream = createWriteStream(filepath, { flags: 'a' });
        this.currentStreams.set(filepath, stream);
        this.stats.filesCreated++;
      }
      for (const logEntry of logs) {
        const formattedLog = this.formatLog(logEntry);
        stream.write(formattedLog + '\n');
      }
    } catch (error) {
      console.error(`[Log Manager] Error writing to file for category ${category}:`, error);
    }
  }

  formatLog(logEntry) {
    switch (this.config.format) {
      case 'json': return JSON.stringify(logEntry);
      case 'text': return `[${logEntry.timestamp}] ${logEntry.level.toUpperCase()} [${logEntry.category}] ${logEntry.message}`;
      case 'structured':
        const dataStr = Object.keys(logEntry.data).length > 0 ? ` | Data: ${JSON.stringify(logEntry.data)}` : '';
        return `${logEntry.timestamp} | ${logEntry.level.toUpperCase()} | ${logEntry.category} | ${logEntry.message}${dataStr}`;
      default: return JSON.stringify(logEntry);
    }
  }

  logToConsole(logEntry) {
    const colors = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', debug: '\x1b[35m', trace: '\x1b[37m', reset: '\x1b[0m' };
    const color = colors[logEntry.level] || colors.info;
    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
    console.log(`${color}[${timestamp}] ${logEntry.level.toUpperCase()} [${logEntry.category}]${colors.reset} ${logEntry.message}`);
    if (Object.keys(logEntry.data).length > 0) console.log(`${color}  Data:${colors.reset}`, logEntry.data);
    if (logEntry.stack) {
      console.log(`${colors.error}  Stack:${colors.reset}`);
      logEntry.stack.forEach(line => console.log(`    ${line}`));
    }
  }

  async needsRotation(filepath) {
    try {
      if (!fs.existsSync(filepath)) return false;
      const stats = fs.statSync(filepath);
      switch (this.config.rotation) {
        case ROTATION_TYPES.SIZE: return stats.size >= this.config.maxFileSize;
        case ROTATION_TYPES.DAILY: return new Date().toDateString() !== stats.mtime.toDateString();
        case ROTATION_TYPES.WEEKLY: return stats.mtime.getTime() < Date.now() - (7 * 24 * 60 * 60 * 1000);
        case ROTATION_TYPES.MONTHLY: return stats.mtime.getTime() < Date.now() - (30 * 24 * 60 * 60 * 1000);
        default: return false;
      }
    } catch { return false; }
  }

  passesFilters(level, category, message, data) {
    if (!this.config.filters) return true;
    for (const filter of this.config.filters) {
      if (typeof filter === 'function' && !filter(level, category, message, data)) return false;
    }
    return true;
  }

  async handleCriticalError(logEntry) {
    try {
      await notificationSystem.send({
        type: NOTIFICATION_TYPES.ERROR,
        title: '🚨 Error Crítico del Sistema',
        message: logEntry.message,
        category: NOTIFICATION_CATEGORIES.SYSTEM,
        data: logEntry.data
      });
    } catch (error) {
      console.error('[Log Manager] Error handling critical error:', error);
    }
  }

  getLevelName(level) {
    return Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level).toLowerCase();
  }

  updateStats(level) {
    this.stats.totalLogs++;
    switch (level) {
      case LOG_LEVELS.ERROR: this.stats.errorCount++; break;
      case LOG_LEVELS.WARN: this.stats.warnCount++; break;
      case LOG_LEVELS.INFO: this.stats.infoCount++; break;
      case LOG_LEVELS.DEBUG: this.stats.debugCount++; break;
      case LOG_LEVELS.TRACE: this.stats.traceCount++; break;
    }
  }

  async close() {
    await this.flush();
    for (const stream of this.currentStreams.values()) stream.end();
    this.currentStreams.clear();
  }
}

const logManager = new LogManager();
export default logManager;
