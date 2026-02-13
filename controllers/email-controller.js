import nodemailer from 'nodemailer';
import logger from '../lib/log-manager.js';

class EmailController {
    constructor() {
        this.transporter = null;
    }

    getEmailConfig() {
        try {
            const emailConfig = global.db?.data?.panel?.email || {};
            return {
                enabled: !!emailConfig.enabled,
                host: emailConfig.smtp?.host || '',
                port: parseInt(emailConfig.smtp?.port) || 587,
                secure: !!emailConfig.smtp?.secure,
                user: emailConfig.smtp?.user || '',
                pass: emailConfig.smtp?.pass || '',
                from: emailConfig.from || global.gmail || 'noreply@oguribot.com'
            };
        } catch (error) {
            logger.error('Error obteniendo configuración de email:', error);
            return { enabled: false };
        }
    }

    initTransporter(config) {
        if (!config.host || !config.user || !config.pass) {
            return null;
        }

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

    async getStatus(req, res) {
        try {
            const config = this.getEmailConfig();
            let connectionStatus = false;

            if (config.enabled && config.host) {
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
                configured: !!(config.host && config.user),
                enabled: config.enabled,
                hasAuth: !!(config.user && config.pass),
                host: config.host,
                port: config.port,
                connection: connectionStatus
            });
        } catch (error) {
            logger.error('Error en EmailController.getStatus:', error);
            res.status(500).json({ success: false, message: 'Error al obtener estado de email' });
        }
    }

    async verifySmtp(req, res) {
        try {
            const config = this.getEmailConfig();
            const transporter = this.initTransporter(config);

            if (!transporter) {
                return res.status(400).json({ success: false, message: 'Configuración SMTP incompleta' });
            }

            await transporter.verify();
            res.json({ success: true, message: 'Conexión SMTP exitosa' });
        } catch (error) {
            logger.error('Error verificando SMTP:', error);
            res.status(500).json({ success: false, message: 'Error de conexión SMTP', error: error.message });
        }
    }

    async sendTestEmail(req, res) {
        const { to } = req.body;
        const targetEmail = to || global.gmail;

        if (!targetEmail) {
            return res.status(400).json({ success: false, message: 'No se especificó destinatario' });
        }

        try {
            const config = this.getEmailConfig();
            const transporter = this.initTransporter(config);

            if (!transporter) {
                return res.status(400).json({ success: false, message: 'Servicio de email no configurado' });
            }

            const info = await transporter.sendMail({
                from: `"OguriCap Bot" <${config.user}>`,
                to: targetEmail,
                subject: "Prueba de Configuración - OguriCap Bot",
                text: "Este es un email de prueba para verificar que la configuración SMTP de tu panel OguriCap Bot funciona correctamente.",
                html: "<b>¡Hola!</b><br><p>Este es un email de prueba para verificar que la configuración SMTP de tu panel <b>OguriCap Bot</b> funciona correctamente.</p>"
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
