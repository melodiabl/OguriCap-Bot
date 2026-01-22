// Sistema de Backup Automático Avanzado

import fs from 'fs';
import path from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import crypto from 'crypto';
import auditLogger, { AUDIT_EVENTS } from './audit-logger.js';
import notificationSystem from './notification-system.js';

// Tipos de backup
export const BACKUP_TYPES = {
  FULL: 'full',
  INCREMENTAL: 'incremental',
  DIFFERENTIAL: 'differential',
  DATABASE_ONLY: 'database_only',
  MEDIA_ONLY: 'media_only',
  CONFIG_ONLY: 'config_only'
};

// Estados de backup
export const BACKUP_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CORRUPTED: 'corrupted',
  EXPIRED: 'expired'
};

// Estrategias de retención
export const RETENTION_STRATEGIES = {
  SIMPLE: 'simple', // Mantener X backups
  GFS: 'gfs', // Grandfather-Father-Son
  TOWER_OF_HANOI: 'tower_of_hanoi',
  CUSTOM: 'custom'
};

class BackupSystem {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
    this.tempDir = path.join(this.backupDir, 'temp');
    this.maxBackupSize = parseInt(process.env.MAX_BACKUP_SIZE || '100') * 1024 * 1024; // 100MB por defecto
    this.compressionLevel = parseInt(process.env.BACKUP_COMPRESSION_LEVEL || '6');
    this.encryptionEnabled = process.env.BACKUP_ENCRYPTION === 'true';
    this.encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || this.generateEncryptionKey();
    
    this.ensureDirectories();
    this.loadBackupHistory();
  }

  /**
   * Crea un backup completo del sistema
   */
  async createBackup(options = {}) {
    const backupId = this.generateBackupId();
    const startTime = Date.now();
    
    const backupConfig = {
      id: backupId,
      type: options.type || BACKUP_TYPES.FULL,
      timestamp: new Date().toISOString(),
      status: BACKUP_STATUS.RUNNING,
      includeDatabase: options.includeDatabase !== false,
      includeMedia: options.includeMedia || false,
      includeConfig: options.includeConfig !== false,
      includeLogs: options.includeLogs || false,
      compress: options.compress !== false,
      encrypt: options.encrypt || this.encryptionEnabled,
      description: options.description || '',
      tags: options.tags || [],
      metadata: {
        version: '1.0',
        creator: options.creator || 'system',
        nodeVersion: process.version,
        platform: process.platform
      }
    };

    try {
      // Notificar inicio
      await notificationSystem.send({
        type: 'info',
        title: 'Backup Iniciado',
        message: `Creando backup ${backupConfig.type}: ${backupId}`,
        category: 'system',
        data: { backupId, type: backupConfig.type }
      });

      // Crear estructura de backup
      const backupPath = path.join(this.backupDir, backupId);
      await fs.promises.mkdir(backupPath, { recursive: true });

      const manifest = {
        ...backupConfig,
        files: [],
        size: 0,
        checksum: null
      };

      // Backup de base de datos
      if (backupConfig.includeDatabase) {
        const dbBackup = await this.backupDatabase(backupPath, backupConfig);
        manifest.files.push(dbBackup);
        manifest.size += dbBackup.size;
      }

      // Backup de configuración
      if (backupConfig.includeConfig) {
        const configBackup = await this.backupConfiguration(backupPath, backupConfig);
        manifest.files.push(configBackup);
        manifest.size += configBackup.size;
      }

      // Backup de multimedia
      if (backupConfig.includeMedia) {
        const mediaBackup = await this.backupMedia(backupPath, backupConfig);
        if (mediaBackup) {
          manifest.files.push(mediaBackup);
          manifest.size += mediaBackup.size;
        }
      }

      // Backup de logs
      if (backupConfig.includeLogs) {
        const logsBackup = await this.backupLogs(backupPath, backupConfig);
        if (logsBackup) {
          manifest.files.push(logsBackup);
          manifest.size += logsBackup.size;
        }
      }

      // Verificar tamaño máximo
      if (manifest.size > this.maxBackupSize) {
        throw new Error(`Backup excede el tamaño máximo permitido: ${this.formatSize(manifest.size)} > ${this.formatSize(this.maxBackupSize)}`);
      }

      // Generar checksum del backup
      manifest.checksum = await this.generateBackupChecksum(backupPath);
      manifest.duration = Date.now() - startTime;
      manifest.status = BACKUP_STATUS.COMPLETED;
      manifest.completedAt = new Date().toISOString();

      // Guardar manifest
      const manifestPath = path.join(backupPath, 'manifest.json');
      await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      // Comprimir si está habilitado
      if (backupConfig.compress) {
        await this.compressBackup(backupPath, backupId);
      }

      // Encriptar si está habilitado
      if (backupConfig.encrypt) {
        await this.encryptBackup(backupPath, backupId);
      }

      // Guardar en historial
      await this.saveBackupToHistory(manifest);

      // Aplicar política de retención
      await this.applyRetentionPolicy();

      // Notificar éxito
      await notificationSystem.sendFromTemplate('backup_completed', { 
        backupId, 
        size: this.formatSize(manifest.size)
      });

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_BACKUP_CREATED, {
        level: 'info',
        details: {
          backupId,
          type: backupConfig.type,
          size: manifest.size,
          duration: manifest.duration,
          files: manifest.files.length,
          compressed: backupConfig.compress,
          encrypted: backupConfig.encrypt
        }
      });

      return manifest;

    } catch (error) {
      // Limpiar backup fallido
      const backupPath = path.join(this.backupDir, backupId);
      try {
        await fs.promises.rm(backupPath, { recursive: true, force: true });
      } catch {}

      // Notificar error
      await notificationSystem.sendFromTemplate('backup_failed', { 
        backupId, 
        error: error.message 
      });

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_BACKUP_CREATED, {
        level: 'error',
        details: {
          backupId,
          error: error.message,
          duration: Date.now() - startTime
        }
      });

      throw error;
    }
  }

  /**
   * Restaura un backup
   */
  async restoreBackup(backupId, options = {}) {
    const startTime = Date.now();
    
    try {
      const backupPath = path.join(this.backupDir, backupId);
      
      // Verificar que el backup existe
      if (!await this.backupExists(backupId)) {
        throw new Error(`Backup no encontrado: ${backupId}`);
      }

      // Cargar manifest
      const manifest = await this.loadBackupManifest(backupId);
      
      // Verificar integridad
      if (options.verifyIntegrity !== false) {
        const isValid = await this.verifyBackupIntegrity(backupId);
        if (!isValid) {
          throw new Error('El backup está corrupto o no es válido');
        }
      }

      // Notificar inicio
      await notificationSystem.sendFromTemplate('restore_started', { 
        backupId 
      });

      // Crear backup de seguridad antes de restaurar
      if (options.createSafetyBackup !== false) {
        await this.createBackup({
          type: BACKUP_TYPES.FULL,
          description: `Safety backup before restoring ${backupId}`,
          tags: ['safety', 'pre-restore']
        });
      }

      // Desencriptar si es necesario
      if (manifest.encrypt) {
        await this.decryptBackup(backupPath, backupId);
      }

      // Descomprimir si es necesario
      if (manifest.compress) {
        await this.decompressBackup(backupPath, backupId);
      }

      // Restaurar archivos según el tipo
      const restoredFiles = [];

      for (const fileInfo of manifest.files) {
        switch (fileInfo.type) {
          case 'database':
            if (options.restoreDatabase !== false) {
              await this.restoreDatabase(backupPath, fileInfo);
              restoredFiles.push(fileInfo);
            }
            break;
            
          case 'config':
            if (options.restoreConfig !== false) {
              await this.restoreConfiguration(backupPath, fileInfo);
              restoredFiles.push(fileInfo);
            }
            break;
            
          case 'media':
            if (options.restoreMedia !== false) {
              await this.restoreMedia(backupPath, fileInfo);
              restoredFiles.push(fileInfo);
            }
            break;
            
          case 'logs':
            if (options.restoreLogs !== false) {
              await this.restoreLogs(backupPath, fileInfo);
              restoredFiles.push(fileInfo);
            }
            break;
        }
      }

      const duration = Date.now() - startTime;

      // Notificar éxito
      await notificationSystem.sendFromTemplate('restore_completed', { 
        backupId,
        restoredFiles: restoredFiles.length
      });

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_BACKUP_RESTORED, {
        level: 'info',
        details: {
          backupId,
          duration,
          restoredFiles: restoredFiles.length,
          originalSize: manifest.size,
          originalDate: manifest.timestamp
        }
      });

      return {
        backupId,
        restoredFiles: restoredFiles.length,
        duration,
        manifest
      };

    } catch (error) {
      // Notificar error
      await notificationSystem.sendFromTemplate('restore_failed', { 
        backupId, 
        error: error.message 
      });

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_BACKUP_RESTORED, {
        level: 'error',
        details: {
          backupId,
          error: error.message,
          duration: Date.now() - startTime
        }
      });

      throw error;
    }
  }

  /**
   * Funciones específicas de backup
   */
  async backupDatabase(backupPath, config) {
    if (typeof global.loadDatabase === 'function') await global.loadDatabase();
    
    const dbData = global.db?.data || {};
    const fileName = 'database.json';
    const filePath = path.join(backupPath, fileName);
    
    const jsonData = JSON.stringify(dbData, null, 2);
    await fs.promises.writeFile(filePath, jsonData);
    
    const stats = await fs.promises.stat(filePath);
    
    return {
      type: 'database',
      name: fileName,
      path: filePath,
      size: stats.size,
      checksum: await this.calculateFileChecksum(filePath),
      timestamp: new Date().toISOString()
    };
  }

  async backupConfiguration(backupPath, config) {
    const configFiles = [
      'settings.js',
      'package.json',
      '.env'
    ];
    
    const configDir = path.join(backupPath, 'config');
    await fs.promises.mkdir(configDir, { recursive: true });
    
    let totalSize = 0;
    const files = [];
    
    for (const configFile of configFiles) {
      const sourcePath = path.join(process.cwd(), configFile);
      const destPath = path.join(configDir, configFile);
      
      try {
        if (await this.fileExists(sourcePath)) {
          await fs.promises.copyFile(sourcePath, destPath);
          const stats = await fs.promises.stat(destPath);
          totalSize += stats.size;
          files.push(configFile);
        }
      } catch (error) {
        console.warn(`No se pudo respaldar ${configFile}:`, error.message);
      }
    }
    
    return {
      type: 'config',
      name: 'config',
      path: configDir,
      size: totalSize,
      files,
      timestamp: new Date().toISOString()
    };
  }

  async backupMedia(backupPath, config) {
    const mediaDir = path.join(process.cwd(), 'storage');
    
    if (!await this.fileExists(mediaDir)) {
      return null;
    }
    
    const backupMediaDir = path.join(backupPath, 'media');
    await this.copyDirectory(mediaDir, backupMediaDir);
    
    const size = await this.getDirectorySize(backupMediaDir);
    
    return {
      type: 'media',
      name: 'media',
      path: backupMediaDir,
      size,
      timestamp: new Date().toISOString()
    };
  }

  async backupLogs(backupPath, config) {
    if (typeof global.loadDatabase === 'function') await global.loadDatabase();
    
    const panelDb = global.db?.data?.panel;
    if (!panelDb?.logs && !panelDb?.auditLogs) {
      return null;
    }
    
    const logsData = {
      logs: panelDb.logs || [],
      auditLogs: panelDb.auditLogs || [],
      exportedAt: new Date().toISOString()
    };
    
    const fileName = 'logs.json';
    const filePath = path.join(backupPath, fileName);
    
    const jsonData = JSON.stringify(logsData, null, 2);
    await fs.promises.writeFile(filePath, jsonData);
    
    const stats = await fs.promises.stat(filePath);
    
    return {
      type: 'logs',
      name: fileName,
      path: filePath,
      size: stats.size,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Funciones de restauración
   */
  async restoreDatabase(backupPath, fileInfo) {
    const filePath = path.join(backupPath, fileInfo.name);
    const jsonData = await fs.promises.readFile(filePath, 'utf8');
    const dbData = JSON.parse(jsonData);
    
    // Hacer backup de la base de datos actual
    if (global.db?.data) {
      const currentBackup = JSON.stringify(global.db.data);
      const backupFile = path.join(this.tempDir, `db-backup-${Date.now()}.json`);
      await fs.promises.writeFile(backupFile, currentBackup);
    }
    
    // Restaurar datos
    if (global.db) {
      global.db.data = dbData;
      if (typeof global.db.write === 'function') {
        await global.db.write();
      }
    }
  }

  async restoreConfiguration(backupPath, fileInfo) {
    const configDir = path.join(backupPath, 'config');
    
    for (const fileName of fileInfo.files || []) {
      const sourcePath = path.join(configDir, fileName);
      const destPath = path.join(process.cwd(), fileName);
      
      // Hacer backup del archivo actual
      if (await this.fileExists(destPath)) {
        const backupFile = path.join(this.tempDir, `${fileName}-backup-${Date.now()}`);
        await fs.promises.copyFile(destPath, backupFile);
      }
      
      // Restaurar archivo
      await fs.promises.copyFile(sourcePath, destPath);
    }
  }

  async restoreMedia(backupPath, fileInfo) {
    const sourceDir = path.join(backupPath, 'media');
    const destDir = path.join(process.cwd(), 'storage');
    
    // Hacer backup del directorio actual
    if (await this.fileExists(destDir)) {
      const backupDir = path.join(this.tempDir, `media-backup-${Date.now()}`);
      await this.copyDirectory(destDir, backupDir);
    }
    
    // Restaurar directorio
    await this.copyDirectory(sourceDir, destDir);
  }

  async restoreLogs(backupPath, fileInfo) {
    const filePath = path.join(backupPath, fileInfo.name);
    const jsonData = await fs.promises.readFile(filePath, 'utf8');
    const logsData = JSON.parse(jsonData);
    
    if (typeof global.loadDatabase === 'function') await global.loadDatabase();
    
    const panelDb = global.db?.data?.panel;
    if (panelDb) {
      panelDb.logs = logsData.logs || [];
      panelDb.auditLogs = logsData.auditLogs || [];
    }
  }

  /**
   * Funciones de utilidad
   */
  generateBackupId() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = crypto.randomBytes(4).toString('hex');
    return `backup-${timestamp}-${random}`;
  }

  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  async calculateFileChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  async generateBackupChecksum(backupPath) {
    const files = await this.getAllFiles(backupPath);
    const hash = crypto.createHash('sha256');
    
    for (const file of files.sort()) {
      const fileHash = await this.calculateFileChecksum(file);
      hash.update(fileHash);
    }
    
    return hash.digest('hex');
  }

  async compressBackup(backupPath, backupId) {
    try {
      // Importar archiver dinámicamente
      const archiver = await import('archiver').catch(() => null);
      
      if (!archiver) {
        console.warn('Archiver not available, skipping compression');
        return;
      }

      const archivePath = `${backupPath}.tar.gz`;
      const output = fs.createWriteStream(archivePath);
      const archive = archiver.default('tar', {
        gzip: true,
        gzipOptions: {
          level: 6,
          memLevel: 6
        }
      });

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          console.log(`Backup compressed: ${archivePath} (${archive.pointer()} bytes)`);
          
          // Eliminar directorio original después de comprimir
          fs.rmSync(backupPath, { recursive: true, force: true });
          resolve();
        });

        output.on('error', reject);
        archive.on('error', reject);

        archive.pipe(output);
        archive.directory(backupPath, false);
        archive.finalize();
      });

    } catch (error) {
      console.error('Error compressing backup:', error);
      throw error;
    }
  }

  async encryptBackup(backupPath, backupId) {
    // Implementar encriptación
    console.log(`Encrypting backup ${backupId}`);
  }

  formatSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  async fileExists(filePath) {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async copyDirectory(source, dest) {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  async getDirectorySize(dirPath) {
    let size = 0;
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        size += await this.getDirectorySize(fullPath);
      } else {
        const stats = await fs.promises.stat(fullPath);
        size += stats.size;
      }
    }
    
    return size;
  }

  async getAllFiles(dirPath) {
    const files = [];
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...await this.getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  ensureDirectories() {
    [this.backupDir, this.tempDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  async backupExists(backupId) {
    const backupPath = path.join(this.backupDir, backupId);
    return await this.fileExists(backupPath);
  }

  async loadBackupManifest(backupId) {
    const manifestPath = path.join(this.backupDir, backupId, 'manifest.json');
    const data = await fs.promises.readFile(manifestPath, 'utf8');
    return JSON.parse(data);
  }

  async verifyBackupIntegrity(backupId) {
    try {
      const manifest = await this.loadBackupManifest(backupId);
      const backupPath = path.join(this.backupDir, backupId);
      const currentChecksum = await this.generateBackupChecksum(backupPath);
      
      return currentChecksum === manifest.checksum;
    } catch {
      return false;
    }
  }

  async saveBackupToHistory(manifest) {
    // Implementar guardado en historial
    console.log('Saving backup to history:', manifest.id);
  }

  async loadBackupHistory() {
    // Implementar carga de historial
    console.log('Loading backup history');
  }

  async applyRetentionPolicy() {
    // Implementar política de retención
    console.log('Applying retention policy');
  }

  // Métodos públicos para gestión
  async listBackups() {
    const backups = [];
    const entries = await fs.promises.readdir(this.backupDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('backup-')) {
        try {
          const manifest = await this.loadBackupManifest(entry.name);
          backups.push(manifest);
        } catch {
          // Backup corrupto o incompleto
        }
      }
    }
    
    return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async deleteBackup(backupId) {
    const backupPath = path.join(this.backupDir, backupId);
    await fs.promises.rm(backupPath, { recursive: true, force: true });
    
    await auditLogger.log(AUDIT_EVENTS.SYSTEM_BACKUP_CREATED, {
      level: 'info',
      details: {
        action: 'backup_deleted',
        backupId
      }
    });
  }

  async getBackupStats() {
    const backups = await this.listBackups();
    const totalSize = backups.reduce((sum, backup) => sum + (backup.size || 0), 0);
    
    return {
      total: backups.length,
      totalSize,
      oldestBackup: backups[backups.length - 1]?.timestamp,
      newestBackup: backups[0]?.timestamp,
      byType: this.groupBy(backups, 'type'),
      byStatus: this.groupBy(backups, 'status')
    };
  }

  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const group = item[key] || 'unknown';
      groups[group] = (groups[group] || 0) + 1;
      return groups;
    }, {});
  }
}

// Instancia singleton
const backupSystem = new BackupSystem();

export default backupSystem;