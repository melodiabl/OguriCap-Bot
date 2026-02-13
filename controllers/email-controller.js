import nodemailer from 'nodemailer';
import logger from '../lib/log-manager.js';

class EmailController {
    constructor() {
        this.transporter = null;
    }

    /**
     * Obtener configuración de email priorizando variables de entorno
     */
    getEmailConfig() {
        try {
            // Prioridad: Variables de entorno específicas del usuario -> Configuración de DB -> Defaults
            const envUser = process.env.EMAIL_USER || process.env.USER_EMAIL || '';
            const envPass = process.env.EMAIL_PASS || process.env.APP_PASSWORD || '';
            const envService = process.env.EMAIL_SERVICE || 'gmail'; // OguriServices suele referirse a Gmail/SMTP
            
            const dbConfig = global.db?.data?.panel?.email || {};
            
            return {
                enabled: true, // Asumimos habilitado si el usuario lo pide por env
                service: envService,
                host: dbConfig.smtp?.host || process.env.SMTP_HOST || 'smtp.gmail.com',
                port: parseInt(dbConfig.smtp?.port || process.env.SMTP_PORT) || 587,
                secure: !!(dbConfig.smtp?.secure || process.env.SMTP_SECURE === 'true'),
                user: envUser || dbConfig.smtp?.user || '',
                pass: envPass || dbConfig.smtp?.pass || '',
                from: dbConfig.from || envUser || global.gmail || 'noreply@oguribot.com'
            };
        } catch (error) {
            logger.error('Error obteniendo configuración de email:', error);
            return { enabled: false };
        }
    }

    /**
     * Inicializar el transportador de nodemailer
     */
    initTransporter(config) {
        if (!config.user || !config.pass) {
            return null;
        }

        // Si es Gmail o un servicio conocido, nodemailer lo maneja más fácil con 'service'
        if (config.service && config.service.toLowerCase() === 'gmail') {
            return nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: config.user,
                    pass: config.pass
                }
            });
        }

        // Configuración SMTP genérica
        return nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.secure,
            auth: {
                user: config.user,
                pass: config.pass
            }
        });
    }

    /**
     * Obtener estado del servicio de email
     */
    async getStatus(req, res) {
        try {
            const config = this.getEmailConfig();
            let connectionStatus = false;

            if (config.user && config.pass) {
                const transporter = this.initTransporter(config);
                if (transporter) {
                    try {
                        await transporter.verify();
                        connectionStatus = true;
                    } catch (e) {
                        logger.warn('Error verificando SMTP:', e.message);
                    }
                }
            }

            res.json({
                success: true,
                configured: !!(config.user && config.pass),
                service: config.service,
                user: config.user ? `${config.user.split('@')[0]}@...` : null, // Ocultar por seguridad
                connection: connectionStatus
            });
        } catch (error) {
            logger.error('Error en EmailController.getStatus:', error);
            res.status(500).json({ success: false, message: 'Error al obtener estado de email' });
        }
    }

    /**
     * Verificar configuración SMTP
     */
    async verifySmtp(req, res) {
        try {
            const config = this.getEmailConfig();
            const transporter = this.initTransporter(config);

            if (!transporter) {
                return res.status(400).json({ success: false, message: 'Configuración de credenciales incompleta en .env o DB' });
            }

            await transporter.verify();
            res.json({ success: true, message: 'Conexión SMTP exitosa' });
        } catch (error) {
            logger.error('Error verificando SMTP:', error);
            res.status(500).json({ success: false, message: 'Error de conexión SMTP', error: error.message });
        }
    }

    /**
     * Enviar email de prueba
     */
    async sendTestEmail(req, res) {
        const { to } = req.body;
        const config = this.getEmailConfig();
        const targetEmail = to || config.user || global.gmail;

        if (!targetEmail) {
            return res.status(400).json({ success: false, message: 'No se especificó destinatario' });
        }

        try {
            const transporter = this.initTransporter(config);

            if (!transporter) {
                return res.status(400).json({ success: false, message: 'Servicio de email no configurado (faltan credenciales)' });
            }

            const info = await transporter.sendMail({
                from: `"OguriCap Bot" <${config.user}>`,
                to: targetEmail,
                subject: "Prueba de Configuración - OguriCap Bot",
                text: "Este es un email de prueba para verificar que la configuración de tu panel OguriCap Bot funciona correctamente.",
                html: "<b>¡Hola!</b><br><p>Este es un email de prueba para verificar que la configuración de tu panel <b>OguriCap Bot</b> funciona correctamente.</p>"
            });

            logger.info('Email de prueba enviado:', info.messageId);
            res.json({ success: true, message: 'Email de prueba enviado con éxito', messageId: info.messageId });
        } catch (error) {
            logger.error('Error enviando email de prueba:', error);
            res.status(500).json({ success: false, message: 'Error al enviar email de prueba', error: error.message });
        }
    }
}

export default new EmailController();
