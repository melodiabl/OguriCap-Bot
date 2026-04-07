import fs from 'fs'
import path from 'path'

let transporterPromise = null

function readPanelSmtpConfig() {
  try {
    const mainConfigPath = path.join(process.cwd(), '.config', 'main.json')
    if (!fs.existsSync(mainConfigPath)) return null
    const raw = fs.readFileSync(mainConfigPath, 'utf8')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const emailCfg = parsed?.notifications?.email || null
    const smtpCfg = emailCfg?.smtp || null
    if (!smtpCfg || typeof smtpCfg !== 'object') return null

    return {
      enabled: emailCfg?.enabled,
      host: String(smtpCfg.host || '').trim(),
      port: Number(smtpCfg.port || 587),
      secure: Boolean(smtpCfg.secure),
      user: String(smtpCfg.user || '').trim(),
      pass: String(smtpCfg.pass || '').replace(/\s+/g, '').trim(),
      from: String(smtpCfg.from || '').trim(),
      replyTo: String(smtpCfg.replyTo || '').trim(),
    }
  } catch {
    return null
  }
}

function getSmtpConfig() {
  const panelSmtp = readPanelSmtpConfig()

  const host = (process.env.SMTP_HOST || panelSmtp?.host || '').trim()

  const envPortRaw = String(process.env.SMTP_PORT || '').trim()
  const port = envPortRaw
    ? Number(envPortRaw)
    : Number(panelSmtp?.port || 587)

  const envSecureRaw = String(process.env.SMTP_SECURE || '').trim().toLowerCase()
  const secure = envSecureRaw
    ? ['1', 'true', 'yes'].includes(envSecureRaw)
    : Boolean(panelSmtp?.secure)

  const user = (process.env.SMTP_USER || panelSmtp?.user || '').trim()
  // Gmail App Password viene con espacios; normalizar para evitar errores.
  const pass = String(process.env.SMTP_PASS || panelSmtp?.pass || '').replace(/\s+/g, '').trim()
  const from = (process.env.SMTP_FROM || panelSmtp?.from || user || '').trim()
  const replyTo = (process.env.SMTP_REPLY_TO || panelSmtp?.replyTo || '').trim()

  if (!host) return null
  if (!Number.isFinite(port) || port <= 0) return null
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

  // Colores de Oguri Cap para el email
  const oguriPurple = '#5b3dad' // --oguri-purple
  const oguriLavender = '#b7a6e6' // --oguri-lavender
  const oguriSilver = '#cbd5e1' // --oguri-silver
  const oguriGold = '#f59e0b' // --oguri-gold

  return `
  <!doctype html>
  <html lang="es">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(subject)}</title>
    </head>
    <body style="margin:0;padding:0;background:${brand.background};font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <div style="display:none;font-size:1px;color:transparent;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
        ${safePreheader}
      </div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${brand.background};">
        <tr>
          <td align="center" style="padding: 40px 10px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;border-collapse:separate;">
              <!-- Header Logo -->
              <tr>
                <td style="padding-bottom: 20px; text-align: left;">
                  <span style="color:${oguriSilver}; font-weight: 800; font-size: 20px; letter-spacing: -0.5px;">
                    <span style="color:${oguriPurple};">✦</span> ${brand.name.toUpperCase()}
                  </span>
                </td>
              </tr>

              <!-- Main Card -->
              <tr>
                <td style="background-color:${brand.card}; border: 1px solid #2d3748; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                  <!-- Top Accent Line (Oguri Hair/Uniform Colors) -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td width="33.3%" height="4" style="background-color:${oguriPurple};"></td>
                      <td width="33.3%" height="4" style="background-color:${oguriSilver};"></td>
                      <td width="33.3%" height="4" style="background-color:${oguriLavender};"></td>
                    </tr>
                  </table>

                  <td style="padding: 40px 30px;">
                    <h1 style="margin: 0 0 20px 0; color: #ffffff; font-size: 28px; font-weight: 800; line-height: 1.2;">
                      ${safeTitle}
                    </h1>
                    <div style="color: ${oguriSilver}; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                      ${contentHtml}
                    </div>

                    ${safeCtaUrl && safeCtaText
                      ? `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="border-radius: 8px; background-color: ${oguriPurple};">
                          <a href="${safeCtaUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                            ${safeCtaText}
                          </a>
                        </td>
                      </tr>
                    </table>
                    ` : ''}
                  </td>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding-top: 30px; text-align: center;">
                  <p style="margin: 0; color: #718096; font-size: 13px;">
                    &copy; ${new Date().getFullYear()} ${brand.name} &bull; El Monstruo de las Cenizas
                  </p>
                  <p style="margin: 10px 0 0 0; color: #4a5568; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
                    Powered by Oguri Power System
                  </p>
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
  const title = '¡Servicio de Email Activo!'
  const contentHtml = `
    Este es un mensaje de prueba enviado desde tu panel para confirmar que la configuración SMTP es correcta.<br /><br />
    Tu bot ahora puede enviar notificaciones, reportes y correos de seguridad a <strong style="color:#ffffff;">${recipient}</strong>.
  `.trim()

  const text = 
    `¡Servicio de Email Activo! - ${brand.name}\n\n` +
    `Este es un mensaje de prueba para confirmar que la configuración SMTP funciona correctamente.\n` +
    `Destinatario: ${recipient}`

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
