const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications-controller');

// Obtener todas las notificaciones
router.get('/', notificationsController.getAll);

// Crear una nueva notificación
router.post('/', notificationsController.create);

// Marcar todas como leídas
router.post('/mark-all-read', notificationsController.markAllAsRead);

// Marcar una como leída
router.patch('/:id/read', notificationsController.markAsRead);

// Eliminar una notificación
router.delete('/:id', notificationsController.delete);

module.exports = router;
