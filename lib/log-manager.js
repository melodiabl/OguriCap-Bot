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
      level: LOG_LEVELS.DEBUG, // Habilitar debug
      enableConsole: true, // Habilitar consola
      enableFile: false,
      enableRemote: false,
      filters: []
    };
    this.disabled = false; // Habilitar el manager
    
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
    
    // No inicializar nada para evitar logs adicionales
    // console.log('[Log Manager] Disabled - Only index.js logs will show');
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
    
    // Reiniciar timers si es necesario
    this.setupRotationTimers();
    
    console.log('[Log Manager] Configuration updated');
    
    // Log de auditoría
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
    // LogManager deshabilitado - no procesar logs
    if (this.disabled) return;
    
    try {
      // Verificar nivel de log
      if (level > this.config.level) return;

      // Verificar filtros
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

      // Agregar stack trace si es error y está habilitado
      if (level === LOG_LEVELS.ERROR && this.config.includeStackTrace) {
        const stack = new Error().stack;
        logEntry.stack = stack.split('\n').slice(2); // Remover las primeras 2 líneas
      }

      // Actualizar estadísticas
      this.updateStats(level);
      this.stats.lastLogTime = timestamp;

      // Agregar al buffer
      this.buffer.push(logEntry);

      // Log a consola si está habilitado
      if (this.config.enableConsole) {
        this.logToConsole(logEntry);
      }

      // Flush si el buffer está lleno
      if (this.buffer.length >= this.config.bufferSize) {
        this.flush();
      }

      // Emitir evento
      this.emit('log', logEntry);

      // Verificar si es un error crítico
      if (level === LOG_LEVELS.ERROR && data.critical) {
        this.handleCriticalError(logEntry);
      }

    } catch (error) {
      console.error('[Log Manager] Error writing log:', error);
    }
  }

  /**
   * Métodos de conveniencia para diferentes niveles
   */
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

  /**
   * Flush del buffer a archivos
   */
  async flush() {
    if (this.buffer.length === 0) return;

    const logsToWrite = [...this.buffer];
    this.buffer = [];

    try {
      // Agrupar logs por categoría
      const logsByCategory = {};
      
      for (const logEntry of logsToWrite) {
        const category = logEntry.category || 'general';
        if (!logsByCategory[category]) {
          logsByCategory[category] = [];
        }
        logsByCategory[category].push(logEntry);
      }

      // Escribir cada categoría a su archivo
      for (const [category, logs] of Object.entries(logsByCategory)) {
        await this.writeLogsToFile(category, logs);
      }

      // Enviar logs remotos si está habilitado
      if (this.config.enableRemote && this.config.remoteEndpoint) {
        await this.sendLogsRemote(logsToWrite);
      }

    } catch (error) {
      console.error('[Log Manager] Error flushing logs:', error);
      // Devolver logs al buffer si falló
      this.buffer.unshift(...logsToWrite);
    }
  }

  /**
   * Escribir logs a archivo
   */
  async writeLogsToFile(category, logs) {
    try {
      const filename = this.getLogFilename(category);
      const filepath = path.join(this.logsDir, category, filename);
      
      // Verificar si necesita rotación
      if (await this.needsRotation(filepath)) {
        await this.rotateLogFile(filepath);
      }

      // Obtener o crear stream
      let stream = this.currentStreams.get(filepath);
      if (!stream) {
        stream = createWriteStream(filepath, { flags: 'a' });
        this.currentStreams.set(filepath, stream);
        this.stats.filesCreated++;
      }

      // Escribir logs
      for (const logEntry of logs) {
        const formattedLog = this.formatLog(logEntry);
        stream.write(formattedLog + '\n');
      }

    } catch (error) {
      console.error(`[Log Manager] Error writing to file for category ${category}:`, error);
    }
  }

  /**
   * Formatear log según configuración
   */
  formatLog(logEntry) {
    switch (this.config.format) {
      case 'json':
        return JSON.stringify(logEntry);
        
      case 'text':
        return `[${logEntry.timestamp}] ${logEntry.level.toUpperCase()} [${logEntry.category}] ${logEntry.message}`;
        
      case 'structured':
        const dataStr = Object.keys(logEntry.data).length > 0 ? 
          ` | Data: ${JSON.stringify(logEntry.data)}` : '';
        return `${logEntry.timestamp} | ${logEntry.level.toUpperCase()} | ${logEntry.category} | ${logEntry.message}${dataStr}`;
        
      default:
        return JSON.stringify(logEntry);
    }
  }

  /**
   * Log a consola con colores
   */
  logToConsole(logEntry) {
    const colors = {
      error: '\x1b[31m',   // Rojo
      warn: '\x1b[33m',    // Amarillo
      info: '\x1b[36m',    // Cian
      debug: '\x1b[35m',   // Magenta
      trace: '\x1b[37m',   // Blanco
      reset: '\x1b[0m'
    };

    const color = colors[logEntry.level] || colors.info;
    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
    
    console.log(
      `${color}[${timestamp}] ${logEntry.level.toUpperCase()} [${logEntry.category}]${colors.reset} ${logEntry.message}`
    );

    // Mostrar datos adicionales si existen
    if (Object.keys(logEntry.data).length > 0) {
      console.log(`${color}  Data:${colors.reset}`, logEntry.data);
    }

    // Mostrar stack trace si existe
    if (logEntry.stack) {
      console.log(`${colors.error}  Stack:${colors.reset}`);
      logEntry.stack.forEach(line => console.log(`    ${line}`));
    }
  }

  /**
   * Verificar si necesita rotación
   */
  async needsRotation(filepath) {
    try {
      if (!fs.existsSync(filepath)) return false;

      const stats = fs.statSync(filepath);
      
      switch (this.config.rotation) {
        case ROTATION_TYPES.SIZE:
          return stats.size >= this.config.maxFileSize;
          
        case ROTATION_TYPES.DAILY:
          const today = new Date().toDateString();
          const fileDate = stats.mtime.toDateString();
          return today !== fileDate;
          
        case ROTATION_TYPES.WEEKLY:
          const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
          return stats.mtime.getTime() < weekAgo;
          
        case ROTATION_TYPES.MONTHLY:
          const monthAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
          return stats.mtime.getTime() < monthAgo;
          
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Rotar archivo de log
   */
  async rotateLogFile(filepath) {
    try {
      // Cerrar stream actual si existe
      const stream = this.currentStreams.get(filepath);
      if (stream) {
        stream.end();
        this.currentStreams.delete(filepath);
      }

      // Generar nombre del archivo archivado
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const ext = path.extname(filepath);
      const basename = path.basename(filepath, ext);
      const dirname = path.dirname(filepath);
      
      const archivedName = `${basename}-${timestamp}${ext}`;
      const archivedPath = path.join(this.archivedDir, archivedName);

      // Mover archivo actual a archivado
      fs.renameSync(filepath, archivedPath);
      this.stats.filesRotated++;

      // Comprimir si está habilitado
      if (this.config.compress) {
        await this.compressLogFile(archivedPath);
      }

      console.log(`[Log Manager] Rotated log file: ${filepath} -> ${archivedPath}`);

      // Emitir evento
      this.emit('fileRotated', { original: filepath, archived: archivedPath });

    } catch (error) {
      console.error('[Log Manager] Error rotating log file:', error);
    }
  }

  /**
   * Comprimir archivo de log
   */
  async compressLogFile(filepath) {
    try {
      const gzipPath = filepath + '.gz';
      const readStream = fs.createReadStream(filepath);
      const writeStream = createWriteStream(gzipPath);
      const gzipStream = createGzip();

      await pipeline(readStream, gzipStream, writeStream);

      // Eliminar archivo original
      fs.unlinkSync(filepath);
      this.stats.filesCompressed++;

      console.log(`[Log Manager] Compressed log file: ${filepath} -> ${gzipPath}`);

    } catch (error) {
      console.error('[Log Manager] Error compressing log file:', error);
    }
  }

  /**
   * Obtener nombre de archivo de log
   */
  getLogFilename(category) {
    const date = new Date();
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    return `${category}-${dateStr}.log`;
  }

  /**
   * Obtener nombre del nivel
   */
  getLevelName(level) {
    const names = ['error', 'warn', 'info', 'debug', 'trace'];
    return names[level] || 'unknown';
  }

  /**
   * Actualizar estadísticas
   */
  updateStats(level) {
    this.stats.totalLogs++;
    
    switch (level) {
      case LOG_LEVELS.ERROR:
        this.stats.errorCount++;
        break;
      case LOG_LEVELS.WARN:
        this.stats.warnCount++;
        break;
      case LOG_LEVELS.INFO:
        this.stats.infoCount++;
        break;
      case LOG_LEVELS.DEBUG:
        this.stats.debugCount++;
        break;
      case LOG_LEVELS.TRACE:
        this.stats.traceCount++;
        break;
    }
  }

  /**
   * Verificar filtros
   */
  passesFilters(level, category, message, data) {
    for (const filter of this.config.filters) {
      if (typeof filter === 'function') {
        if (!filter(level, category, message, data)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Manejar error crítico
   */
  async handleCriticalError(logEntry) {
    try {
      // Enviar notificación inmediata
      await notificationSystem.send({
        type: NOTIFICATION_TYPES.ERROR,
        title: '🚨 Error Crítico del Sistema',
        message: logEntry.message,
        category: NOTIFICATION_CATEGORIES.SYSTEM,
        data: {
          level: logEntry.level,
          category: logEntry.category,
          timestamp: logEntry.timestamp,
          ...logEntry.data
        },
        urgent: true
      });

      // Flush inmediato
      await this.flush();

    } catch (error) {
      console.error('[Log Manager] Error handling critical error:', error);
    }
  }

  /**
   * Enviar logs a endpoint remoto
   */
  async sendLogsRemote(logs) {
    try {
      if (!this.config.remoteEndpoint) return;

      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LOG_REMOTE_TOKEN || ''}`
        },
        body: JSON.stringify({
          source: 'whatsapp-bot-panel',
          hostname: os.hostname(),
          logs
        })
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.status}`);
      }

    } catch (error) {
      console.error('[Log Manager] Error sending logs to remote endpoint:', error);
    }
  }

  /**
   * Configurar timers de rotación
   */
  setupRotationTimers() {
    // Limpiar timers existentes
    for (const timer of this.rotationTimers.values()) {
      clearInterval(timer);
    }
    this.rotationTimers.clear();

    if (this.config.rotation === ROTATION_TYPES.DAILY) {
      // Timer para rotación diaria a medianoche
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const msUntilMidnight = tomorrow.getTime() - now.getTime();
      
      setTimeout(() => {
        this.rotateAllFiles();
        
        // Configurar timer diario
        const dailyTimer = setInterval(() => {
          this.rotateAllFiles();
        }, 24 * 60 * 60 * 1000);
        
        this.rotationTimers.set('daily', dailyTimer);
      }, msUntilMidnight);
    }
  }

  /**
   * Rotar todos los archivos
   */
  async rotateAllFiles() {
    try {
      // Flush primero
      await this.flush();

      // Cerrar todos los streams
      for (const [filepath, stream] of this.currentStreams) {
        stream.end();
      }
      this.currentStreams.clear();

      console.log('[Log Manager] Rotated all log files');

    } catch (error) {
      console.error('[Log Manager] Error rotating all files:', error);
    }
  }

  /**
   * Iniciar timer de flush
   */
  startFlushTimer() {
    setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }

  /**
   * Iniciar timer de limpieza
   */
  startCleanupTimer() {
    // Ejecutar limpieza cada 6 horas
    setInterval(() => {
      this.cleanup();
    }, 6 * 60 * 60 * 1000);

    // Ejecutar limpieza inicial después de 1 minuto
    setTimeout(() => {
      this.cleanup();
    }, 60 * 1000);
  }

  /**
   * Limpiar archivos antiguos
   */
  async cleanup() {
    if (!this.config.retention.autoCleanup) return;

    try {
      const retentionMs = this.config.retention.days * 24 * 60 * 60 * 1000;
      const cutoffTime = Date.now() - retentionMs;

      // Limpiar archivos archivados
      const archivedFiles = fs.readdirSync(this.archivedDir);
      let deletedCount = 0;

      for (const file of archivedFiles) {
        const filepath = path.join(this.archivedDir, file);
        const stats = fs.statSync(filepath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`[Log Manager] Cleaned up ${deletedCount} old log files`);
      }

    } catch (error) {
      console.error('[Log Manager] Error during cleanup:', error);
    }
  }

  /**
   * Buscar logs
   */
  async searchLogs(query, options = {}) {
    const {
      category = null,
      level = null,
      startDate = null,
      endDate = null,
      limit = 1000,
      includeArchived = false
    } = options;

    try {
      const results = [];
      const searchDirs = [this.logsDir];
      
      if (includeArchived) {
        searchDirs.push(this.archivedDir);
      }

      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        
        const files = this.getLogFiles(dir, category);
        
        for (const file of files) {
          const logs = await this.readLogFile(file);
          
          for (const log of logs) {
            if (this.matchesSearchCriteria(log, query, level, startDate, endDate)) {
              results.push(log);
              
              if (results.length >= limit) {
                return results;
              }
            }
          }
        }
      }

      return results;

    } catch (error) {
      console.error('[Log Manager] Error searching logs:', error);
      return [];
    }
  }

  /**
   * Obtener archivos de log
   */
  getLogFiles(dir, category = null) {
    const files = [];
    
    try {
      if (category) {
        const categoryDir = path.join(dir, category);
        if (fs.existsSync(categoryDir)) {
          const categoryFiles = fs.readdirSync(categoryDir)
            .filter(f => f.endsWith('.log') || f.endsWith('.log.gz'))
            .map(f => path.join(categoryDir, f));
          files.push(...categoryFiles);
        }
      } else {
        // Buscar en todas las categorías
        const subdirs = fs.readdirSync(dir, { withFileTypes: true })
          .filter(d => d.isDirectory())
          .map(d => d.name);
        
        for (const subdir of subdirs) {
          const subdirPath = path.join(dir, subdir);
          const subdirFiles = fs.readdirSync(subdirPath)
            .filter(f => f.endsWith('.log') || f.endsWith('.log.gz'))
            .map(f => path.join(subdirPath, f));
          files.push(...subdirFiles);
        }
      }
    } catch (error) {
      console.error('[Log Manager] Error getting log files:', error);
    }

    return files.sort((a, b) => {
      try {
        const statsA = fs.statSync(a);
        const statsB = fs.statSync(b);
        return statsB.mtime.getTime() - statsA.mtime.getTime(); // Más recientes primero
      } catch {
        return 0;
      }
    });
  }

  /**
   * Leer archivo de log
   */
  async readLogFile(filepath) {
    try {
      let content;
      
      if (filepath.endsWith('.gz')) {
        // Descomprimir archivo
        const { createGunzip } = await import('zlib');
        const readStream = fs.createReadStream(filepath);
        const gunzipStream = createGunzip();
        
        const chunks = [];
        await pipeline(
          readStream,
          gunzipStream,
          async function* (source) {
            for await (const chunk of source) {
              chunks.push(chunk);
            }
          }
        );
        
        content = Buffer.concat(chunks).toString('utf8');
      } else {
        content = fs.readFileSync(filepath, 'utf8');
      }

      // Parsear líneas de log
      const lines = content.split('\n').filter(line => line.trim());
      const logs = [];

      for (const line of lines) {
        try {
          if (this.config.format === 'json') {
            logs.push(JSON.parse(line));
          } else {
            // Parsear formato de texto (básico)
            logs.push({ raw: line, message: line });
          }
        } catch (error) {
          // Línea malformada, agregar como texto plano
          logs.push({ raw: line, message: line });
        }
      }

      return logs;

    } catch (error) {
      console.error(`[Log Manager] Error reading log file ${filepath}:`, error);
      return [];
    }
  }

  /**
   * Verificar criterios de búsqueda
   */
  matchesSearchCriteria(log, query, level, startDate, endDate) {
    // Verificar query de texto
    if (query) {
      const searchText = (log.message || log.raw || '').toLowerCase();
      if (!searchText.includes(query.toLowerCase())) {
        return false;
      }
    }

    // Verificar nivel
    if (level && log.level !== level) {
      return false;
    }

    // Verificar rango de fechas
    if (startDate || endDate) {
      const logTime = new Date(log.timestamp || 0).getTime();
      
      if (startDate && logTime < new Date(startDate).getTime()) {
        return false;
      }
      
      if (endDate && logTime > new Date(endDate).getTime()) {
        return false;
      }
    }

    return true;
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    const uptime = Date.now() - this.stats.startTime;
    
    return {
      ...this.stats,
      uptime,
      bufferSize: this.buffer.length,
      activeStreams: this.currentStreams.size,
      config: this.config,
      diskUsage: this.getDiskUsage()
    };
  }

  /**
   * Obtener uso de disco de logs
   */
  getDiskUsage() {
    try {
      let totalSize = 0;
      let fileCount = 0;

      const calculateDirSize = (dir) => {
        if (!fs.existsSync(dir)) return;
        
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          
          if (item.isDirectory()) {
            calculateDirSize(itemPath);
          } else {
            const stats = fs.statSync(itemPath);
            totalSize += stats.size;
            fileCount++;
          }
        }
      };

      calculateDirSize(this.logsDir);

      return {
        totalSize,
        fileCount,
        formattedSize: this.formatBytes(totalSize)
      };

    } catch (error) {
      return { totalSize: 0, fileCount: 0, formattedSize: '0 B' };
    }
  }

  /**
   * Formatear bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Exportar logs
   */
  async exportLogs(options = {}) {
    const {
      format = 'json',
      category = null,
      startDate = null,
      endDate = null,
      includeArchived = true
    } = options;

    try {
      const logs = await this.searchLogs('', {
        category,
        startDate,
        endDate,
        includeArchived,
        limit: 10000
      });

      switch (format) {
        case 'json':
          return JSON.stringify(logs, null, 2);
          
        case 'csv':
          return this.convertLogsToCSV(logs);
          
        case 'txt':
          return logs.map(log => 
            `[${log.timestamp}] ${log.level?.toUpperCase()} [${log.category}] ${log.message}`
          ).join('\n');
          
        default:
          return JSON.stringify(logs, null, 2);
      }

    } catch (error) {
      console.error('[Log Manager] Error exporting logs:', error);
      throw error;
    }
  }

  /**
   * Convertir logs a CSV
   */
  convertLogsToCSV(logs) {
    if (logs.length === 0) return '';

    const headers = ['timestamp', 'level', 'category', 'message', 'data'];
    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.timestamp || '',
        log.level || '',
        log.category || '',
        `"${(log.message || '').replace(/"/g, '""')}"`,
        `"${JSON.stringify(log.data || {}).replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Limpiar todos los logs
   */
  async clearAllLogs() {
    try {
      // Flush y cerrar streams actuales
      await this.flush();
      
      for (const stream of this.currentStreams.values()) {
        stream.end();
      }
      this.currentStreams.clear();

      // Eliminar archivos de logs actuales
      const deleteDirectory = (dir) => {
        if (!fs.existsSync(dir)) return;
        
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          
          if (item.isDirectory()) {
            deleteDirectory(itemPath);
            fs.rmdirSync(itemPath);
          } else {
            fs.unlinkSync(itemPath);
          }
        }
      };

      // Limpiar logs actuales (mantener estructura de directorios)
      const categories = ['system', 'bot', 'api', 'security', 'errors'];
      for (const category of categories) {
        const categoryDir = path.join(this.logsDir, category);
        if (fs.existsSync(categoryDir)) {
          const files = fs.readdirSync(categoryDir);
          for (const file of files) {
            fs.unlinkSync(path.join(categoryDir, file));
          }
        }
      }

      // Limpiar archivos archivados
      if (fs.existsSync(this.archivedDir)) {
        const archivedFiles = fs.readdirSync(this.archivedDir);
        for (const file of archivedFiles) {
          fs.unlinkSync(path.join(this.archivedDir, file));
        }
      }

      // Resetear estadísticas
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

      console.log('[Log Manager] All logs cleared');

      // Log de auditoría
      auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
        level: 'warning',
        details: {
          action: 'clear_all_logs',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('[Log Manager] Error clearing logs:', error);
      throw error;
    }
  }

  /**
   * Cerrar log manager
   */
  async close() {
    try {
      // Flush final
      await this.flush();

      // Cerrar todos los streams
      for (const stream of this.currentStreams.values()) {
        stream.end();
      }
      this.currentStreams.clear();

      // Limpiar timers
      for (const timer of this.rotationTimers.values()) {
        clearInterval(timer);
      }
      this.rotationTimers.clear();

      console.log('[Log Manager] Closed');

    } catch (error) {
      console.error('[Log Manager] Error closing:', error);
    }
  }
}

// Instancia singleton
const logManager = new LogManager();

// Interceptar console.log, console.error, etc.
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug
};

// TEMPORALMENTE DESHABILITADO - Sobrescribir métodos de console para capturar logs
// Esto estaba causando bucles infinitos y spam de logs
/*
console.log = (...args) => {
  originalConsole.log(...args);
  logManager.info(LOG_CATEGORIES.SYSTEM, args.join(' '));
};

console.error = (...args) => {
  originalConsole.error(...args);
  logManager.error(LOG_CATEGORIES.ERROR, args.join(' '));
};

console.warn = (...args) => {
  originalConsole.warn(...args);
  logManager.warn(LOG_CATEGORIES.SYSTEM, args.join(' '));
};

console.info = (...args) => {
  originalConsole.info(...args);
  logManager.info(LOG_CATEGORIES.SYSTEM, args.join(' '));
};
*/

// Manejar cierre del proceso
process.on('SIGINT', async () => {
  await logManager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await logManager.close();
  process.exit(0);
});

export default logManager;