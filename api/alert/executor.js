import notificationSystem, { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } from '../notification/index.js';
import { ALERT_SEVERITIES } from './types.js';

/**
 * Ejecuta las acciones de una alerta
 */
export async function executeActions(actions, rule, alert) {
  for (const action of actions) {
    try {
      await executeAction(action, rule, alert);
    } catch (error) {
      console.error(`Error executing action ${action}:`, error);
    }
  }
}

/**
 * Ejecuta una acción específica
 */
export async function executeAction(action, rule, alert) {
  switch (action) {
    case 'notification':
      await notificationSystem.send({
        type: getNotificationType(rule.severity),
        title: `🚨 Alerta: ${rule.name}`,
        message: alert.message,
        category: NOTIFICATION_CATEGORIES.SECURITY,
        data: {
          alertId: alert.id,
          ruleId: rule.id,
          severity: rule.severity,
          metric: alert.details.metric,
          value: alert.details.value
        }
      });
      break;

    case 'log':
      console.warn(`[ALERT] ${rule.name}: ${alert.message}`);
      break;

    case 'webhook':
      await callWebhook(rule, alert);
      break;

    case 'whatsapp':
      await sendWhatsAppAlert(rule, alert);
      break;

    case 'block_ip':
      await blockSuspiciousIP(alert);
      break;

    case 'cleanup':
      await performCleanup(alert);
      break;

    case 'restart_bot':
      await restartBot(alert);
      break;

    case 'email':
      try {
        const emailConfig = await import('../email/config.js')
        const smtpCfg = emailConfig.getSmtpConfig?.()
        const adminEmail = smtpCfg?.from || null
        if (!adminEmail) break
        const { sendSystemAlertEmail } = await import('../email/index.js')
        await sendSystemAlertEmail({
          to: adminEmail,
          metric: rule.metric || alert.details?.metric || 'sistema',
          value: String(alert.details?.value ?? ''),
          threshold: String(rule.threshold ?? ''),
          since: new Date().toUTCString(),
          level: rule.severity >= ALERT_SEVERITIES.CRITICAL ? 'critical' : 'warning',
        })
      } catch {}
      break;

    default:
      console.warn(`Unknown alert action: ${action}`);
  }
}

/**
 * Llamar webhook
 */
export async function callWebhook(rule, alert) {
  try {
    const webhookUrl = process.env.WEBHOOK_URL_ALERTS;
    if (!webhookUrl) {
      console.warn('No webhook URL configured');
      return;
    }

    const payload = {
      alert: {
        id: alert.id,
        ruleName: rule.name,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        triggeredAt: alert.triggeredAt
      },
      rule: {
        id: rule.id,
        name: rule.name,
        type: rule.type
      },
      timestamp: new Date().toISOString()
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'WhatsApp-Bot-Alert-System/1.0'
      },
      body: JSON.stringify(payload),
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log(`Webhook sent successfully for alert ${alert.id}`);
  } catch (error) {
    console.error('Error calling webhook:', error);
    throw error;
  }
}

/**
 * Enviar alerta por WhatsApp
 */
export async function sendWhatsAppAlert(rule, alert) {
  try {
    const adminNumbers = getAdminNumbers();
    if (!adminNumbers.length) {
      console.warn('No admin numbers configured for WhatsApp alerts');
      return;
    }

    const message = `🚨 *ALERTA DE SEGURIDAD*\n\n` +
                   `📋 *Regla:* ${rule.name}\n` +
                   `⚠️ *Severidad:* ${getSeverityLabel(alert.severity)}\n` +
                   `📝 *Mensaje:* ${alert.message}\n` +
                   `🕐 *Hora:* ${new Date(alert.triggeredAt).toLocaleString()}\n\n` +
                   `_Sistema de Alertas WhatsApp Bot_`;

    for (const number of adminNumbers) {
      try {
        if (global.conn && global.conn.user) {
          await global.conn.sendMessage(`${number}@s.whatsapp.net`, { text: message });
          console.log(`WhatsApp alert sent to ${number}`);
        }
      } catch (error) {
        console.error(`Error sending WhatsApp alert to ${number}:`, error);
      }
    }
  } catch (error) {
    console.error('Error sending WhatsApp alert:', error);
    throw error;
  }
}

/**
 * Bloquear IP sospechosa
 */
export async function blockSuspiciousIP(alert) {
  try {
    const ip = alert.details?.clientIP || alert.metadata?.ip;
    if (!ip) {
      console.warn('No IP found in alert for blocking');
      return;
    }

    // Importar security monitor dinámicamente
    const { default: securityMonitor } = await import('../security-monitor.js');
    await securityMonitor.blockIP(ip, 3600000, `Auto-blocked by alert: ${alert.ruleName}`);

    console.log(`IP ${ip} blocked due to alert: ${alert.ruleName}`);
  } catch (error) {
    console.error('Error blocking suspicious IP:', error);
  }
}

/**
 * Realizar limpieza del sistema
 */
export async function performCleanup(alert) {
  try {
    console.log('Performing system cleanup due to alert:', alert.ruleName);

    // Limpiar logs antiguos
    const fs = await import('fs');
    const path = await import('path');

    const logsDir = path.join(process.cwd(), 'logs');
    if (fs.existsSync(logsDir)) {
      const files = fs.readdirSync(logsDir);
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < oneWeekAgo) {
          fs.unlinkSync(filePath);
          console.log(`Deleted old log file: ${file}`);
        }
      }
    }

    // Limpiar cache de Node.js
    if (global.gc) {
      global.gc();
      console.log('Garbage collection performed');
    }

  } catch (error) {
    console.error('Error performing cleanup:', error);
  }
}

/**
 * Reiniciar bot
 */
export async function restartBot(alert) {
  try {
    console.log('Restarting bot due to critical alert:', alert.ruleName);

    // Notificar antes de reiniciar
    await notificationSystem.send({
      type: NOTIFICATION_TYPES.CRITICAL,
      title: '🔄 Reiniciando Bot',
      message: `El bot se reiniciará debido a la alerta: ${alert.ruleName}`,
      category: NOTIFICATION_CATEGORIES.SYSTEM
    });

    // Esperar un poco para que se envíe la notificación
    setTimeout(() => {
      process.exit(1); // PM2 o el supervisor reiniciará el proceso
    }, 5000);

  } catch (error) {
    console.error('Error restarting bot:', error);
  }
}

/**
 * Obtener números de administradores
 */
export function getAdminNumbers() {
  // Obtener números de administradores desde la configuración
  const adminNumbers = [];

  if (global.owner && Array.isArray(global.owner)) {
    adminNumbers.push(...global.owner);
  }

  // También desde variables de entorno
  if (process.env.ADMIN_NUMBERS) {
    const envNumbers = process.env.ADMIN_NUMBERS.split(',').map(n => n.trim());
    adminNumbers.push(...envNumbers);
  }

  return [...new Set(adminNumbers)]; // Eliminar duplicados
}

/**
 * Obtener etiqueta de severidad
 */
export function getSeverityLabel(severity) {
  switch (severity) {
    case ALERT_SEVERITIES.EMERGENCY: return 'EMERGENCIA';
    case ALERT_SEVERITIES.CRITICAL: return 'CRÍTICA';
    case ALERT_SEVERITIES.HIGH: return 'ALTA';
    case ALERT_SEVERITIES.MEDIUM: return 'MEDIA';
    default: return 'BAJA';
  }
}

/**
 * Obtener nivel de severidad
 */
export function getSeverityLevel(severity) {
  switch (severity) {
    case ALERT_SEVERITIES.EMERGENCY:
    case ALERT_SEVERITIES.CRITICAL:
      return 'critical';
    case ALERT_SEVERITIES.HIGH:
      return 'error';
    case ALERT_SEVERITIES.MEDIUM:
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Obtener tipo de notificación según severidad
 */
export function getNotificationType(severity) {
  switch (severity) {
    case ALERT_SEVERITIES.EMERGENCY:
    case ALERT_SEVERITIES.CRITICAL:
      return NOTIFICATION_TYPES.CRITICAL;
    case ALERT_SEVERITIES.HIGH:
      return NOTIFICATION_TYPES.ERROR;
    case ALERT_SEVERITIES.MEDIUM:
      return NOTIFICATION_TYPES.WARNING;
    default:
      return NOTIFICATION_TYPES.INFO;
  }
}
