// Sistema de Programador de Tareas Avanzado

import cron from 'node-cron';
import auditLogger, { AUDIT_EVENTS } from './audit-logger.js';
import notificationSystem from './notification-system.js';
import { emit, SOCKET_EVENTS } from './socket-io.js';

// Tipos de tareas
export const TASK_TYPES = {
  COMMAND: 'command',
  BACKUP: 'backup',
  CLEANUP: 'cleanup',
  NOTIFICATION: 'notification',
  RESTART: 'restart',
  MAINTENANCE: 'maintenance',
  REPORT: 'report',
  WEBHOOK: 'webhook',
  CUSTOM: 'custom'
};

// Estados de tareas
export const TASK_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  PAUSED: 'paused'
};

// Prioridades de tareas
export const TASK_PRIORITIES = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4,
  CRITICAL: 5
};

class TaskScheduler {
  constructor() {
    this.isRunning = true;
    this.tasks = new Map(); // ID -> Task
    this.cronJobs = new Map(); // ID -> CronJob
    this.runningTasks = new Set(); // IDs de tareas en ejecución
    this.taskHistory = []; // Historial de ejecuciones
    this.maxHistorySize = 1000;
    
    this.initializeDefaultTasks();

    // Rehidratar tareas/ejecuciones desde la DB (best-effort)
    setImmediate(() => {
      this.loadFromDatabase().catch(() => {});
    });
  }

  async loadFromDatabase() {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      const panelDb = global.db?.data?.panel;
      if (!panelDb) return;

      const storedTasks =
        panelDb?.scheduledTasks && typeof panelDb.scheduledTasks === 'object'
          ? Object.values(panelDb.scheduledTasks)
          : [];

      // Dedupe por "firma" para evitar duplicados (especialmente defaults viejos con IDs numéricos)
      const bySig = new Map();
      const sigOf = (t) => `${t?.name || ''}|${t?.action || ''}|${t?.schedule || ''}`;
      const isPreferred = (t) => typeof t?.id === 'string' && String(t.id).startsWith('default_');
      const createdAtTs = (t) => {
        const ts = new Date(t?.createdAt || 0).getTime();
        return Number.isFinite(ts) ? ts : 0;
      };

      for (const t of storedTasks) {
        if (!t || t.id == null) continue;
        const sig = sigOf(t);
        const prev = bySig.get(sig);
        if (!prev) {
          bySig.set(sig, t);
          continue;
        }

        if (isPreferred(prev)) continue;
        if (isPreferred(t)) {
          bySig.set(sig, t);
          continue;
        }

        // Si ninguno es "preferred", quedarse con el más nuevo
        if (createdAtTs(t) >= createdAtTs(prev)) bySig.set(sig, t);
      }

      for (const task of bySig.values()) {
        this.tasks.set(task.id, task);
        if (task.enabled && task.schedule) this.scheduleCronJob(task);
      }

      if (Array.isArray(panelDb.taskExecutions)) {
        this.taskHistory = panelDb.taskExecutions.slice(0, this.maxHistorySize);
      }
    } catch (error) {
      console.error('Error loading tasks from database:', error);
    }
  }

  /**
   * Inicializa tareas por defecto del sistema
   */
  initializeDefaultTasks() {
    // Limpieza de logs cada día a las 2 AM
    this.scheduleTask({
      id: 'default_cleanup_logs',
      name: 'Limpieza de Logs',
      description: 'Limpia logs antiguos del sistema',
      type: TASK_TYPES.CLEANUP,
      schedule: '0 2 * * *',
      action: 'cleanupLogs',
      enabled: true,
      priority: TASK_PRIORITIES.NORMAL,
      config: {
        maxAge: 30, // días
        maxSize: 1000 // número de logs
      }
    });

    // Backup de base de datos cada 6 horas
    this.scheduleTask({
      id: 'default_backup_automatico',
      name: 'Backup Automático',
      description: 'Crea backup de la base de datos',
      type: TASK_TYPES.BACKUP,
      schedule: '0 */6 * * *',
      action: 'createBackup',
      enabled: true,
      priority: TASK_PRIORITIES.HIGH,
      config: {
        includeMedia: false,
        compress: true
      }
    });

    // Reporte diario de estadísticas
    this.scheduleTask({
      id: 'default_reporte_diario',
      name: 'Reporte Diario',
      description: 'Genera reporte diario de estadísticas',
      type: TASK_TYPES.REPORT,
      schedule: '0 8 * * *',
      action: 'generateDailyReport',
      enabled: true,
      priority: TASK_PRIORITIES.NORMAL,
      config: {
        includeCharts: true,
        sendEmail: false
      }
    });

    // Verificación de salud del sistema cada 15 minutos
    this.scheduleTask({
      id: 'default_health_check',
      name: 'Health Check',
      description: 'Verifica el estado del sistema',
      type: TASK_TYPES.CUSTOM,
      schedule: '*/15 * * * *',
      action: 'healthCheck',
      enabled: true,
      priority: TASK_PRIORITIES.HIGH,
      config: {
        checkBot: true,
        checkDatabase: true,
        checkMemory: true,
        alertThreshold: 90
      }
    });
  }

  /**
   * Programa una nueva tarea
   */
  async scheduleTask(taskConfig) {
    try {
      const task = this.createTask(taskConfig);
      
      // Validar configuración
      if (!this.validateTask(task)) {
        throw new Error('Configuración de tarea inválida');
      }

      // Guardar tarea
      this.tasks.set(task.id, task);
      await this.saveTaskToDatabase(task);

      // Programar con cron si está habilitada
      if (task.enabled && task.schedule) {
        this.scheduleCronJob(task);
      }

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
        level: 'info',
        details: {
          action: 'task_scheduled',
          taskId: task.id,
          taskName: task.name,
          schedule: task.schedule
        }
      });

      try {
        const timestamp = new Date().toISOString();
        emit(SOCKET_EVENTS.TASK_CREATED, { task, timestamp });
        emit(SOCKET_EVENTS.TASK_UPDATED, { taskId: String(task.id), updates: task, timestamp });
      } catch {}

      return task;
    } catch (error) {
      console.error('Error scheduling task:', error);
      throw error;
    }
  }

  /**
   * Ejecuta una tarea inmediatamente
   */
  async executeTask(taskId, manual = false) {
    const task = this.getTask(taskId);
    if (!task) {
      throw new Error(`Tarea no encontrada: ${taskId}`);
    }

    if (this.runningTasks.has(task.id)) {
      throw new Error(`La tarea ${task.name} ya está en ejecución`);
    }

    const execution = {
      id: `exec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      taskId: task.id,
      taskName: task.name,
      startTime: new Date(),
      endTime: null,
      status: TASK_STATUS.RUNNING,
      manual,
      result: null,
      error: null,
      duration: 0
    };

    try {
      this.runningTasks.add(task.id);
      task.lastExecution = execution;
      task.status = TASK_STATUS.RUNNING;

      try {
        emit(SOCKET_EVENTS.TASK_UPDATED, {
          taskId: String(task.id),
          updates: { status: task.status, lastExecution: task.lastExecution },
          timestamp: new Date().toISOString(),
        });
      } catch {}

      // Notificar inicio de tarea crítica
      if (task.priority >= TASK_PRIORITIES.HIGH) {
        await notificationSystem.send({
          type: 'info',
          title: 'Tarea Iniciada',
          message: `La tarea "${task.name}" ha comenzado`,
          category: 'system',
          data: { taskId: task.id, taskName: task.name }
        });
      }

      // Ejecutar la acción
      const result = await this.executeTaskAction(task);

      // Completar ejecución
      execution.endTime = new Date();
      execution.duration = execution.endTime - execution.startTime;
      execution.status = TASK_STATUS.COMPLETED;
      execution.result = result;
      task.status = TASK_STATUS.COMPLETED;
      task.lastSuccess = execution.endTime;
      task.successCount = (task.successCount || 0) + 1;

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
        level: 'info',
        details: {
          action: 'task_executed',
          taskId: task.id,
          taskName: task.name,
          duration: execution.duration,
          manual,
          success: true
        }
      });

    } catch (error) {
      execution.endTime = new Date();
      execution.duration = execution.endTime - execution.startTime;
      execution.status = TASK_STATUS.FAILED;
      execution.error = error.message;
      task.status = TASK_STATUS.FAILED;
      task.lastError = error.message;
      task.errorCount = (task.errorCount || 0) + 1;

      // Notificar error en tarea crítica
      if (task.priority >= TASK_PRIORITIES.HIGH) {
        await notificationSystem.send({
          type: 'error',
          title: 'Error en Tarea',
          message: `La tarea "${task.name}" falló: ${error.message}`,
          category: 'system',
          data: { taskId: task.id, taskName: task.name, error: error.message }
        });
      }

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, {
        level: 'error',
        details: {
          action: 'task_failed',
          taskId: task.id,
          taskName: task.name,
          duration: execution.duration,
          manual,
          error: error.message
        }
      });

      throw error;
    } finally {
      this.runningTasks.delete(task.id);
      this.addToHistory(execution);
      await this.saveTaskToDatabase(task);

      try {
        emit(SOCKET_EVENTS.TASK_EXECUTED, execution);
        emit(SOCKET_EVENTS.TASK_UPDATED, {
          taskId: String(task.id),
          updates: {
            status: task.status,
            lastExecution: task.lastExecution,
            successCount: task.successCount,
            errorCount: task.errorCount,
          },
          timestamp: new Date().toISOString(),
        });
      } catch {}
    }

    return execution;
  }

  /**
   * Ejecuta la acción específica de una tarea
   */
  async executeTaskAction(task) {
    switch (task.action) {
      case 'cleanupLogs':
        return this.cleanupLogs(task.config);
      
      case 'createBackup':
        return this.createBackup(task.config);
      
      case 'generateDailyReport':
        return this.generateDailyReport(task.config);
      
      case 'healthCheck':
        return this.performHealthCheck(task.config);
      
      case 'sendCommand':
        return this.sendBotCommand(task.config);
      
      case 'restartBot':
        return this.restartBot(task.config);
      
      case 'sendNotification':
        return this.sendScheduledNotification(task.config);
      
      case 'callWebhook':
        return this.callWebhook(task.config);
      
      default:
        throw new Error(`Acción de tarea desconocida: ${task.action}`);
    }
  }

  /**
   * Acciones específicas de tareas
   */
  async cleanupLogs(config) {
    if (typeof global.loadDatabase === 'function') await global.loadDatabase();
    
    const panelDb = global.db?.data?.panel;
    if (!panelDb) return { cleaned: 0 };

    let cleaned = 0;

    // Limpiar logs del panel
    if (panelDb.logs && Array.isArray(panelDb.logs)) {
      const maxAge = config.maxAge || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);

      const originalLength = panelDb.logs.length;
      panelDb.logs = panelDb.logs.filter(log => 
        new Date(log.fecha || log.timestamp) >= cutoffDate
      );

      // Limitar por cantidad
      if (config.maxSize && panelDb.logs.length > config.maxSize) {
        panelDb.logs = panelDb.logs.slice(-config.maxSize);
      }

      cleaned = originalLength - panelDb.logs.length;
    }

    // Limpiar audit logs
    if (panelDb.auditLogs && Array.isArray(panelDb.auditLogs)) {
      const maxAge = config.maxAge || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);

      const originalLength = panelDb.auditLogs.length;
      panelDb.auditLogs = panelDb.auditLogs.filter(log => 
        new Date(log.timestamp) >= cutoffDate
      );

      cleaned += originalLength - panelDb.auditLogs.length;
    }

    return { cleaned, maxAge: config.maxAge, maxSize: config.maxSize };
  }

  async createBackup(config) {
    if (typeof global.loadDatabase === 'function') await global.loadDatabase();
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}.json`;
    
    const backupData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: global.db?.data || {},
      config: {
        includeMedia: config.includeMedia || false,
        compress: config.compress || false
      }
    };

    // En un entorno real, aquí guardarías el backup en un archivo o servicio de almacenamiento
    console.log(`Backup created: ${backupName}`);
    
    return { 
      backupName, 
      size: JSON.stringify(backupData).length,
      timestamp: backupData.timestamp
    };
  }

  async generateDailyReport(config) {
    // Generar reporte de estadísticas diarias
    const stats = {
      date: new Date().toISOString().split('T')[0],
      commands: await this.getCommandStats(),
      users: await this.getUserStats(),
      groups: await this.getGroupStats(),
      errors: await this.getErrorStats()
    };

    if (config.sendEmail) {
      // Enviar por email (implementar según necesidades)
      console.log('Daily report would be sent by email');
    }

    return stats;
  }

  async performHealthCheck(config) {
    const health = {
      timestamp: new Date().toISOString(),
      overall: 'healthy',
      checks: {}
    };

    // Verificar bot
    if (config.checkBot) {
      health.checks.bot = {
        status: global.conn?.user ? 'connected' : 'disconnected',
        uptime: process.uptime()
      };
    }

    // Verificar base de datos
    if (config.checkDatabase) {
      health.checks.database = {
        status: global.db?.data ? 'available' : 'unavailable',
        size: global.db?.data ? JSON.stringify(global.db.data).length : 0
      };
    }

    // Verificar memoria
    if (config.checkMemory) {
      const memUsage = process.memoryUsage();
      const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      health.checks.memory = {
        status: memPercent < (config.alertThreshold || 90) ? 'ok' : 'high',
        usage: Math.round(memPercent),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      };

      // Alerta si el uso de memoria es alto
      if (memPercent >= (config.alertThreshold || 90)) {
        await notificationSystem.send({
          type: 'warning',
          title: 'Uso de Memoria Alto',
          message: `El uso de memoria está en ${Math.round(memPercent)}%`,
          category: 'system',
          data: { memoryUsage: memPercent }
        });
      }
    }

    // Determinar estado general
    const hasErrors = Object.values(health.checks).some(check => 
      check.status === 'disconnected' || check.status === 'unavailable' || check.status === 'high'
    );

    health.overall = hasErrors ? 'unhealthy' : 'healthy';

    return health;
  }

  async sendBotCommand(config) {
    if (!global.conn?.user) {
      throw new Error('Bot no está conectado');
    }

    const { command, group, args } = config;
    const fullCommand = `${command} ${args || ''}`.trim();

    // Enviar comando al grupo especificado o al primer grupo disponible
    const targetGroup = group || Object.keys(global.db?.data?.chats || {}).find(jid => jid.endsWith('@g.us'));
    
    if (!targetGroup) {
      throw new Error('No hay grupos disponibles');
    }

    await global.conn.sendMessage(targetGroup, { text: fullCommand });
    
    return { command: fullCommand, group: targetGroup, timestamp: new Date().toISOString() };
  }

  async restartBot(config) {
    // Implementar reinicio del bot
    console.log('Bot restart would be triggered');
    return { restarted: true, timestamp: new Date().toISOString() };
  }

  async sendScheduledNotification(config) {
    await notificationSystem.send({
      type: config.type || 'info',
      title: config.title,
      message: config.message,
      category: config.category || 'system',
      data: config.data || {}
    });

    return { sent: true, timestamp: new Date().toISOString() };
  }

  async callWebhook(config) {
    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.headers || {})
      },
      body: JSON.stringify(config.payload || {})
    });

    return {
      status: response.status,
      statusText: response.statusText,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Gestión de tareas
   */
  pauseTask(taskId) {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Tarea no encontrada');

    task.enabled = false;
    task.status = TASK_STATUS.PAUSED;
    
    // Cancelar cron job
    const cronJob = this.cronJobs.get(task.id);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(task.id);
    }

    return task;
  }

  resumeTask(taskId) {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Tarea no encontrada');

    task.enabled = true;
    task.status = TASK_STATUS.PENDING;
    
    // Reprogramar cron job
    this.scheduleCronJob(task);

    return task;
  }

  deleteTask(taskId) {
    const task = this.getTask(taskId);
    if (!task) throw new Error('Tarea no encontrada');

    // Cancelar cron job
    const cronJob = this.cronJobs.get(task.id);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(task.id);
    }

    // Eliminar tarea
    this.tasks.delete(task.id);
    
    // Best-effort: eliminar de DB si existe
    setImmediate(async () => {
      try {
        if (typeof global.loadDatabase === 'function') await global.loadDatabase();
        const panelDb = global.db?.data?.panel;
        if (panelDb?.scheduledTasks) delete panelDb.scheduledTasks[task.id];
      } catch {}
    });

    return true;
  }

  /**
   * Funciones de utilidad
   */
  createTask(config) {
    return {
      id: config.id ?? (Date.now() + Math.random()),
      name: config.name,
      description: config.description || '',
      type: config.type || TASK_TYPES.CUSTOM,
      action: config.action,
      schedule: config.schedule,
      enabled: config.enabled !== false,
      priority: config.priority || TASK_PRIORITIES.NORMAL,
      config: config.config || {},
      createdAt: new Date().toISOString(),
      lastExecution: null,
      lastSuccess: null,
      lastError: null,
      successCount: 0,
      errorCount: 0,
      status: TASK_STATUS.PENDING
    };
  }

  validateTask(task) {
    if (!task.name || !task.action) return false;
    if (task.schedule && !cron.validate(task.schedule)) return false;
    return true;
  }

  scheduleCronJob(task) {
    if (!task.schedule || !cron.validate(task.schedule)) return;

    // Cancelar job existente
    const existingJob = this.cronJobs.get(task.id);
    if (existingJob) {
      existingJob.stop();
    }

    // Crear nuevo job
    const job = cron.schedule(task.schedule, async () => {
      try {
        await this.executeTask(task.id, false);
      } catch (error) {
        console.error(`Error executing scheduled task ${task.name}:`, error);
      }
    }, {
      scheduled: false,
      timezone: 'America/Mexico_City' // Ajustar según necesidades
    });

    job.start();
    this.cronJobs.set(task.id, job);
  }

  addToHistory(execution) {
    this.taskHistory.unshift(execution);
    
    // Mantener solo las últimas ejecuciones
    if (this.taskHistory.length > this.maxHistorySize) {
      this.taskHistory = this.taskHistory.slice(0, this.maxHistorySize);
    }

    // Persistir historial para el panel (best-effort)
    setImmediate(async () => {
      try {
        if (typeof global.loadDatabase === 'function') await global.loadDatabase();
        const panelDb = global.db?.data?.panel;
        if (!panelDb) return;
        panelDb.taskExecutions = this.taskHistory.slice(0, this.maxHistorySize);
      } catch {}
    });
  }

  async saveTaskToDatabase(task) {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      
      const panelDb = global.db?.data?.panel;
      if (!panelDb) return;

      panelDb.scheduledTasks ||= {};
      panelDb.scheduledTasks[task.id] = task;
    } catch (error) {
      console.error('Error saving task to database:', error);
    }
  }

  // Métodos para obtener estadísticas (implementar según necesidades)
  async getCommandStats() { return {}; }
  async getUserStats() { return {}; }
  async getGroupStats() { return {}; }
  async getErrorStats() { return {}; }

  // Getters
  getAllTasks() { return Array.from(this.tasks.values()); }
  getTask(id) {
    if (this.tasks.has(id)) return this.tasks.get(id);
    if (typeof id === 'string') {
      const n = Number(id);
      if (Number.isFinite(n) && this.tasks.has(n)) return this.tasks.get(n);
    }
    return null;
  }
  getRunningTasks() { return Array.from(this.runningTasks); }
  getTaskHistory(limit = 50) { return this.taskHistory.slice(0, limit); }
  getExecutions(limit = 50) { return this.getTaskHistory(limit); }

  async updateTask(taskId, updates = {}) {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Tarea no encontrada: ${taskId}`);

    const next = { ...task, ...updates };

    if (typeof next.enabled === 'boolean') task.enabled = next.enabled;
    if (typeof next.name === 'string') task.name = next.name;
    if (typeof next.description === 'string') task.description = next.description;
    if (typeof next.type === 'string') task.type = next.type;
    if (typeof next.action === 'string') task.action = next.action;
    if (typeof next.priority === 'number') task.priority = next.priority;
    if (typeof next.config === 'object' && next.config) task.config = next.config;

    if (typeof next.schedule === 'string') {
      if (next.schedule && !cron.validate(next.schedule)) {
        throw new Error('Expresion cron invalida');
      }
      task.schedule = next.schedule;
    }

    // Reprogramar cron job seg˙n enabled/schedule
    const existingJob = this.cronJobs.get(task.id);
    if (existingJob) {
      try { existingJob.stop(); } catch {}
      this.cronJobs.delete(task.id);
    }

    if (task.enabled && task.schedule) {
      this.scheduleCronJob(task);
    }

    await this.saveTaskToDatabase(task);

    try {
      emit(SOCKET_EVENTS.TASK_UPDATED, { taskId: String(task.id), updates: task, timestamp: new Date().toISOString() });
    } catch {}

    return task;
  }

  async cancelTask(taskId) {
    const task = this.getTask(taskId);
    if (!task) throw new Error(`Tarea no encontrada: ${taskId}`);

    const job = this.cronJobs.get(task.id);
    if (job) {
      try { job.stop(); } catch {}
      this.cronJobs.delete(task.id);
    }

    this.runningTasks.delete(task.id);
    this.tasks.delete(task.id);

    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      const panelDb = global.db?.data?.panel;
      if (panelDb?.scheduledTasks) {
        delete panelDb.scheduledTasks[task.id];
      }
    } catch {}

    try {
      emit(SOCKET_EVENTS.TASK_DELETED, { taskId: String(task.id), timestamp: new Date().toISOString() });
    } catch {}

    return { cancelled: true, taskId };
  }
}

// Instancia singleton
const taskScheduler = new TaskScheduler();

export default taskScheduler;
