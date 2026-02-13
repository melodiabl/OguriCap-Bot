import express from 'express';
const router = express.Router();
import emailController from '../controllers/email-controller.js';

// Obtener estado del servicio de email
router.get('/status', (req, res) => emailController.getStatus(req, res));

// Verificar configuración SMTP
router.post('/verify', (req, res) => emailController.verifySmtp(req, res));

// Enviar email de prueba
router.post('/test', (req, res) => emailController.sendTestEmail(req, res));

export default router;
