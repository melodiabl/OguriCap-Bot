import { getBrandConfig } from './config.js'
import { renderPanelEmail, escapeHtml } from './renderer.js'
import { buildRoleChangedEmail } from './templates/role-changed.js'
import { buildBotAlertEmail } from './templates/bot-alert.js'
import { buildSubbotAlertEmail } from './templates/subbot-alert.js'
import { buildAporteReceivedEmail } from './templates/aporte-received.js'
import { buildLoginNewDeviceEmail } from './templates/login-new-device.js'
import { buildAccountDeletedEmail } from './templates/account-deleted.js'
import { buildAporteAceptadoEmail } from './templates/aporte-aceptado.js'
import { buildAporteRechazadoEmail } from './templates/aporte-rechazado.js'
import { buildAportePendienteEmail } from './templates/aporte-pendiente.js'
import { buildMaintenanceNoticeEmail } from './templates/maintenance-notice.js'
import { buildMaintenanceCompletedEmail } from './templates/maintenance-completed.js'
import { buildAccountSuspendedEmail } from './templates/account-suspended.js'
import { buildAccountReactivatedEmail } from './templates/account-reactivated.js'
import { buildSubbotCreatedEmail } from './templates/subbot-created.js'
import { buildSubbotDeletedEmail } from './templates/subbot-deleted.js'
import { buildTwoFactorCodeEmail } from './templates/two-factor-code.js'
import { buildSystemAlertEmail } from './templates/system-alert.js'

function buildEmailPreview(template = 'test') {
  const brand = getBrandConfig()
  const previewTo = 'admin@ejemplo.com'

  switch (template) {
    case 'welcome': {
      const username = 'OguriAdmin'
      const role = 'Owner'
      const subject = `¡Bienvenido al equipo de ${brand.name}!`
      const contentHtml = `
        Hola <strong style="color:#ffffff;">${escapeHtml(username)}</strong>,<br /><br />
        ¡Bienvenido al equipo de <strong style="color:#ffffff;">${escapeHtml(brand.name)}</strong>!<br /><br />
        Tu cuenta ha sido creada exitosamente con el rol: <strong style="color:#10b981;">${escapeHtml(role)}</strong><br /><br />
        Ya podés acceder al panel de administración y comenzar a gestionar el bot.
      `.trim()
      return {
        template: 'welcome', title: 'Bienvenida', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'Tu cuenta ha sido creada exitosamente.', title: '¡Bienvenido al equipo!', contentHtml, ctaUrl: brand.panelUrl, ctaText: 'Acceder al panel' }),
      }
    }
    case 'role_updated': {
      const username = 'Juan Pérez'
      const oldRole = 'Usuario'
      const newRole = 'Administrador'
      const subject = `Tu rol ha cambiado en ${brand.name}`
      const contentHtml = `
        Hola <strong style="color:#ffffff;">${escapeHtml(username)}</strong>,<br /><br />
        Tu rol ha sido actualizado.<br /><br />
        Anterior: <strong style="color:#94a3b8;">${escapeHtml(oldRole)}</strong><br />
        Nuevo: <strong style="color:#10b981;">${escapeHtml(newRole)}</strong><br /><br />
        Ya podes acceder a las nuevas funcionalidades del panel.
      `.trim()
      return {
        template: 'role_updated', title: 'Rol Actualizado', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'Tu rol ha sido actualizado.', title: 'Rol Actualizado', contentHtml, ctaUrl: brand.panelUrl, ctaText: 'Ver perfil' }),
      }
    }
    case 'subbot_disconnected': {
      const subbotCode = '+5491155555555'
      const reason = 'Sesion cerrada'
      const subject = `Subbot desconectado - ${brand.name}`
      const contentHtml = `
        Hola <strong style="color:#ffffff;">Admin</strong>,<br /><br />
        Un subbot se ha desconectado.<br /><br />
        Numero: <strong style="color:#ffffff;">${escapeHtml(subbotCode)}</strong><br />
        Razon: <strong style="color:#94a3b8;">${escapeHtml(reason)}</strong><br /><br />
        Podes volver a conectarlo desde el panel.
      `.trim()
      return {
        template: 'subbot_disconnected', title: 'Subbot Desconectado', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'Un subbot se ha desconectado.', title: 'Subbot Desconectado', contentHtml, ctaUrl: `${brand.panelUrl}/subbots`, ctaText: 'Ver subbots' }),
      }
    }
    case 'password-reset': {
      const username = 'OguriAdmin'
      const token = 'preview-reset-token'
      const expiresMinutes = 30
      const resetUrl = `${brand.panelUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
      const subject = 'Restablecer contraseña - Oguri Bot'
      const contentHtml = `
        Hola <strong style="color:#ffffff;">${escapeHtml(username)}</strong>.<br /><br />
        Recibimos una solicitud para restablecer tu contraseña.<br /><br />
        <strong style="color:#ffffff;">Este link vence en ${expiresMinutes} minutos.</strong><br /><br />
        Si no solicitaste este cambio, simplemente ignorá este email y tu contraseña permanecerá sin cambios.
      `.trim()
      return {
        template: 'password-reset', title: 'Password Reset', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: `Restablecé tu contraseña (vence en ${expiresMinutes} min)`, title: 'Restablecer contraseña', contentHtml, ctaUrl: resetUrl, ctaText: 'Restablecer contraseña' }),
      }
    }
    case 'security-alert': {
      const subject = 'Alerta de seguridad'
      return {
        template: 'security-alert', title: 'Alerta de seguridad', subject, recipient: previewTo,
        html: renderPanelEmail({
          subject, preheader: 'Revisa este evento en el panel.', title: 'Login sospechoso detectado',
          contentHtml: `
            <p style="margin:0 0 16px 0;">Se detectó un intento de acceso fuera del patrón habitual. Revisa la actividad reciente.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:8px;">
              <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">IP</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">181.23.44.10</td></tr>
              <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">Fecha</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">12/04/2026 21:14</td></tr>
              <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">Actor</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">oguri-owner</td></tr>
            </table>
          `.trim(),
          ctaUrl: brand.panelUrl, ctaText: 'Abrir panel',
        }),
      }
    }
    case 'notification': {
      const subject = `${brand.name} - Notificación del sistema`
      return {
        template: 'notification', title: 'Notificación', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'El sistema generó una notificación importante.', title: 'Notificación del sistema', contentHtml: 'Se completó una tarea programada y el panel registró la actividad correctamente.', ctaUrl: brand.panelUrl, ctaText: 'Ver en el panel' }),
      }
    }
    case 'registration': {
      const subject = '¡Bienvenido a Oguri Bot! - Registro exitoso'
      return {
        template: 'registration', title: 'Registro exitoso', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'Tu cuenta fue creada correctamente.', title: '¡Bienvenido a Oguri Bot!', contentHtml: `Hola <strong style="color:#ffffff;">NuevoUsuario</strong>, ¡tu cuenta fue creada correctamente!<br /><br /><span style="color:#e2e8f0;">Tu rol: <strong style="color:#ffffff;">Usuario</strong></span><br /><br />Ya podés acceder al panel y comenzar a usar todas las funcionalidades del bot.`, ctaUrl: brand.panelUrl, ctaText: 'Ir al panel' }),
      }
    }
    case 'role-changed': {
      const { html, subject } = buildRoleChangedEmail({ username: 'OguriAdmin', oldRole: 'Usuario', newRole: 'Administrador' })
      return { template: 'role-changed', title: 'Rol Actualizado', subject, recipient: previewTo, html }
    }
    case 'bot-alert-disconnected': {
      const { html, subject } = buildBotAlertEmail({ botName: 'OguriBot', status: 'disconnected', reason: 'Timeout de conexión', since: '16/05/2026 14:32' })
      return { template: 'bot-alert-disconnected', title: 'Bot Desconectado', subject, recipient: previewTo, html }
    }
    case 'bot-alert-reconnected': {
      const { html, subject } = buildBotAlertEmail({ botName: 'OguriBot', status: 'reconnected' })
      return { template: 'bot-alert-reconnected', title: 'Bot Reconectado', subject, recipient: previewTo, html }
    }
    case 'subbot-alert': {
      const { html, subject } = buildSubbotAlertEmail({ subbotNumber: '+5491155555555', subbotName: 'Mac', status: 'disconnected', reason: 'QR expirado' })
      return { template: 'subbot-alert', title: 'Subbot Desconectado', subject, recipient: previewTo, html }
    }
    case 'aporte-received': {
      const { html, subject } = buildAporteReceivedEmail({ username: 'Juan Pérez', amount: '$2.500', concept: 'Mensualidad mayo 2026', date: '16/05/2026' })
      return { template: 'aporte-received', title: 'Aporte Recibido', subject, recipient: previewTo, html }
    }
    case 'login-new-device': {
      const { html, subject } = buildLoginNewDeviceEmail({ username: 'OguriAdmin', ip: '190.210.45.123', location: 'Buenos Aires, Argentina', device: 'Chrome 124 / Windows', time: '16/05/2026 14:55' })
      return { template: 'login-new-device', title: 'Acceso Nuevo Dispositivo', subject, recipient: previewTo, html }
    }
    case 'account-deleted': {
      const { html, subject } = buildAccountDeletedEmail({ username: 'OguriAdmin', deletedBy: 'Admin del sistema', reason: 'Solicitud del usuario' })
      return { template: 'account-deleted', title: 'Cuenta Eliminada', subject, recipient: previewTo, html }
    }
    case 'aporte-aceptado': {
      const { html, subject } = buildAporteAceptadoEmail({ username: 'Juan Pérez', amount: '$2.500', concept: 'Mensualidad mayo', acceptedBy: 'OguriAdmin' })
      return { template: 'aporte-aceptado', title: 'Aporte Aceptado', subject, recipient: previewTo, html }
    }
    case 'aporte-rechazado': {
      const { html, subject } = buildAporteRechazadoEmail({ username: 'Juan Pérez', amount: '$2.500', reason: 'Comprobante ilegible', rejectedBy: 'OguriAdmin' })
      return { template: 'aporte-rechazado', title: 'Aporte Rechazado', subject, recipient: previewTo, html }
    }
    case 'aporte-pendiente': {
      const { html, subject } = buildAportePendienteEmail({ username: 'María García', amount: '$1.000', concept: 'Cuota junio', dueDate: '31/05/2026' })
      return { template: 'aporte-pendiente', title: 'Aporte Pendiente', subject, recipient: previewTo, html }
    }
    case 'maintenance-completed': {
      const { html, subject } = buildMaintenanceCompletedEmail({
        completedAt: new Date().toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
        durationMinutes: 42,
        restoredServices: ['Panel de administración', 'API REST', 'Sistema de notificaciones'],
        note: 'Se aplicaron mejoras de rendimiento. El tiempo de respuesta mejoró un 15%.',
      })
      return { template: 'maintenance-completed', title: 'Mantenimiento completado', subject, recipient: previewTo, html }
    }
    case 'maintenance-notice': {
      const { html, subject } = buildMaintenanceNoticeEmail({
        startTime: new Date(Date.now() + 3 * 3600000).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
        durationMinutes: 45,
        affectedServices: ['Panel de administración', 'API REST', 'Sistema de notificaciones'],
        unaffectedServices: ['Bot de WhatsApp', 'Base de datos'],
        reason: 'Actualización de seguridad y mejoras de rendimiento en el servidor.',
        contactEmail: 'soporte@melodiaauris.qzz.io',
      })
      return { template: 'maintenance-notice', title: 'Mantenimiento programado', subject, recipient: previewTo, html }
    }
    case 'account-suspended': {
      const { html, subject } = buildAccountSuspendedEmail({ username: 'OguriAdmin', suspendedBy: 'melodia (Owner)', reason: 'Revisión de cuenta', contactUrl: brand.panelUrl })
      return { template: 'account-suspended', title: 'Cuenta suspendida', subject, recipient: previewTo, html }
    }
    case 'account-reactivated': {
      const { html, subject } = buildAccountReactivatedEmail({ username: 'OguriAdmin', reactivatedBy: 'melodia (Owner)', note: 'Tu acceso fue restaurado luego de la revisión.' })
      return { template: 'account-reactivated', title: 'Cuenta reactivada', subject, recipient: previewTo, html }
    }
    case 'subbot-created': {
      const { html, subject } = buildSubbotCreatedEmail({ subbotName: 'Lumine', subbotNumber: '+5217441977049', createdBy: 'melodia' })
      return { template: 'subbot-created', title: 'Sub-bot creado', subject, recipient: previewTo, html }
    }
    case 'subbot-deleted': {
      const { html, subject } = buildSubbotDeletedEmail({ subbotName: 'Mac (+50670090542)', deletedBy: 'melodia', reason: 'QR expirado sin renovar' })
      return { template: 'subbot-deleted', title: 'Sub-bot eliminado', subject, recipient: previewTo, html }
    }
    case 'two-factor-code': {
      const { html, subject } = buildTwoFactorCodeEmail({ username: 'OguriAdmin', code: '482 917', expiresMinutes: 5 })
      return { template: 'two-factor-code', title: 'Código 2FA', subject, recipient: previewTo, html }
    }
    case 'system-alert': {
      const { html, subject } = buildSystemAlertEmail({ metric: 'memory_usage_percent', value: '91.4%', threshold: '85%', since: '16/05/2026 14:32', level: 'warning' })
      return { template: 'system-alert', title: 'Alerta del sistema', subject, recipient: previewTo, html }
    }
    default: {
      const subject = `Prueba de configuración - ${brand.name}`
      return {
        template: 'test', title: 'Email de prueba', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'Mensaje de prueba del sistema.', title: '¡Servicio de Email Activo!', contentHtml: `Este es un mensaje de prueba enviado desde tu panel para confirmar que la configuración SMTP es correcta.<br /><br />Tu bot ahora puede enviar notificaciones, reportes y correos de seguridad a <strong style="color:#ffffff;">${previewTo}</strong>.`, ctaUrl: brand.panelUrl, ctaText: 'Ir al panel' }),
      }
    }
  }
}

function buildBroadcastPreview(type = 'announcement') {
  const brand = getBrandConfig()
  const previewTo = 'admin@ejemplo.com'

  switch (type) {
    case 'announcement': {
      const subject = 'Anuncio importante'
      const contentHtml = `
        <h3 style="color:#ffffff;margin:0 0 15px 0;">📢 Anuncio</h3>
        <p style="color:#94a3b8;margin:0 0 20px 0;">Tenemos algo importante que contarte.</p>
        <p style="color:#ffffff;margin:15px 0;">Este es un mensaje de prueba para el sistema de broadcast. Aquí puedes escribir cualquier announcement, actualización o comunicado para tus usuarios.</p>
        <p style="color:#94a3b8;margin:20px 0 0 0;">¿Tienes preguntas? Responde este email.</p>
      `.trim()
      return {
        template: 'broadcast_announcement', title: 'Anuncio', subject: `📢 ${brand.name} - Anuncio`, recipient: previewTo,
        html: renderPanelEmail({ subject: `📢 ${brand.name} - Anuncio`, preheader: 'Tenemos algo importante que contarte.', title: 'Anuncio Importante', contentHtml, ctaUrl: brand.panelUrl, ctaText: 'Ver más' }),
      }
    }
    case 'update': {
      const contentHtml = `
        <h3 style="color:#ffffff;margin:0 0 15px 0;">🎉 Nuevas funcionalidades</h3>
        <p style="color:#94a3b8;margin:0 0 20px 0;">We've been working on improving your bot.</p>
        <div style="background:#1e293b;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="color:#ffffff;margin:10px 0;"><strong>✨ Nuevo sistema de broadcast</strong></p>
          <p style="color:#94a3b8;margin:0 0 15px 0;">Envía notificaciones a todos tus usuarios</p>
          <p style="color:#ffffff;margin:10px 0;"><strong>🔔 Notificaciones push</strong></p>
          <p style="color:#94a3b8;margin:0;">Recibe alerts en tiempo real</p>
        </div>
      `.trim()
      return {
        template: 'broadcast_update', title: 'Novedades', subject: `🎉 ${brand.name} - Novedades`, recipient: previewTo,
        html: renderPanelEmail({ subject: `🎉 ${brand.name} - Novedades`, preheader: 'Nuevas funcionalidades disponibles.', title: 'Novedades del Sistema', contentHtml, ctaUrl: brand.panelUrl, ctaText: 'Ver actualizaciones' }),
      }
    }
    case 'alert': {
      const contentHtml = `
        <h3 style="color:#ffffff;margin:0 0 15px 0;">⚠️ Alerta</h3>
        <p style="color:#94a3b8;margin:0 0 20px 0;">Se ha detectado una alerta que requiere tu atención.</p>
        <div style="background:#7f1d1d;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #dc2626;">
          <p style="color:#fca5a5;margin:5px 0;"><strong>Tipo:</strong> Advertencia</p>
          <p style="color:#fca5a5;margin:5px 0;"><strong>Severidad:</strong> Media</p>
          <p style="color:#fca5a5;margin:5px 0;"><strong>Descripción:</strong> Revisa los logs del sistema</p>
        </div>
        <p style="color:#94a3b8;margin:20px 0 0 0;">Ver detalles en el panel de administración.</p>
      `.trim()
      return {
        template: 'broadcast_alert', title: 'Alerta', subject: `⚠️ ${brand.name} - Alerta`, recipient: previewTo,
        html: renderPanelEmail({ subject: `⚠️ ${brand.name} - Alerta`, preheader: 'Se ha detectado una alerta en el sistema.', title: 'Alerta del Sistema', contentHtml, ctaUrl: brand.panelUrl, ctaText: 'Ver detalles' }),
      }
    }
    default:
      return buildEmailPreview('test')
  }
}

export function getEmailTemplatePreview(template = 'test') {
  if (template.startsWith('broadcast_')) {
    return buildBroadcastPreview(template.replace('broadcast_', ''))
  }
  return buildEmailPreview(template)
}
