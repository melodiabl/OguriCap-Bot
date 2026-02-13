import express from 'express';
const router = express.Router();
import notificationsController from '../controllers/notifications-controller.js';

// Obtener todas las notificaciones
router.get('/', (req, res) => notificationsController.getAll(req, res));

// Crear una nueva notificación
router.post('/', (req, res) => notificationsController.create(req, res));

// Marcar todas como leídas
router.post('/mark-all-read', (req, res) => notificationsController.markAllAsRead(req, res));

// Marcar una como leída
router.patch('/:id/read', (req, res) => notificationsController.markAsRead(req, res));

// Eliminar una notificación
router.delete('/:id', (req, res) => notificationsController.delete(req, res));

export default router;
