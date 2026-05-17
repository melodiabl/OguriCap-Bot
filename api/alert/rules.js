import { ALERT_TYPES, ALERT_SEVERITIES, ALERT_CONDITIONS } from './types.js';

export const DEFAULT_RULES = [
  {
    name: 'Uso de Memoria Alto',
    description: 'Se activa cuando el uso de memoria supera el 85%',
    type: ALERT_TYPES.THRESHOLD,
    severity: ALERT_SEVERITIES.HIGH,
    metric: 'memory_usage_percent',
    condition: ALERT_CONDITIONS.GREATER_THAN,
    threshold: 95,
    duration: 300, // 5 minutos
    enabled: true,
    actions: ['notification', 'log', 'email'],
    tags: ['system', 'memory']
  },
  {
    name: 'Errores de Comandos Frecuentes',
    description: 'Se activa cuando hay más de 10 errores de comandos en 5 minutos',
    type: ALERT_TYPES.THRESHOLD,
    severity: ALERT_SEVERITIES.MEDIUM,
    metric: 'command_errors_rate',
    condition: ALERT_CONDITIONS.GREATER_THAN,
    threshold: 10,
    duration: 300,
    enabled: true,
    actions: ['notification'],
    tags: ['bot', 'commands']
  },
  {
    name: 'Bot Desconectado',
    description: 'Se activa cuando el bot principal se desconecta',
    type: ALERT_TYPES.AVAILABILITY,
    severity: ALERT_SEVERITIES.CRITICAL,
    metric: 'bot_connected',
    condition: ALERT_CONDITIONS.EQUALS,
    threshold: false,
    duration: 60, // 1 minuto
    enabled: true,
    actions: ['notification', 'webhook', 'whatsapp'],
    tags: ['bot', 'availability']
  },
  {
    name: 'Intentos de Login Fallidos',
    description: 'Se activa con múltiples intentos de login fallidos',
    type: ALERT_TYPES.SECURITY,
    severity: ALERT_SEVERITIES.HIGH,
    metric: 'failed_login_attempts',
    condition: ALERT_CONDITIONS.GREATER_THAN,
    threshold: 5,
    duration: 600, // 10 minutos
    enabled: true,
    actions: ['notification', 'log', 'block_ip'],
    tags: ['security', 'authentication']
  },
  {
    name: 'Anomalía en Actividad de Usuarios',
    description: 'Se activa cuando se detecta actividad anómala de usuarios',
    type: ALERT_TYPES.ANOMALY,
    severity: ALERT_SEVERITIES.MEDIUM,
    metric: 'user_activity_anomaly',
    condition: ALERT_CONDITIONS.DEVIATION,
    threshold: 2.5, // 2.5 desviaciones estándar
    duration: 900, // 15 minutos
    enabled: true,
    actions: ['notification'],
    tags: ['users', 'anomaly']
  },
  {
    name: 'Espacio en Disco Bajo',
    description: 'Se activa cuando el espacio en disco es menor al 10%',
    type: ALERT_TYPES.THRESHOLD,
    severity: ALERT_SEVERITIES.HIGH,
    metric: 'disk_usage_percent',
    condition: ALERT_CONDITIONS.GREATER_THAN,
    threshold: 90,
    duration: 300,
    enabled: true,
    actions: ['notification', 'cleanup'],
    tags: ['system', 'storage']
  }
];
