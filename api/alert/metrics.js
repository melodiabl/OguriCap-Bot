import { AUDIT_EVENTS } from '../audit-logger.js';

/**
 * Recopila métricas del sistema
 */
export async function collectMetrics(metricsMap, anomalyDetector) {
  const metrics = {};

  try {
    // Importar dependencias dinámicamente
    const si = await import('systeminformation').catch(() => null);

    // Métricas de memoria usando systeminformation si está disponible
    if (si) {
      const mem = await si.mem();
      metrics.memory_usage_percent = ((mem.used / mem.total) * 100);
      metrics.memory_heap_used = mem.used;
      metrics.memory_heap_total = mem.total;

      // Métricas de CPU
      const cpu = await si.currentLoad();
      metrics.cpu_usage_percent = cpu.currentLoad;

      // Métricas de disco
      const fsSize = await si.fsSize();
      if (fsSize && fsSize.length > 0) {
        const mainDisk = fsSize[0];
        metrics.disk_usage_percent = mainDisk.use;
      }
    } else {
      // Fallback a métricas básicas de Node.js
      const memUsage = process.memoryUsage();
      metrics.memory_usage_percent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      metrics.memory_heap_used = memUsage.heapUsed;
      metrics.memory_heap_total = memUsage.heapTotal;
      metrics.cpu_usage_percent = 0; // No disponible sin systeminformation
      metrics.disk_usage_percent = 0; // No disponible sin systeminformation
    }

    // Métricas del bot
    metrics.bot_connected = Boolean(global.conn?.user);
    metrics.bot_uptime = process.uptime();

    // Métricas de comandos desde audit logs reales
    if (typeof global.loadDatabase === 'function') await global.loadDatabase();
    const panelDb = global.db?.data?.panel;

    if (panelDb?.auditLogs) {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const recentLogs = panelDb.auditLogs.filter(log =>
        new Date(log.timestamp) >= fiveMinutesAgo
      );

      const commandLogs = recentLogs.filter(log =>
        log.event === 'BOT_COMMAND_EXECUTED'
      );

      const errorLogs = commandLogs.filter(log =>
        log.metadata && !log.metadata.success
      );

      metrics.command_errors_rate = errorLogs.length;
      metrics.command_success_rate = commandLogs.length > 0
        ? ((commandLogs.length - errorLogs.length) / commandLogs.length) * 100
        : 100;
    } else {
      metrics.command_errors_rate = 0;
      metrics.command_success_rate = 100;
    }

    // Métricas de usuarios activos
    if (panelDb?.users) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      metrics.active_users_count = Object.values(panelDb.users).filter(user =>
        user.last_login && new Date(user.last_login) >= oneHourAgo
      ).length;
    } else {
      metrics.active_users_count = 0;
    }

    // Métricas de intentos de login fallidos
    if (panelDb?.auditLogs) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      metrics.failed_login_attempts = panelDb.auditLogs.filter(log =>
        log.event === 'LOGIN_FAILED' &&
        new Date(log.timestamp) >= tenMinutesAgo
      ).length;
    } else {
      metrics.failed_login_attempts = 0;
    }

    // Detección de anomalías en actividad de usuarios
    metrics.user_activity_anomaly = await anomalyDetector.detectUserActivityAnomaly();

    // Tiempo de respuesta promedio (desde métricas globales si están disponibles)
    metrics.response_time_avg = global.averageResponseTime || 0;

    // Actualizar historial de métricas
    updateMetricsHistory(metricsMap, metrics);

  } catch (error) {
    console.error('Error collecting metrics:', error);
    // Métricas por defecto en caso de error
    const memUsage = process.memoryUsage();
    metrics.memory_usage_percent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    metrics.memory_heap_used = memUsage.heapUsed;
    metrics.memory_heap_total = memUsage.heapTotal;
    metrics.bot_connected = Boolean(global.conn?.user);
    metrics.bot_uptime = process.uptime();
    metrics.command_errors_rate = 0;
    metrics.command_success_rate = 100;
    metrics.active_users_count = 0;
    metrics.failed_login_attempts = 0;
    metrics.user_activity_anomaly = 0;
    metrics.cpu_usage_percent = 0;
    metrics.disk_usage_percent = 0;
    metrics.response_time_avg = 0;
  }

  return metrics;
}

/**
 * Funciones de métricas específicas
 */
export async function getCommandErrorRate(seconds) {
  if (typeof global.loadDatabase === 'function') await global.loadDatabase();

  const panelDb = global.db?.data?.panel;
  if (!panelDb?.auditLogs) return 0;

  const cutoff = new Date(Date.now() - seconds * 1000);
  const commandLogs = panelDb.auditLogs.filter(log =>
    log.event === AUDIT_EVENTS.BOT_COMMAND_EXECUTED &&
    new Date(log.timestamp) >= cutoff
  );

  const errorLogs = commandLogs.filter(log =>
    log.metadata && !log.metadata.success
  );

  return errorLogs.length;
}

export async function getCommandSuccessRate(seconds) {
  if (typeof global.loadDatabase === 'function') await global.loadDatabase();

  const panelDb = global.db?.data?.panel;
  if (!panelDb?.auditLogs) return 0;

  const cutoff = new Date(Date.now() - seconds * 1000);
  const commandLogs = panelDb.auditLogs.filter(log =>
    log.event === AUDIT_EVENTS.BOT_COMMAND_EXECUTED &&
    new Date(log.timestamp) >= cutoff
  );

  const successLogs = commandLogs.filter(log =>
    log.metadata && log.metadata.success
  );

  return commandLogs.length > 0 ? (successLogs.length / commandLogs.length) * 100 : 100;
}

export async function getActiveUsersCount() {
  if (typeof global.loadDatabase === 'function') await global.loadDatabase();

  const panelDb = global.db?.data?.panel;
  if (!panelDb?.users) return 0;

  const oneHourAgo = new Date(Date.now() - 3600000);
  return Object.values(panelDb.users).filter(user =>
    user.last_login && new Date(user.last_login) >= oneHourAgo
  ).length;
}

export async function getFailedLoginAttempts(seconds) {
  if (typeof global.loadDatabase === 'function') await global.loadDatabase();

  const panelDb = global.db?.data?.panel;
  if (!panelDb?.auditLogs) return 0;

  const cutoff = new Date(Date.now() - seconds * 1000);
  return panelDb.auditLogs.filter(log =>
    log.event === AUDIT_EVENTS.LOGIN_FAILED &&
    new Date(log.timestamp) >= cutoff
  ).length;
}

export async function getDiskUsage() {
  try {
    const si = await import('systeminformation').catch(() => null);
    if (si) {
      const fsSize = await si.fsSize();
      if (fsSize && fsSize.length > 0) {
        const mainDisk = fsSize[0];
        return mainDisk.use;
      }
    }

    // Fallback usando fs.statSync (aproximado)
    const fs = await import('fs');
    const stats = fs.statSync(process.cwd());
    // En Windows, no podemos obtener el uso real del disco sin herramientas nativas
    // Retornamos 0 como fallback seguro
    return 0;
  } catch {
    return 0;
  }
}

export async function getCPUUsage() {
  // Implementación básica de uso de CPU
  const startUsage = process.cpuUsage();
  await new Promise(resolve => setTimeout(resolve, 100));
  const endUsage = process.cpuUsage(startUsage);

  const totalUsage = endUsage.user + endUsage.system;
  return (totalUsage / 100000) * 100; // Convertir a porcentaje aproximado
}

export async function getAverageResponseTime() {
  // Obtener tiempo de respuesta promedio de los últimos requests
  return global.averageResponseTime || 0;
}

export function updateMetricsHistory(metricsMap, metrics) {
  const timestamp = Date.now();
  for (const [key, value] of Object.entries(metrics)) {
    if (!metricsMap.has(`history_${key}`)) {
      metricsMap.set(`history_${key}`, []);
    }

    const history = metricsMap.get(`history_${key}`);
    history.push({ timestamp, value });

    // Mantener solo las últimas 100 entradas
    if (history.length > 100) {
      history.shift();
    }
  }
}
