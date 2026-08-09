import fs from 'fs'
import path from 'path'

let transporterCache = { key: '', promise: null }

let emitNotificationFn = null
async function getEmitNotification() {
  if (!emitNotificationFn) {
    try {
      const mod = await import('./socket-io.js')
      emitNotificationFn = mod.emitNotification || mod.default?.emitNotification
    } catch { /* ignore */ }
  }
  return emitNotificationFn
}

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
      port: smtpCfg.port,
      secure: typeof smtpCfg.secure === 'boolean' ? smtpCfg.secure : null,
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

  const host = (panelSmtp?.host || process.env.SMTP_HOST || '').trim()

  const panelPortRaw = panelSmtp?.port == null ? '' : String(panelSmtp.port).trim()
  const envPortRaw = String(process.env.SMTP_PORT || '').trim()
  const port = Number(panelPortRaw || envPortRaw || 587)

  const envSecureRaw = String(process.env.SMTP_SECURE || '').trim().toLowerCase()
  const secure = typeof panelSmtp?.secure === 'boolean'
    ? panelSmtp.secure
    : envSecureRaw
      ? ['1', 'true', 'yes'].includes(envSecureRaw)
      : false

  const user = (panelSmtp?.user || process.env.SMTP_USER || '').trim()
  // Gmail App Password viene con espacios; normalizar para evitar errores.
  const pass = String(panelSmtp?.pass || process.env.SMTP_PASS || '').replace(/\s+/g, '').trim()
  const from = (panelSmtp?.from || process.env.SMTP_FROM || user || '').trim()
  const replyTo = (panelSmtp?.replyTo || process.env.SMTP_REPLY_TO || '').trim()

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

function getSecurityAlertRecipients() {
  return normalizeRecipients([
    process.env.SECURITY_ALERT_EMAIL_TO,
    process.env.NOTIFICATION_EMAIL,
    process.env.ADMIN_EMAIL,
    process.env.SMTP_REPLY_TO,
    process.env.SMTP_USER,
  ])
}

function getTransportCacheKey(config) {
  return JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user,
    pass: config.pass,
    from: config.from,
    replyTo: config.replyTo,
  })
}

function getSmtpMode(config) {
  const port = Number(config?.port || 0)
  const wantsTls = Boolean(config?.secure)
  if (port === 465) return 'implicit-tls'
  if (wantsTls) return 'starttls'
  return 'plain'
}

function buildTransportOptions(config) {
  const port = Number(config.port || 0)
  const auth = config.user && config.pass ? { user: config.user, pass: config.pass } : undefined
  const mode = getSmtpMode(config)

  const options = {
    host: config.host,
    port,
    secure: mode === 'implicit-tls',
    auth,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
  }

  if (mode === 'starttls') {
    options.requireTLS = true
  }

  return options
}

function normalizeSmtpError(error) {
  const message = String(error?.message || error || '').trim()
  if (/wrong version number/i.test(message)) {
    return 'TLS/puerto incompatibles. Usa puerto 465 con seguro activado, o 587 con STARTTLS.'
  }
  return message || 'SMTP error'
}

function getSmtpWarnings(config) {
  if (!config) return ['Configura el host SMTP para activar los correos.']

  const warnings = []
  const port = Number(config.port || 0)
  if (!config.user || !config.pass) warnings.push('Faltan credenciales SMTP para autenticación.')
  if (port === 465 && !config.secure) warnings.push('Puerto 465 detectado: conviene activar el modo seguro.')
  if (port === 587 && config.secure) warnings.push('Puerto 587 detectado: se usará STARTTLS automáticamente.')
  if (!config.replyTo) warnings.push('No definiste Reply-To; se usará el remitente por defecto.')
  return warnings
}

function getSmtpTransportHint(config) {
  if (!config) return 'Configura el SMTP para ver recomendaciones.'
  const mode = getSmtpMode(config)
  if (mode === 'implicit-tls') return 'TLS implícito sobre 465.'
  if (mode === 'starttls') return 'STARTTLS sobre 587 o puerto similar.'
  return 'Conexión sin TLS explícito. Verifica si tu proveedor exige STARTTLS.'
}

function resetTransporterCache() {
  const previous = transporterCache.promise
  transporterCache = { key: '', promise: null }

  if (previous) {
    previous.then((transporter) => transporter?.close?.()).catch(() => {})
  }
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
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                    <tr>
                      <td width="33.3%" height="4" style="background-color:${oguriPurple};"></td>
                      <td width="33.3%" height="4" style="background-color:${oguriSilver};"></td>
                      <td width="33.3%" height="4" style="background-color:${oguriLavender};"></td>
                    </tr>
                    <tr>
                      <td colspan="3" style="padding: 40px 30px;">
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
                    </tr>
                  </table>
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

async function getTransporter({ forceRefresh = false } = {}) {
  const config = getSmtpConfig()
  if (!config) {
    resetTransporterCache()
    return null
  }

  const cacheKey = getTransportCacheKey(config)

  if (forceRefresh || transporterCache.key !== cacheKey || !transporterCache.promise) {
    if (transporterCache.key && transporterCache.key !== cacheKey) resetTransporterCache()

    transporterCache = {
      key: cacheKey,
      promise: import('nodemailer')
        .then(({ default: nodemailer }) => {
          return nodemailer.createTransport(buildTransportOptions(config))
        })
        .catch((err) => {
          console.error('❌ Error al cargar nodemailer:', err.message)
          transporterCache = { key: '', promise: null }
          return null
        }),
    }
  }

  return transporterCache.promise
}

function isValidEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

function normalizeRecipients(to) {
  const list = Array.isArray(to) ? to : [to]
  return list
    .flatMap((item) => String(item || '').split(','))
    .map((email) => email.trim())
    .filter((email, index, arr) => email && isValidEmailAddress(email) && arr.indexOf(email) === index)
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
  const validRecipients = normalizeRecipients(to)

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
    const normalizedError = normalizeSmtpError(error)
    console.error('❌ Error al enviar email:', normalizedError)
    return { ok: false, skipped: false, reason: 'SMTP send failed', error: normalizedError, raw: String(error?.message || '') }
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
  const rawTitle = String(title || 'Notificación')
  const rawMessage = String(message || '')
  const safeTitle = escapeHtml(rawTitle)
  const safeMessage = escapeHtml(rawMessage)
  const subject = `${brand.name} - ${rawTitle}`

  const priorityEmoji = {
    low: 'ℹ️',
    normal: '📢',
    high: '⚠️',
    critical: '🚨'
  }

  const text =
    `${priorityEmoji[priority] || '📢'} ${rawTitle}\n\n` +
    `${rawMessage}\n\n` +
    `Panel: ${brand.panelUrl}\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    ${safeMessage}
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: rawMessage.slice(0, 100),
    title: safeTitle,
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ver en el panel',
  })

  return sendMail({ to, subject, html, text })
}

export async function sendSecurityAlertEmail({ to, subject, title, message, details = [], ctaUrl = '', ctaText = '' }) {
  const brand = getBrandConfig()
  const safeSubject = String(subject || 'Alerta de seguridad').trim() || 'Alerta de seguridad'
  const rawTitle = String(title || safeSubject).trim() || safeSubject
  const safeMessage = escapeHtml(message || '')

  const detailRows = Array.isArray(details)
    ? details
        .map((item) => {
          const label = escapeHtml(item?.label || '')
          const value = escapeHtml(item?.value || '-')
          if (!label) return ''
          return `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">${label}</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">${value}</td></tr>`
        })
        .filter(Boolean)
        .join('')
    : ''

  const contentHtml = `
    <p style="margin:0 0 16px 0;">${safeMessage}</p>
    ${detailRows ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:8px;">${detailRows}</table>` : ''}
  `.trim()

  const textDetails = Array.isArray(details)
    ? details
        .map((item) => {
          const label = String(item?.label || '').trim()
          const value = String(item?.value || '-').trim()
          return label ? `${label}: ${value}` : ''
        })
        .filter(Boolean)
        .join('\n')
    : ''

  const text = [message || '', textDetails, brand.panelUrl ? `Panel: ${brand.panelUrl}` : ''].filter(Boolean).join('\n\n')
  const html = renderPanelEmail({
    subject: safeSubject,
    preheader: message || 'Revisa este evento en el panel.',
    title: rawTitle,
    contentHtml,
    ctaUrl: ctaUrl || brand.panelUrl,
    ctaText: ctaText || 'Abrir panel',
  })

  return sendMail({ to, subject: safeSubject, html, text })
}

// Exportar funciones de utilidad
export { getSmtpConfig, getBrandConfig, renderPanelEmail }

/**
 * Obtiene el estado actual del servicio de email
 */
export function getEmailServiceStatus() {
  const config = getSmtpConfig()
  const brand = getBrandConfig()
  const warnings = getSmtpWarnings(config)
  
  return {
    configured: !!config,
    host: config?.host || null,
    port: config?.port || null,
    mode: config ? getSmtpMode(config) : null,
    hasAuth: Boolean(config?.user && config?.pass),
    user: config?.user || null,
    from: config?.from || null,
    replyTo: config?.replyTo || null,
    transportHint: getSmtpTransportHint(config),
    warnings,
    securityRecipients: getSecurityAlertRecipients(),
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

  const transporter = await getTransporter({ forceRefresh: true })
  if (!transporter) {
    return { ok: false, reason: 'Failed to create transporter' }
  }

  try {
    await transporter.verify()
    return { ok: true, mode: getSmtpMode(config) }
  } catch (error) {
    return { ok: false, reason: normalizeSmtpError(error), raw: String(error?.message || '') }
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
        template: 'welcome',
        title: 'Bienvenida',
        subject,
        recipient: previewTo,
        html: renderPanelEmail({
          subject,
          preheader: 'Tu cuenta ha sido creada exitosamente.',
          title: '¡Bienvenido al equipo!',
          contentHtml,
          ctaUrl: brand.panelUrl,
          ctaText: 'Acceder al panel',
        }),
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
        template: 'role_updated',
        title: 'Rol Actualizado',
        subject,
        recipient: previewTo,
        html: renderPanelEmail({
          subject,
          preheader: 'Tu rol ha sido actualizado.',
          title: 'Rol Actualizado',
          contentHtml,
          ctaUrl: brand.panelUrl,
          ctaText: 'Ver perfil',
        }),
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
        template: 'subbot_disconnected',
        title: 'Subbot Desconectado',
        subject,
        recipient: previewTo,
        html: renderPanelEmail({
          subject,
          preheader: 'Un subbot se ha desconectado.',
          title: 'Subbot Desconectado',
          contentHtml,
          ctaUrl: `${brand.panelUrl}/subbots`,
          ctaText: 'Ver subbots',
        }),
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
        template: 'password-reset',
        title: 'Password Reset',
        subject,
        recipient: previewTo,
        html: renderPanelEmail({
          subject,
          preheader: `Restablecé tu contraseña (vence en ${expiresMinutes} min)`,
          title: 'Restablecer contraseña',
          contentHtml,
          ctaUrl: resetUrl,
          ctaText: 'Restablecer contraseña',
        }),
      }
    }
    case 'security-alert': {
      const subject = 'Alerta de seguridad'
      const html = renderPanelEmail({
        subject,
        preheader: 'Revisa este evento en el panel.',
        title: 'Login sospechoso detectado',
        contentHtml: `
          <p style="margin:0 0 16px 0;">Se detectó un intento de acceso fuera del patrón habitual. Revisa la actividad reciente.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:8px;">
            <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">IP</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">181.23.44.10</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">Fecha</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">12/04/2026 21:14</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">Actor</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">oguri-owner</td></tr>
          </table>
        `.trim(),
        ctaUrl: brand.panelUrl,
        ctaText: 'Abrir panel',
      })
      return {
        template: 'security-alert',
        title: 'Alerta de seguridad',
        subject,
        recipient: previewTo,
        html,
      }
    }
    case 'notification': {
      const subject = `${brand.name} - Notificación del sistema`
      return {
        template: 'notification',
        title: 'Notificación',
        subject,
        recipient: previewTo,
        html: renderPanelEmail({
          subject,
          preheader: 'El sistema generó una notificación importante.',
          title: 'Notificación del sistema',
          contentHtml: 'Se completó una tarea programada y el panel registró la actividad correctamente.',
          ctaUrl: brand.panelUrl,
          ctaText: 'Ver en el panel',
        }),
      }
    }
    case 'registration': {
      const subject = '¡Bienvenido a Oguri Bot! - Registro exitoso'
      return {
        template: 'registration',
        title: 'Registro exitoso',
        subject,
        recipient: previewTo,
        html: renderPanelEmail({
          subject,
          preheader: 'Tu cuenta fue creada correctamente.',
          title: '¡Bienvenido a Oguri Bot!',
          contentHtml: `Hola <strong style="color:#ffffff;">NuevoUsuario</strong>, ¡tu cuenta fue creada correctamente!<br /><br /><span style="color:#e2e8f0;">Tu rol: <strong style="color:#ffffff;">Usuario</strong></span><br /><br />Ya podés acceder al panel y comenzar a usar todas las funcionalidades del bot.`,
          ctaUrl: brand.panelUrl,
          ctaText: 'Ir al panel',
        }),
      }
    }
    default: {
      const subject = `Prueba de configuración - ${brand.name}`
      return {
        template: 'test',
        title: 'Email de prueba',
        subject,
        recipient: previewTo,
        html: renderPanelEmail({
          subject,
          preheader: 'Mensaje de prueba del sistema.',
          title: '¡Servicio de Email Activo!',
          contentHtml: `Este es un mensaje de prueba enviado desde tu panel para confirmar que la configuración SMTP es correcta.<br /><br />Tu bot ahora puede enviar notificaciones, reportes y correos de seguridad a <strong style="color:#ffffff;">${previewTo}</strong>.`,
          ctaUrl: brand.panelUrl,
          ctaText: 'Ir al panel',
        }),
      }
    }
  }
}

export function getEmailTemplatePreview(template = 'test') {
  return buildEmailPreview(template)
}

// ============================================
// BROADCAST SYSTEM - Email & Push Notifications
// ============================================

export async function sendBroadcastEmail(options) {
  const { 
    subject, 
    preheader, 
    title, 
    contentHtml, 
    recipients, 
    category = 'broadcast' 
  } = options;
  
  const brand = getBrandConfig();
  const html = renderPanelEmail({
    subject: `${brand.name} - ${subject}`,
    preheader,
    title,
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ver más en el panel',
  });
  
  return sendMail({
    to: recipients,
    subject: `${brand.name} - ${subject}`,
    html,
  });
}

// Push notification broadcast
export async function sendPushBroadcast(options) {
  const {
    title,
    body,
    data = {},
    recipients = [],
    icon = null,
    badge = null,
    tag = 'broadcast',
    priority = 'normal',
  } = options;
  
  const panelDb = global.panelDb || (typeof global.loadDatabase === 'function' ? global.loadDatabase() : null);
  const broadcastId = `push_${Date.now()}`;
  
  if (panelDb?.broadcasts) {
    panelDb.broadcasts[broadcastId] = {
      id: broadcastId,
      type: 'push',
      title,
      body,
      data,
      recipients,
      createdAt: new Date().toISOString(),
      sent: false,
    };
  }
  
  // Emitir como notificación del sistema para que llegue a todos los clientes conectados
  const emitNotification = await getEmitNotification()
  if (emitNotification) {
    emitNotification({
      id: broadcastId,
      titulo: title || 'Broadcast Push',
      mensaje: body || '',
      tipo: 'info',
      categoria: 'broadcast',
      targetRoles: null,
      para: 'all',
      timestamp: new Date().toISOString(),
    })
  }
  
  // También emitir el evento específico de push broadcast
  const { getIO } = await import('./socket-io.js')
  const io = getIO()
  if (io) {
    io.emit('push:broadcast', {
      id: broadcastId,
      title,
      body,
      data,
      tag,
      timestamp: Date.now(),
    })
  }

  return { success: true, broadcastId };
}

// Broadcast combinado - email + push
export async function sendFullBroadcast(options) {
  const {
    subject,
    preheader,
    title,
    contentHtml,
    emailRecipients = [],
    pushRecipients = [],
    sendEmail = true,
    sendPush = true,
  } = options;
  
  const results = {
    email: null,
    push: null,
    errors: [],
  };
  
  // Enviar email si hay destinatarios
  if (sendEmail && emailRecipients.length > 0) {
    try {
      results.email = await sendBroadcastEmail({
        subject,
        preheader,
        title,
        contentHtml,
        recipients: emailRecipients,
      });
    } catch (error) {
      results.errors.push(`Email error: ${error.message}`);
    }
  }
  
  // Enviar push si hay destinatarios
  if (sendPush && pushRecipients.length > 0) {
    try {
      results.push = await sendPushBroadcast({
        title,
        body: preheader,
        recipients: pushRecipients,
        data: { subject, contentHtml: contentHtml.substring(0, 200) },
      });
    } catch (error) {
      results.errors.push(`Push error: ${error.message}`);
    }
  }
  
  return results;
}

// AI-powered broadcast content generator
export async function generateBroadcastContent(prompt, context = {}) {
  const brand = getBrandConfig();
  
  // Obtener estadísticas recientes del bot
  const stats = context.stats || {
    messages: context.messagesProcessed || 0,
    commands: context.commandsExecuted || 0,
    users: context.newUsers || 0,
    uptime: context.uptime || 0,
  };
  
  // Construir contexto para la IA
  const aiContext = `
Eres el asistente de marketing de ${brand.name}.
Genera contenido para un broadcast (notificación/email) con el siguiente contexto:

ESTADÍSTICAS DEL BOT:
- Mensajes procesados: ${stats.messages}
- Comandos ejecutados: ${stats.commands}
- Usuarios nuevos: ${stats.users}
- Uptime: ${Math.floor(stats.uptime / 3600)} horas

SOLICITUD DEL USUARIO:
${prompt}

INSTRUCCIONES:
1. Genera un título breve y atractivo (máx 60 caracteres)
2. Genera un preheader/extracto (máx 100 caracteres)
3. Genera contenido HTML para el email (máx 500 palabras)
4. El tono debe ser profesional pero amigable
5. Incluye datos relevantes de las estadísticas cuando aplique
6. Usa emojis apropiados

FORMATO DE RESPUESTA (JSON):
{
  "title": "...",
  "preheader": "...",
  "content": "..."
}
`;

  // Intentar usar Ollama si está disponible
  try {
    const { default: fetch } = await import('node-fetch');
    
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:latest',
        prompt: aiContext,
        stream: false,
        format: 'json',
      }),
      signal: AbortSignal.timeout(10000),
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.response) {
        const parsed = JSON.parse(data.response);
        return {
          success: true,
          title: parsed.title || 'Notificación',
          preheader: parsed.preheader || '',
          contentHtml: parsed.content || '',
          source: 'ai',
        };
      }
    }
  } catch (aiError) {
    console.log('AI not available, skipping');
  }
  
  // Fallback: generar contenido básico sin IA
  return {
    success: false,
    title: 'Notificación',
    preheader: prompt.substring(0, 100),
    contentHtml: `<p style="color:#94a3b8;">${prompt}</p>
    <p style="color:#64748b;font-size:12px;margin-top:20px;">
      Stats: ${stats.messages} msgs | ${stats.commands} comandos | ${stats.users} usuarios nuevos
    </p>`,
    source: 'manual',
  };
}

// Build broadcast preview
export function buildBroadcastPreview(type = 'announcement') {
  const brand = getBrandConfig();
  const previewTo = 'admin@ejemplo.com';
  
  switch (type) {
    case 'announcement': {
      const subject = 'Anuncio importante';
      const contentHtml = `
        <h3 style="color:#ffffff;margin:0 0 15px 0;">📢 Anuncio</h3>
        <p style="color:#94a3b8;margin:0 0 20px 0;">Tenemos algo importante que contarte.</p>
        <p style="color:#ffffff;margin:15px 0;">Este es un mensaje de prueba para el sistema de broadcast. Aquí puedes escribir cualquier announcement, actualización o comunicado para tus usuarios.</p>
        <p style="color:#94a3b8;margin:20px 0 0 0;">¿Tienes preguntas? Responde este email.</p>
      `.trim();
      return {
        template: 'broadcast_announcement',
        title: 'Anuncio',
        subject: `📢 ${brand.name} - Anuncio`,
        recipient: previewTo,
        html: renderPanelEmail({
          subject: `📢 ${brand.name} - Anuncio`,
          preheader: 'Tenemos algo importante que contarte.',
          title: 'Anuncio Importante',
          contentHtml,
          ctaUrl: brand.panelUrl,
          ctaText: 'Ver más',
        }),
      };
    }
    case 'update': {
      const subject = 'Novedades del sistema';
      const contentHtml = `
        <h3 style="color:#ffffff;margin:0 0 15px 0;">🎉 Nuevas funcionalidades</h3>
        <p style="color:#94a3b8;margin:0 0 20px 0;">We've been working on improving your bot.</p>
        
        <div style="background:#1e293b;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="color:#ffffff;margin:10px 0;"><strong>✨ Nuevo sistema de broadcast</strong></p>
          <p style="color:#94a3b8;margin:0 0 15px 0;">Envía notificaciones a todos tus usuarios</p>
          
          <p style="color:#ffffff;margin:10px 0;"><strong>🔔 Notificaciones push</strong></p>
          <p style="color:#94a3b8;margin:0;">Recibe alerts en tiempo real</p>
        </div>
      `.trim();
      return {
        template: 'broadcast_update',
        title: 'Novedades',
        subject: `🎉 ${brand.name} - Novedades`,
        recipient: previewTo,
        html: renderPanelEmail({
          subject: `🎉 ${brand.name} - Novedades`,
          preheader: 'Nuevas funcionalidades disponibles.',
          title: 'Novedades del Sistema',
          contentHtml,
          ctaUrl: brand.panelUrl,
          ctaText: 'Ver actualizaciones',
        }),
      };
    }
    case 'alert': {
      const subject = 'Alerta del sistema';
      const contentHtml = `
        <h3 style="color:#ffffff;margin:0 0 15px 0;">⚠️ Alerta</h3>
        <p style="color:#94a3b8;margin:0 0 20px 0;">Se ha detectado una alerta que requiere tu atención.</p>
        
        <div style="background:#7f1d1d;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #dc2626;">
          <p style="color:#fca5a5;margin:5px 0;"><strong>Tipo:</strong> Advertencia</p>
          <p style="color:#fca5a5;margin:5px 0;"><strong>Severidad:</strong> Media</p>
          <p style="color:#fca5a5;margin:5px 0;"><strong>Descripción:</strong> Revisa los logs del sistema</p>
        </div>
        
        <p style="color:#94a3b8;margin:20px 0 0 0;">Ver detalles en el panel de administración.</p>
      `.trim();
      return {
        template: 'broadcast_alert',
        title: 'Alerta',
        subject: `⚠️ ${brand.name} - Alerta`,
        recipient: previewTo,
        html: renderPanelEmail({
          subject: `⚠️ ${brand.name} - Alerta`,
          preheader: 'Se ha detectado una alerta en el sistema.',
          title: 'Alerta del Sistema',
          contentHtml,
          ctaUrl: brand.panelUrl,
          ctaText: 'Ver detalles',
        }),
      };
    }
    default:
      return buildEmailPreview('test');
  }
}
