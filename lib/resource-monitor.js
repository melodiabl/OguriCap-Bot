// Sistema de Monitoreo de Recursos en Tiempo Real

import os from 'os';
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import auditLogger, { AUDIT_EVENTS } from './audit-logger.js';
import notificationSystem, { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } from './notification-system.js';

// Umbrales de alerta por defecto
const DEFAULT_THRESHOLDS = {
  cpu: {
    warning: 70,    // 70% CPU
    critical: 90    // 90% CPU
  },
  memory: {
    warning: 80,    // 80% RAM
    critical: 95    // 95% RAM
  },
  disk: {
    warning: 85,    // 85% disco
    critical: 95    // 95% disco
  },
  temperature: {
    warning: 70,    // 70°C
    critical: 85    // 85°C
  }
};

// Estados de alerta
const ALERT_STATES = {
  NORMAL: 'normal',
  WARNING: 'warning',
  CRITICAL: 'critical'
};

class ResourceMonitor extends EventEmitter {
  constructor() {
    super();
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.updateInterval = 5000; // 5 segundos por defecto
    
    this.thresholds = { ...DEFAULT_THRESHOLDS };
    this.currentMetrics = {};
    this.historicalData = [];
    this.maxHistorySize = 1440; // 24 horas con intervalos de 1 minuto
    
    this.alertStates = {
      cpu: ALERT_STATES.NORMAL,
      memory: ALERT_STATES.NORMAL,
      disk: ALERT_STATES.NORMAL,
      temperature: ALERT_STATES.NORMAL
    };
    
    this.lastAlertTimes = {};
    this.alertCooldown = 300000; // 5 minutos entre alertas del mismo tipo
    
    this.processMetrics = {
      startTime: Date.now(),
      restarts: 0,
      errors: 0,
      connections: 0
    };
    
    console.log('[Resource Monitor] Initialized');
  }

  /**
   * Iniciar monitoreo
   */
  startMonitoring(interval = 5000) {
    if (this.isMonitoring) {
      console.log('[Resource Monitor] Already monitoring');
      return;
    }
    
    this.updateInterval = interval;
    this.isMonitoring = true;
    
    // Recopilar métricas iniciales
    this.collectMetrics();
    
    // Configurar intervalo de monitoreo
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.updateInterval);
    
    console.log(`[Resource Monitor] Started monitoring (interval: ${interval}ms)`);
    
    // Log de auditoría
    auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
      level: 'info',
      details: {
        action: 'start_monitoring',
        interval: interval
      }
    });
  }

  /**
   * Detener monitoreo
   */
  stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('[Resource Monitor] Stopped monitoring');
    
    // Log de auditoría
    auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
      level: 'info',
      details: {
        action: 'stop_monitoring'
      }
    });
  }

  /**
   * Recopilar métricas del sistema
   */
  async collectMetrics() {
    try {
      const timestamp = Date.now();
      
      // Métricas de CPU
      const cpuMetrics = await this.getCPUMetrics();
      
      // Métricas de memoria
      const memoryMetrics = this.getMemoryMetrics();
      
      // Métricas de disco
      const diskMetrics = await this.getDiskMetrics();
      
      // Métricas de red
      const networkMetrics = this.getNetworkMetrics();
      
      // Métricas del proceso
      const processMetrics = this.getProcessMetrics();
      
      // Métricas del bot
      const botMetrics = this.getBotMetrics();
      
      // Compilar todas las métricas
      const metrics = {
        timestamp,
        cpu: cpuMetrics,
        memory: memoryMetrics,
        disk: diskMetrics,
        network: networkMetrics,
        process: processMetrics,
        bot: botMetrics,
        system: {
          uptime: os.uptime(),
          loadavg: os.loadavg(),
          platform: os.platform(),
          arch: os.arch(),
          hostname: os.hostname()
        }
      };
      
      this.currentMetrics = metrics;
      
      // Agregar a historial
      this.addToHistory(metrics);
      
      // Verificar umbrales y generar alertas
      this.checkThresholds(metrics);
      
      // Emitir evento de actualización
      this.emit('metricsUpdated', metrics);
      
    } catch (error) {
      console.error('[Resource Monitor] Error collecting metrics:', error);
      this.processMetrics.errors++;
    }
  }

  /**
   * Obtener métricas de CPU
   */
  async getCPUMetrics() {
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();
      
      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
        
        const cpus = os.cpus();
        
        resolve({
          usage: percentageCPU,
          cores: cpus.length,
          model: cpus[0]?.model || 'Unknown',
          speed: cpus[0]?.speed || 0,
          loadAverage: os.loadavg()
        });
      }, 100);
    });
  }

  /**
   * Calcular promedio de CPU
   */
  cpuAverage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    
    return {
      idle: totalIdle / cpus.length,
      total: totalTick / cpus.length
    };
  }

  /**
   * Obtener métricas de memoria
   */
  getMemoryMetrics() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercentage = (usedMemory / totalMemory) * 100;
    
    // Métricas del proceso Node.js
    const processMemory = process.memoryUsage();
    
    return {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usage: usagePercentage,
      process: {
        rss: processMemory.rss,
        heapTotal: processMemory.heapTotal,
        heapUsed: processMemory.heapUsed,
        external: processMemory.external,
        arrayBuffers: processMemory.arrayBuffers
      }
    };
  }

  /**
   * Obtener métricas de disco
   */
  async getDiskMetrics() {
    try {
      const stats = fs.statSync(process.cwd());
      
      // En sistemas Unix, podemos obtener información del disco
      if (process.platform !== 'win32') {
        try {
          const { execSync } = await import('child_process');
          const output = execSync('df -h /', { encoding: 'utf8' });
          const lines = output.split('\n');
          const diskLine = lines[1];
          const parts = diskLine.split(/\s+/);
          
          if (parts.length >= 5) {
            const usageStr = parts[4];
            const usage = parseInt(usageStr.replace('%', ''));
            
            return {
              usage: usage,
              total: parts[1],
              used: parts[2],
              available: parts[3],
              filesystem: parts[0]
            };
          }
        } catch (error) {
          // Fallback si no se puede ejecutar df
        }
      }
      
      // Fallback básico
      return {
        usage: 0,
        total: 'Unknown',
        used: 'Unknown',
        available: 'Unknown',
        filesystem: 'Unknown'
      };
      
    } catch (error) {
      return {
        usage: 0,
        total: 'Error',
        used: 'Error',
        available: 'Error',
        filesystem: 'Error'
      };
    }
  }

  /**
   * Obtener métricas de red
   */
  getNetworkMetrics() {
    const networkInterfaces = os.networkInterfaces();
    const interfaces = [];
    
    for (const [name, nets] of Object.entries(networkInterfaces)) {
      for (const net of nets || []) {
        if (!net.internal) {
          interfaces.push({
            name,
            address: net.address,
            family: net.family,
            mac: net.mac
          });
        }
      }
    }
    
    return {
      interfaces,
      hostname: os.hostname()
    };
  }

  /**
   * Obtener métricas del proceso
   */
  getProcessMetrics() {
    const now = Date.now();
    const uptime = now - this.processMetrics.startTime;
    
    return {
      ...this.processMetrics,
      uptime,
      pid: process.pid,
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd()
    };
  }

  /**
   * Obtener métricas del bot
   */
  getBotMetrics() {
    const conn = global.conn;
    const db = global.db;
    
    let connectionStatus = 'disconnected';
    let phoneNumber = null;
    let qrStatus = null;
    
    if (conn) {
      if (conn.user) {
        connectionStatus = 'connected';
        phoneNumber = conn.user.jid?.split('@')[0] || null;
      } else if (conn.qr) {
        connectionStatus = 'qr_pending';
        qrStatus = 'waiting_scan';
      } else {
        connectionStatus = 'connecting';
      }
    }
    
    // Estadísticas de la base de datos
    let dbStats = {
      users: 0,
      groups: 0,
      chats: 0
    };
    
    if (db?.data) {
      dbStats.users = Object.keys(db.data.users || {}).length;
      dbStats.groups = Object.keys(db.data.chats || {}).filter(jid => jid.endsWith('@g.us')).length;
      dbStats.chats = Object.keys(db.data.chats || {}).length;
    }
    
    // Subbots conectados
    const subbots = Array.isArray(global.conns) ? global.conns.length : 0;
    
    return {
      connection: {
        status: connectionStatus,
        phoneNumber,
        qrStatus
      },
      database: dbStats,
      subbots: {
        total: subbots,
        connected: subbots // Simplificado por ahora
      }
    };
  }

  /**
   * Agregar métricas al historial
   */
  addToHistory(metrics) {
    this.historicalData.push({
      timestamp: metrics.timestamp,
      cpu: metrics.cpu.usage,
      memory: metrics.memory.usage,
      disk: metrics.disk.usage,
      connections: metrics.bot.database.chats
    });
    
    // Mantener solo las últimas N entradas
    if (this.historicalData.length > this.maxHistorySize) {
      this.historicalData = this.historicalData.slice(-this.maxHistorySize);
    }
  }

  /**
   * Verificar umbrales y generar alertas
   */
  checkThresholds(metrics) {
    this.checkResourceThreshold('cpu', metrics.cpu.usage);
    this.checkResourceThreshold('memory', metrics.memory.usage);
    this.checkResourceThreshold('disk', metrics.disk.usage);
  }

  /**
   * Verificar umbral de un recurso específico
   */
  checkResourceThreshold(resource, value) {
    const thresholds = this.thresholds[resource];
    if (!thresholds) return;
    
    let newState = ALERT_STATES.NORMAL;
    
    if (value >= thresholds.critical) {
      newState = ALERT_STATES.CRITICAL;
    } else if (value >= thresholds.warning) {
      newState = ALERT_STATES.WARNING;
    }
    
    const previousState = this.alertStates[resource];
    
    if (newState !== previousState) {
      this.alertStates[resource] = newState;
      this.handleStateChange(resource, newState, previousState, value);
    }
  }

  /**
   * Manejar cambio de estado de alerta
   */
  async handleStateChange(resource, newState, previousState, value) {
    const now = Date.now();
    const lastAlert = this.lastAlertTimes[resource] || 0;
    
    // Verificar cooldown de alertas
    if (now - lastAlert < this.alertCooldown && newState !== ALERT_STATES.NORMAL) {
      return;
    }
    
    this.lastAlertTimes[resource] = now;
    
    // Determinar tipo de notificación
    let notificationType = NOTIFICATION_TYPES.INFO;
    let title = '';
    let message = '';
    
    switch (newState) {
      case ALERT_STATES.WARNING:
        notificationType = NOTIFICATION_TYPES.WARNING;
        title = `⚠️ Advertencia: Uso de ${resource.toUpperCase()} Alto`;
        message = `El sistema detectó que el uso de ${resource} alcanzó el ${value.toFixed(1)}%. Se recomienda revisar los procesos activos para evitar degradación del servicio.`;
        break;
        
      case ALERT_STATES.CRITICAL:
        notificationType = NOTIFICATION_TYPES.ERROR;
        title = `🚨 Alerta Crítica: ${resource.toUpperCase()} al Límite`;
        message = `¡ATENCIÓN! El uso de ${resource} está en nivel crítico (${value.toFixed(1)}%). El rendimiento del bot podría verse seriamente afectado o causar reinicios inesperados.`;
        break;
        
      case ALERT_STATES.NORMAL:
        if (previousState !== ALERT_STATES.NORMAL) {
          notificationType = NOTIFICATION_TYPES.SUCCESS;
          title = `✅ ${resource.toUpperCase()} Normalizado`;
          message = `El uso de ${resource} ha vuelto a niveles normales: ${value.toFixed(1)}%`;
        }
        break;
    }
    
    if (title && message) {
      // Enviar notificación
      await notificationSystem.send({
        type: notificationType,
        title,
        message,
        category: NOTIFICATION_CATEGORIES.SYSTEM,
        data: {
          resource,
          value,
          threshold: this.thresholds[resource],
          state: newState,
          previousState
        }
      });
      
      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_ALERT, {
        level: newState === ALERT_STATES.CRITICAL ? 'error' : 'warning',
        details: {
          resource,
          value,
          state: newState,
          previousState,
          threshold: this.thresholds[resource]
        }
      });
      
      // Emitir evento
      this.emit('alertStateChanged', {
        resource,
        newState,
        previousState,
        value,
        timestamp: now
      });
    }
  }

  /**
   * Configurar umbrales
   */
  setThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    
    console.log('[Resource Monitor] Thresholds updated:', this.thresholds);
    
    // Log de auditoría
    auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
      level: 'info',
      details: {
        action: 'update_thresholds',
        thresholds: this.thresholds
      }
    });
  }

  /**
   * Obtener métricas actuales
   */
  getCurrentMetrics() {
    return this.currentMetrics;
  }

  /**
   * Obtener historial de métricas
   */
  getHistoricalData(limit = null) {
    if (limit) {
      return this.historicalData.slice(-limit);
    }
    return this.historicalData;
  }

  /**
   * Obtener estadísticas resumidas
   */
  getStats() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const recentData = this.historicalData.filter(d => d.timestamp > oneHourAgo);
    
    const calculateAverage = (data, key) => {
      if (data.length === 0) return 0;
      return data.reduce((sum, item) => sum + (item[key] || 0), 0) / data.length;
    };
    
    const calculateMax = (data, key) => {
      if (data.length === 0) return 0;
      return Math.max(...data.map(item => item[key] || 0));
    };
    
    return {
      current: this.currentMetrics,
      alerts: this.alertStates,
      thresholds: this.thresholds,
      isMonitoring: this.isMonitoring,
      updateInterval: this.updateInterval,
      historySize: this.historicalData.length,
      lastHour: {
        avgCpu: calculateAverage(recentData, 'cpu'),
        maxCpu: calculateMax(recentData, 'cpu'),
        avgMemory: calculateAverage(recentData, 'memory'),
        maxMemory: calculateMax(recentData, 'memory'),
        avgDisk: calculateAverage(recentData, 'disk'),
        maxDisk: calculateMax(recentData, 'disk')
      }
    };
  }

  /**
   * Limpiar historial
   */
  clearHistory() {
    this.historicalData = [];
    console.log('[Resource Monitor] History cleared');
    
    // Log de auditoría
    auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
      level: 'info',
      details: {
        action: 'clear_history'
      }
    });
  }

  /**
   * Exportar métricas
   */
  exportMetrics(format = 'json') {
    const data = {
      exportTime: new Date().toISOString(),
      current: this.currentMetrics,
      history: this.historicalData,
      thresholds: this.thresholds,
      alerts: this.alertStates
    };
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(this.historicalData);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Convertir datos a CSV
   */
  convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = ['timestamp', 'cpu', 'memory', 'disk', 'connections'];
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  /**
   * Incrementar contador de errores
   */
  incrementErrors() {
    this.processMetrics.errors++;
  }

  /**
   * Incrementar contador de reinicios
   */
  incrementRestarts() {
    this.processMetrics.restarts++;
  }

  /**
   * Actualizar contador de conexiones
   */
  updateConnections(count) {
    this.processMetrics.connections = count;
  }
}

// Instancia singleton
const resourceMonitor = new ResourceMonitor();

export default resourceMonitor;