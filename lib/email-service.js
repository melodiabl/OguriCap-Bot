let transporterPromise = null

function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || '').trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = ['1', 'true', 'yes'].includes(String(process.env.SMTP_SECURE || '').toLowerCase())
  const user = (process.env.SMTP_USER || '').trim()
  // Gmail App Password viene con espacios; normalizar para evitar errores.
  const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '').trim()
  const from = (process.env.SMTP_FROM || user || '').trim()
  const replyTo = (process.env.SMTP_REPLY_TO || '').trim()

  if (!host) return null
  if (!from) return null

  return { host, port, secure, user, pass, from, replyTo }
}

function getBrandConfig() {
  const panelUrl = (process.env.PANEL_URL || '').trim() || 'https://melodiaauris.qzz.io'
  const primary = (process.env.EMAIL_BRAND_PRIMARY || '').trim() || '#6366f1'
  const secondary = (process.env.EMAIL_BRAND_SECONDARY || '').trim() || '#7c3aed'
  const background = (process.env.EMAIL_BRAND_BG || '').trim() || '#0b1020'
  const card = (process.env.EMAIL_BRAND_CARD || '').trim() || '#111827'
  const name = (process.env.EMAIL_BRAND_NAME || '').trim() || 'Oguri Bot'
  const product = (process.env.EMAIL_BRAND_PRODUCT || '').trim() || 'Panel'
  return { panelUrl, primary, secondary, background, card, name, product }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return String(text || '').replace(/[&<>"']/g, m => map[m])
}

function renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText }) {
  const brand = getBrandConfig()
  const safePreheader = escapeHtml(preheader || '')
  const safeTitle = escapeHtml(title || '')
  const safeCtaText = escapeHtml(ctaText || '')
  const safeCtaUrl = String(ctaUrl || '').trim()

  return `
  <!doctype html>
  <html lang="es">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="color-scheme" content="dark" />
      <meta name="supported-color-schemes" content="dark" />
      <title>${escapeHtml(subject)}</title>
      <style>
        @media (prefers-color-scheme: dark) {
          body { background: ${brand.background} !important; }
        }
        @media only screen and (max-width: 600px) {
          .email-container { width: 100% !important; }
          .email-content { padding: 16px !important; }
        }
      </style>
    </head>
    <body style="margin:0;padding:0;background:${brand.background};font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
      <span style="display:none;opacity:0;visibility:hidden;height:0;width:0;color:transparent;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">
        ${safePreheader}
      </span>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${brand.background};padding:32px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" class="email-container" style="max-width:640px;width:100%;">
              <!-- Header -->
              <tr>
                <td style="padding:0 0 16px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e5e7eb;font-weight:850;font-size:18px;letter-spacing:0.2px;">
                        <span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:linear-gradient(90deg,${brand.primary},${brand.secondary});margin-right:10px;vertical-align:middle;"></span>
                        ${escapeHtml(brand.name)} <span style="color:#94a3b8;font-weight:750;">${escapeHtml(brand.product)}</span>
                      </td>
                      <td align="right" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#64748b;font-size:12px;letter-spacing:0.2px;">
                        ${escapeHtml(brand.panelUrl.replace(/^https?:\/\//, ''))}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="border-radius:22px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:${brand.card};box-shadow:0 24px 80px rgba(0,0,0,0.55);">
                  <div style="height:10px;background:linear-gradient(90deg,${brand.primary},${brand.secondary});"></div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${brand.card};background-image:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02));">
                    <tr>
                      <td class="email-content" style="padding:18px 24px 0 24px;">
                        <div style="display:inline-block;padding:6px 10px;border-radius:9999px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#cbd5e1;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">
                          Notificación automática
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td class="email-content" style="padding:14px 24px 10px 24px;">
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;font-size:24px;font-weight:900;line-height:1.2;letter-spacing:-0.2px;">
                          ${safeTitle}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td class="email-content" style="padding:0 24px 18px 24px;">
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#cbd5e1;font-size:14px;line-height:1.7;">
                          ${contentHtml}
                        </div>
                      </td>
                    </tr>

                    ${safeCtaUrl && safeCtaText
      ? `
                    <tr>
                      <td class="email-content" style="padding:0 24px 18px 24px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="border-radius:14px;background:${brand.primary};background-image:linear-gradient(90deg,${brand.primary},${brand.secondary});box-shadow:0 14px 35px rgba(0,0,0,0.35);">
                              <a href="${safeCtaUrl}" target="_blank" rel="noopener noreferrer"
                                style="display:inline-block;padding:12px 18px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;text-decoration:none;font-weight:850;font-size:14px;letter-spacing:0.2px;">
                                ${safeCtaText}
                              </a>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    `
      : ''
    }

                    <tr>
                      <td class="email-content" style="padding:0 24px 22px 24px;">
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#94a3b8;font-size:12px;line-height:1.6;">
                          Si vos no hiciste esta acción, podés ignorar este email de forma segura.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding:14px 0 0 0;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
                    &copy; ${new Date().getFullYear()} ${escapeHtml(brand.name)} &middot; Notificación automática del sistema
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `.trim()
}

async function getTransporter() {
  const config = getSmtpConfig()
  if (!config) return null

  if (!transporterPromise) {
    transporterPromise = import('nodemailer')
      .then(({ default: nodemailer }) => {
        const auth = config.user && config.pass ? { user: config.user, pass: config.pass } : undefined
        const transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth,
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 15_000,
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
          rateDelta: 1000,
          rateLimit: 5
        })
        
        // Verificar conexión
        transporter.verify((error) => {
          if (error) {
            console.error('❌ Error de conexión SMTP:', error.message)
          } else {
            console.log('✅ Servicio de email configurado correctamente')
          }
        })
        
        return transporter
      })
      .catch((err) => {
        console.error('❌ Error al cargar nodemailer:', err.message)
        return null
      })
  }

  return transporterPromise
}

export async function sendMail({ to, subject, html, text }) {
  const config = getSmtpConfig()
  if (!config) {
    console.warn('⚠️ SMTP no configurado, email no enviado')
    return { ok: false, skipped: true, reason: 'SMTP not configured' }
  }

  const transporter = await getTransporter()
  if (!transporter) {
    console.error('❌ Transporter SMTP no disponible')
    return { ok: false, skipped: true, reason: 'SMTP transporter unavailable' }
  }

  // Validar destinatario
  const recipients = Array.isArray(to) ? to : [to]
  const validRecipients = recipients.filter(email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return email && emailRegex.test(email)
  })

  if (!validRecipients.length) {
    console.error('❌ No hay destinatarios válidos')
    return { ok: false, skipped: false, reason: 'Invalid recipients' }
  }

  const message = {
    from: config.from,
    to: validRecipients.join(', '),
    subject: subject || 'Notificación de Oguri Bot',
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    headers: {
      'X-Mailer': 'Oguri-Bot-Panel',
      'X-Priority': '3',
      'Importance': 'Normal'
    }
  }

  try {
    const info = await transporter.sendMail(message)
    console.log(`✅ Email enviado: ${info.messageId}`)
    return { ok: true, info, messageId: info.messageId }
  } catch (error) {
    console.error('❌ Error al enviar email:', error.message)
    return { ok: false, skipped: false, reason: 'SMTP send failed', error: error.message }
  }
}

export async function sendRegistrationEmail({ to, username }) {
  const brand = getBrandConfig()
  const safeUsername = typeof username === 'string' ? username.trim() : ''
  const subject = '¡Bienvenido a Oguri Bot! - Registro exitoso'
  
  const text =
    `Hola${safeUsername ? ` ${safeUsername}` : ''},\n\n` +
    `¡Tu cuenta fue creada correctamente en ${brand.name}!\n\n` +
    `Tu rol: Usuario\n\n` +
    `Ingresá al panel: ${brand.panelUrl}\n\n` +
    `Si vos no hiciste este registro, podés ignorar este email de forma segura.\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    Hola${safeUsername ? ` <strong style="color:#ffffff;">${escapeHtml(safeUsername)}</strong>` : ''}, ¡tu cuenta fue creada correctamente!<br /><br />
    <span style="color:#e2e8f0;">Tu rol: <strong style="color:#ffffff;">Usuario</strong></span><br /><br />
    Ya podés acceder al panel y comenzar a usar todas las funcionalidades del bot.
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: 'Tu cuenta fue creada correctamente.',
    title: '¡Bienvenido a Oguri Bot!',
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ir al panel',
  })

  return sendMail({ to, subject, html, text })
}

export async function sendPasswordResetEmail({ to, username, token, expiresMinutes = 30 }) {
  const brand = getBrandConfig()
  const safeUsername = typeof username === 'string' ? username.trim() : ''
  const safeToken = String(token || '').trim()
  const resetUrl = `${brand.panelUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(safeToken)}`
  const subject = 'Restablecer contraseña - Oguri Bot'

  const text =
    `Hola${safeUsername ? ` ${safeUsername}` : ''},\n\n` +
    `Recibimos una solicitud para restablecer tu contraseña.\n\n` +
    `Abrí este link para crear una nueva contraseña (vence en ${expiresMinutes} minutos):\n${resetUrl}\n\n` +
    `Si vos no pediste esto, ignorá este email y tu contraseña no cambiará.\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    Hola${safeUsername ? ` <strong style="color:#ffffff;">${escapeHtml(safeUsername)}</strong>` : ''}.<br /><br />
    Recibimos una solicitud para restablecer tu contraseña.<br /><br />
    <strong style="color:#ffffff;">Este link vence en ${expiresMinutes} minutos.</strong><br /><br />
    Si no solicitaste este cambio, simplemente ignorá este email y tu contraseña permanecerá sin cambios.
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: `Restablecé tu contraseña (vence en ${expiresMinutes} min)`,
    title: 'Restablecer contraseña',
    contentHtml,
    ctaUrl: resetUrl,
    ctaText: 'Restablecer contraseña',
  })

  return sendMail({ to, subject, html, text })
}

export async function sendWelcomeEmail({ to, username, role = 'Usuario' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(username || '')
  const safeRole = escapeHtml(role || 'Usuario')
  const subject = `¡Bienvenido al equipo de ${brand.name}!`

  const text =
    `Hola ${username},\n\n` +
    `¡Bienvenido al equipo de ${brand.name}!\n\n` +
    `Tu cuenta ha sido creada con el rol: ${role}\n\n` +
    `Accedé al panel: ${brand.panelUrl}\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    Hola <strong style="color:#ffffff;">${safeUsername}</strong>,<br /><br />
    ¡Bienvenido al equipo de <strong style="color:#ffffff;">${escapeHtml(brand.name)}</strong>!<br /><br />
    Tu cuenta ha sido creada exitosamente con el rol: <strong style="color:#10b981;">${safeRole}</strong><br /><br />
    Ya podés acceder al panel de administración y comenzar a gestionar el bot.
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: 'Tu cuenta ha sido creada exitosamente.',
    title: '¡Bienvenido al equipo!',
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Acceder al panel',
  })

  return sendMail({ to, subject, html, text })
}

export async function sendNotificationEmail({ to, title, message, priority = 'normal' }) {
  const brand = getBrandConfig()
  const safeTitle = escapeHtml(title || 'Notificación')
  const safeMessage = escapeHtml(message || '')
  const subject = `${brand.name} - ${title}`

  const priorityEmoji = {
    low: 'ℹ️',
    normal: '📢',
    high: '⚠️',
    critical: '🚨'
  }

  const text =
    `${priorityEmoji[priority] || '📢'} ${title}\n\n` +
    `${message}\n\n` +
    `Panel: ${brand.panelUrl}\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    ${safeMessage}
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: message.substring(0, 100),
    title: safeTitle,
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ver en el panel',
  })

  return sendMail({ to, subject, html, text })
}

// Exportar funciones de utilidad
export { getSmtpConfig, getBrandConfig, renderPanelEmail }

/**
 * Obtiene el estado actual del servicio de email
 */
export function getEmailServiceStatus() {
  const config = getSmtpConfig()
  const brand = getBrandConfig()
  
  return {
    configured: !!config,
    host: config?.host || null,
    port: config?.port || null,
    user: config?.user || null,
    from: config?.from || null,
    brand: {
      name: brand.name,
      product: brand.product,
      panelUrl: brand.panelUrl
    }
  }
}

/**
 * Verifica la conexión SMTP
 */
export async function verifySmtp() {
  const config = getSmtpConfig()
  if (!config) {
    return { ok: false, reason: 'SMTP not configured' }
  }

  const transporter = await getTransporter()
  if (!transporter) {
    return { ok: false, reason: 'Failed to create transporter' }
  }

  try {
    await transporter.verify()
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error.message }
  }
}

/**
 * Envía un email de prueba
 */
export async function sendTestEmail({ to = null } = {}) {
  const config = getSmtpConfig()
  if (!config) {
    return { ok: false, skipped: true, reason: 'SMTP not configured' }
  }

  const brand = getBrandConfig()
  const recipient = to || config.user || config.from
  
  if (!recipient) {
    return { ok: false, reason: 'No test recipient available' }
  }

  const subject = `Prueba de configuración - ${brand.name}`
  const title = '¡SMTP configurado correctamente!'
  const contentHtml = `
    Este es un mensaje de prueba enviado automáticamente por el sistema para verificar que la configuración SMTP funciona correctamente.<br /><br />
    <strong style="color:#ffffff;">Detalles de la prueba:</strong><br />
    • Servidor: <code style="color:#818cf8;">${config.host}</code><br />
    • Puerto: <code style="color:#818cf8;">${config.port}</code><br />
    • Usuario: <code style="color:#818cf8;">${config.user || 'N/A'}</code><br />
    • Remitente: <code style="color:#818cf8;">${config.from}</code>
  `.trim()

  const text = 
    `Prueba de configuración - ${brand.name}\n\n` +
    `Este es un mensaje de prueba enviado automáticamente para verificar la configuración SMTP.\n\n` +
    `Servidor: ${config.host}\n` +
    `Puerto: ${config.port}\n` +
    `Usuario: ${config.user || 'N/A'}\n` +
    `Remitente: ${config.from}`

  const html = renderPanelEmail({
    subject,
    preheader: 'Mensaje de prueba del sistema.',
    title,
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ir al panel'
  })

  return sendMail({ to: recipient, subject, html, text })
}
