import db from '../lib/database.js';
import logger from '../lib/log-manager.js';

class NotificationsController {
    /**
     * Obtener todas las notificaciones
     */
    async getAll(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 50;
            const offset = parseInt(req.query.offset) || 0;
            const onlyUnread = req.query.unread === 'true';

            let query = 'SELECT * FROM notifications';
            const params = [];

            if (onlyUnread) {
                query += ' WHERE leida = false';
            }

            query += ' ORDER BY fecha_creacion DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
            params.push(limit, offset);

            const result = await db.query(query, params);
            
            // Obtener conteo de no leídas
            const unreadCount = await db.query('SELECT COUNT(*) FROM notifications WHERE leida = false');

            res.json({
                success: true,
                data: result.rows,
                unreadCount: parseInt(unreadCount.rows[0].count),
                meta: { limit, offset }
            });
        } catch (error) {
            logger.error('Error en NotificationsController.getAll:', error);
            res.status(500).json({ success: false, message: 'Error al obtener notificaciones' });
        }
    }

    /**
     * Crear una nueva notificación
     */
    async create(req, res) {
        const { titulo, mensaje, tipo, categoria, data, user_id } = req.body;
        
        if (!titulo || !mensaje) {
            return res.status(400).json({ success: false, message: 'Título y mensaje son requeridos' });
        }

        try {
            const query = `
                INSERT INTO notifications (titulo, mensaje, tipo, categoria, data, user_id)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
            `;
            const params = [
                titulo, 
                mensaje, 
                tipo || 'info', 
                categoria || 'general', 
                JSON.stringify(data || {}),
                user_id || null
            ];

            const result = await db.query(query, params);
            
            // Emitir vía WebSocket si está disponible
            if (global.io) {
                global.io.emit('notification:new', result.rows[0]);
            }

            res.status(201).json({ success: true, data: result.rows[0] });
        } catch (error) {
            logger.error('Error en NotificationsController.create:', error);
            res.status(500).json({ success: false, message: 'Error al crear notificación' });
        }
    }

    /**
     * Marcar notificación como leída
     */
    async markAsRead(req, res) {
        const { id } = req.params;

        try {
            const query = `
                UPDATE notifications 
                SET leida = true, fecha_leida = CURRENT_TIMESTAMP 
                WHERE id = $1 
                RETURNING *
            `;
            const result = await db.query(query, [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
            }

            res.json({ success: true, data: result.rows[0] });
        } catch (error) {
            logger.error('Error en NotificationsController.markAsRead:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar notificación' });
        }
    }

    /**
     * Marcar todas como leídas
     */
    async markAllAsRead(req, res) {
        try {
            await db.query('UPDATE notifications SET leida = true, fecha_leida = CURRENT_TIMESTAMP WHERE leida = false');
            res.json({ success: true, message: 'Todas las notificaciones marcadas como leídas' });
        } catch (error) {
            logger.error('Error en NotificationsController.markAllAsRead:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar notificaciones' });
        }
    }

    /**
     * Eliminar una notificación
     */
    async delete(req, res) {
        const { id } = req.params;

        try {
            const result = await db.query('DELETE FROM notifications WHERE id = $1 RETURNING id', [id]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Notificación no encontrada' });
            }

            res.json({ success: true, message: 'Notificación eliminada' });
        } catch (error) {
            logger.error('Error en NotificationsController.delete:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar notificación' });
        }
    }
}

export default new NotificationsController();
