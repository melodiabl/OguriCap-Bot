/**
 * Sistema de limpieza automática de notificaciones antiguas
 * Previene acumulación de notificaciones residuales
 */

export const NOTIFICATION_RETENTION_DAYS = 30; // Días para mantener notificaciones leídas
export const NOTIFICATION_UNREAD_RETENTION_DAYS = 90; // Días para mantener notificaciones no leídas

/**
 * Limpia notificaciones antiguas del sistema
 * @param {Object} panelDb - Base de datos del panel
 * @param {Object} options - Opciones de limpieza
 * @returns {Object} Estadísticas de limpieza
 */
export function cleanupOldNotifications(panelDb, options = {}) {
  if (!panelDb?.notifications) {
    return { deleted: 0, kept: 0, error: 'No hay notificaciones para limpiar' };
  }

  const retentionDays = options.retentionDays || NOTIFICATION_RETENTION_DAYS;
  const unreadRetentionDays = options.unreadRetentionDays || NOTIFICATION_UNREAD_RETENTION_DAYS;
  const now = new Date();
  
  let deleted = 0;
  let kept = 0;

  try {
    for (const [id, notification] of Object.entries(panelDb.notifications)) {
      if (!notification) continue;

      const createdAt = new Date(notification.created_at || notification.fecha_creacion || 0);
      const daysSinceCreation = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

      // Eliminar notificaciones leídas antiguas
      if (notification.leida || notification.read) {
        if (daysSinceCreation > retentionDays) {
          delete panelDb.notifications[id];
          deleted++;
          continue;
        }
      }

      // Eliminar notificaciones no leídas muy antiguas
      if (!notification.leida && !notification.read) {
        if (daysSinceCreation > unreadRetentionDays) {
          delete panelDb.notifications[id];
          deleted++;
          continue;
        }
      }

      kept++;
    }

    console.log(`🧹 Limpieza de notificaciones: ${deleted} eliminadas, ${kept} conservadas`);
    return { deleted, kept };
  } catch (error) {
    console.error('Error en limpieza de notificaciones:', error);
    return { deleted, kept, error: error.message };
  }
}

/**
 * Elimina notificaciones duplicadas
 * @param {Object} panelDb - Base de datos del panel
 * @returns {Object} Estadísticas de deduplicación
 */
export function deduplicateNotifications(panelDb) {
  if (!panelDb?.notifications) {
    return { deleted: 0, kept: 0, error: 'No hay notificaciones para deduplicar' };
  }

  const seen = new Map();
  let deleted = 0;
  let kept = 0;

  try {
    const notifications = Object.entries(panelDb.notifications);
    
    for (const [id, notification] of notifications) {
      if (!notification) continue;

      // Crear clave única basada en título, mensaje y timestamp (con margen de 1 minuto)
      const title = notification.title || notification.titulo || '';
      const message = notification.message || notification.mensaje || '';
      const createdAt = new Date(notification.created_at || notification.fecha_creacion || 0);
      const roundedTime = Math.floor(createdAt.getTime() / 60000); // Redondear a minuto
      
      const key = `${title}|${message}|${roundedTime}`;

      if (seen.has(key)) {
        // Duplicado encontrado - mantener el más reciente
        const existingId = seen.get(key);
        const existing = panelDb.notifications[existingId];
        
        if (notification.id > existing.id) {
          // La nueva es más reciente, eliminar la antigua
          delete panelDb.notifications[existingId];
          seen.set(key, id);
          deleted++;
        } else {
          // La existente es más reciente, eliminar la nueva
          delete panelDb.notifications[id];
          deleted++;
        }
      } else {
        seen.set(key, id);
        kept++;
      }
    }

    console.log(`🔍 Deduplicación de notificaciones: ${deleted} duplicadas eliminadas, ${kept} únicas conservadas`);
    return { deleted, kept };
  } catch (error) {
    console.error('Error en deduplicación de notificaciones:', error);
    return { deleted, kept, error: error.message };
  }
}

/**
 * Normaliza el formato de notificaciones para consistencia
 * @param {Object} panelDb - Base de datos del panel
 * @returns {number} Número de notificaciones normalizadas
 */
export function normalizeNotifications(panelDb) {
  if (!panelDb?.notifications) {
    return 0;
  }

  let normalized = 0;

  try {
    for (const notification of Object.values(panelDb.notifications)) {
      if (!notification) continue;

      let changed = false;

      // Normalizar campos de título
      if (notification.titulo && !notification.title) {
        notification.title = notification.titulo;
        changed = true;
      }

      // Normalizar campos de mensaje
      if (notification.mensaje && !notification.message) {
        notification.message = notification.mensaje;
        changed = true;
      }

      // Normalizar campos de lectura
      if (notification.read !== undefined && notification.leida === undefined) {
        notification.leida = notification.read;
        changed = true;
      } else if (notification.leida !== undefined && notification.read === undefined) {
        notification.read = notification.leida;
        changed = true;
      }

      // Normalizar campos de tipo
      if (notification.tipo && !notification.type) {
        notification.type = notification.tipo;
        changed = true;
      }

      // Normalizar campos de categoría
      if (notification.categoria && !notification.category) {
        notification.category = notification.categoria;
        changed = true;
      }

      // Normalizar campos de fecha
      if (notification.fecha_creacion && !notification.created_at) {
        notification.created_at = notification.fecha_creacion;
        changed = true;
      }

      if (changed) normalized++;
    }

    if (normalized > 0) {
      console.log(`📝 ${normalized} notificaciones normalizadas`);
    }
    return normalized;
  } catch (error) {
    console.error('Error en normalización de notificaciones:', error);
    return normalized;
  }
}

/**
 * Ejecuta todas las operaciones de mantenimiento de notificaciones
 * @param {Object} panelDb - Base de datos del panel
 * @returns {Object} Estadísticas completas
 */
export function performNotificationMaintenance(panelDb) {
  console.log('🔧 Iniciando mantenimiento de notificaciones...');
  
  const stats = {
    normalized: normalizeNotifications(panelDb),
    deduplicated: deduplicateNotifications(panelDb),
    cleaned: cleanupOldNotifications(panelDb)
  };

  console.log('✅ Mantenimiento de notificaciones completado:', stats);
  return stats;
}

export default {
  cleanupOldNotifications,
  deduplicateNotifications,
  normalizeNotifications,
  performNotificationMaintenance,
  NOTIFICATION_RETENTION_DAYS,
  NOTIFICATION_UNREAD_RETENTION_DAYS
};
