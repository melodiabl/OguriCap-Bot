// Detector de anomalías usando datos reales
export class AnomalyDetector {
  constructor() {
    this.baseline = new Map();
    this.historicalData = new Map();
  }

  async detectUserActivityAnomaly() {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      const panelDb = global.db?.data?.panel;

      if (!panelDb?.auditLogs) return 0;

      const now = new Date();
      const oneHour = 60 * 60 * 1000;
      const oneDay = 24 * oneHour;

      // Obtener actividad de la última hora
      const currentHourActivity = panelDb.auditLogs.filter(log =>
        new Date(log.timestamp) >= new Date(now.getTime() - oneHour)
      ).length;

      // Obtener actividad histórica de las últimas 24 horas (por horas)
      const historicalActivity = [];
      for (let i = 1; i <= 24; i++) {
        const hourStart = new Date(now.getTime() - (i + 1) * oneHour);
        const hourEnd = new Date(now.getTime() - i * oneHour);

        const hourActivity = panelDb.auditLogs.filter(log => {
          const logTime = new Date(log.timestamp);
          return logTime >= hourStart && logTime < hourEnd;
        }).length;

        historicalActivity.push(hourActivity);
      }

      if (historicalActivity.length === 0) return 0;

      // Calcular media y desviación estándar
      const mean = historicalActivity.reduce((sum, val) => sum + val, 0) / historicalActivity.length;
      const variance = historicalActivity.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalActivity.length;
      const stdDev = Math.sqrt(variance);

      // Si no hay variación histórica, no hay anomalía
      if (stdDev === 0) return 0;

      // Calcular z-score (número de desviaciones estándar)
      const zScore = Math.abs((currentHourActivity - mean) / stdDev);

      // Retornar el z-score como medida de anomalía
      // Valores > 2 se consideran anómalos
      return Math.min(zScore, 5); // Limitar a 5 para evitar valores extremos

    } catch (error) {
      console.error('Error detecting user activity anomaly:', error);
      return 0;
    }
  }

  async detectCommandAnomaly() {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      const panelDb = global.db?.data?.panel;

      if (!panelDb?.auditLogs) return 0;

      const now = new Date();
      const oneHour = 60 * 60 * 1000;

      // Obtener comandos de la última hora
      const recentCommands = panelDb.auditLogs.filter(log =>
        log.event === 'BOT_COMMAND_EXECUTED' &&
        new Date(log.timestamp) >= new Date(now.getTime() - oneHour)
      );

      // Analizar patrones de comandos
      const commandCounts = {};
      const userCounts = {};

      recentCommands.forEach(log => {
        const command = log.metadata?.command || 'unknown';
        const user = log.metadata?.userId || 'unknown';

        commandCounts[command] = (commandCounts[command] || 0) + 1;
        userCounts[user] = (userCounts[user] || 0) + 1;
      });

      // Detectar anomalías:
      // 1. Usuario con demasiados comandos
      const maxUserCommands = Math.max(...Object.values(userCounts), 0);
      const avgUserCommands = Object.values(userCounts).reduce((sum, val) => sum + val, 0) / Math.max(Object.keys(userCounts).length, 1);

      // 2. Comando específico usado excesivamente
      const maxCommandUsage = Math.max(...Object.values(commandCounts), 0);
      const avgCommandUsage = Object.values(commandCounts).reduce((sum, val) => sum + val, 0) / Math.max(Object.keys(commandCounts).length, 1);

      let anomalyScore = 0;

      // Anomalía si un usuario ejecuta > 3x la media
      if (maxUserCommands > avgUserCommands * 3) {
        anomalyScore += 2;
      }

      // Anomalía si un comando se usa > 5x la media
      if (maxCommandUsage > avgCommandUsage * 5) {
        anomalyScore += 1;
      }

      // Anomalía si hay demasiados comandos en general (> 100 por hora)
      if (recentCommands.length > 100) {
        anomalyScore += 1;
      }

      return Math.min(anomalyScore, 5);

    } catch (error) {
      console.error('Error detecting command anomaly:', error);
      return 0;
    }
  }

  async detectSystemAnomaly() {
    try {
      // Importar systeminformation si está disponible
      const si = await import('systeminformation').catch(() => null);

      if (!si) return 0;

      const [cpu, mem, load] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.currentLoad()
      ]);

      let anomalyScore = 0;

      // CPU usage > 90%
      if (cpu.currentLoad > 90) anomalyScore += 2;
      else if (cpu.currentLoad > 80) anomalyScore += 1;

      // Memory usage > 90%
      const memUsage = (mem.used / mem.total) * 100;
      if (memUsage > 90) anomalyScore += 2;
      else if (memUsage > 80) anomalyScore += 1;

      // Load average anomaly (si está disponible)
      if (load.avgLoad && load.avgLoad > 5) anomalyScore += 1;

      return Math.min(anomalyScore, 5);

    } catch (error) {
      console.error('Error detecting system anomaly:', error);
      return 0;
    }
  }
}
