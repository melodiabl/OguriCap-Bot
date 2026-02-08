// ... (Mantener las importaciones existentes)

class UserDataSynchronizer {
  constructor() {
    // Constructor existente
  }

  /**
   * Sincronizar notificaciones de LowDB a PostgreSQL
   */
  async syncNotificationsWithPostgres() {
    try {
      if (!global.db?.pool) return { migrated: 0, errors: 0 };
      
      const legacyNotifications = global.db?.data?.notifications || {};
      const notificationEntries = Object.entries(legacyNotifications);
      
      if (notificationEntries.length === 0) return { migrated: 0, errors: 0 };

      console.log(`UserDataSynchronizer: Migrating ${notificationEntries.length} notifications to PostgreSQL...`);
      
      let migrated = 0;
      let errors = 0;

      for (const [id, notif] of notificationEntries) {
        try {
          const check = await global.db.pool.query(
            'SELECT id FROM notifications WHERE titulo = $1 AND mensaje = $2 AND fecha_creacion = $3',
            [notif.title || notif.titulo, notif.message || notif.mensaje, notif.created_at || notif.fecha_creacion]
          );

          if (check.rows.length === 0) {
            await global.db.pool.query(
              `INSERT INTO notifications (titulo, mensaje, tipo, categoria, leida, user_id, data, fecha_creacion)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                notif.title || notif.titulo || 'Sin título',
                notif.message || notif.mensaje || '',
                notif.type || notif.tipo || 'info',
                notif.category || notif.categoria || 'general',
                notif.read || notif.leida || false,
                notif.user_id || null,
                JSON.stringify(notif.metadata || notif.data || {}),
                notif.created_at || notif.fecha_creacion || new Date().toISOString()
              ]
            );
            migrated++;
          }
        } catch (err) {
          console.error(`Error migrating notification ${id}:`, err);
          errors++;
        }
      }

      if (migrated > 0) {
        global.db.data.notifications = {};
        if (typeof global.db.write === 'function') await global.db.write();
      }

      return { migrated, errors };
    } catch (error) {
      console.error('UserDataSynchronizer: Error syncing notifications:', error);
      return { migrated: 0, errors: 1 };
    }
  }

  // ... (Resto de métodos existentes)
}
