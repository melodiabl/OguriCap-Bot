import fs from 'fs'
import path from 'path'

let transporterPromise = null
let transporterKey = null

let cachedMainConfig = null
let cachedMainConfigMtimeMs = null

function readMainConfig() {
  try {
    const filePath = path.join(process.cwd(), '.config', 'main.json')
    if (!fs.existsSync(filePath)) return null
    const stat = fs.statSync(filePath)
    const mtimeMs = stat?.mtimeMs || null
    if (cachedMainConfig && cachedMainConfigMtimeMs && mtimeMs && mtimeMs === cachedMainConfigMtimeMs) {
      return cachedMainConfig
    }

    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    cachedMainConfig = parsed
    cachedMainConfigMtimeMs = mtimeMs
    return parsed
  } catch {
    return null
  }
}

function getNotificationsEmailConfig() {
  const main = readMainConfig()
  const emailCfg = main && typeof main === 'object' ? main?.notifications?.email : null
  return emailCfg && typeof emailCfg === 'object' ? emailCfg : null
}

function coerceBool(value) {
  if (typeof value === 'boolean') return value
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value || '').trim().toLowerCase())
}

function safeNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeEmailList(value) {
  if (!value) return null
  const list = Array.isArray(value) ? value : String(value).split(/[;,]/g)
  const emails = list
    .map((v) => String(v || '').trim())
    .filter(Boolean)
  if (!emails.length) return null
  return emails.join(', ')
}

function getSmtpConfig() {
  const cfg = getNotificationsEmailConfig()
  const cfgSmtp = cfg?.smtp && typeof cfg.smtp === 'object' ? cfg.smtp : {}

  const enabled = typeof cfg?.enabled === 'boolean' ? cfg.enabled : true

  const host = (String(cfgSmtp?.host ?? process.env.SMTP_HOST ?? '')).trim()
  const port = safeNumber(cfgSmtp?.port ?? process.env.SMTP_PORT ?? 587, 587)
  const secure = typeof cfgSmtp?.secure === 'boolean' ? cfgSmtp.secure : coerceBool(process.env.SMTP_SECURE || '')

  const user = (String(cfgSmtp?.user ?? process.env.EMAIL_USER ?? process.env.USER_EMAIL ?? process.env.SMTP_USER ?? '')).trim()
  // Gmail App Password viene con espacios; normalizar para evitar errores.
  const pass = String(cfgSmtp?.pass ?? process.env.EMAIL_PASS ?? process.env.APP_PASSWORD ?? process.env.SMTP_PASS ?? '').replace(/\s+/g, '').trim()
  const from = (String(cfgSmtp?.from ?? process.env.SMTP_FROM ?? user ?? '')).trim()
  const replyTo = (String(cfgSmtp?.replyTo ?? process.env.SMTP_REPLY_TO ?? '')).trim()
  // Email del admin para notificaciones (usa ADMIN_EMAIL, NOTIFICATION_EMAIL o SECURITY_ALERT_EMAIL_TO)
  const adminEmail = (process.env.ADMIN_EMAIL || process.env.NOTIFICATION_EMAIL || process.env.SECURITY_ALERT_EMAIL_TO || '').trim()

  const pool = typeof cfgSmtp?.pool === 'boolean' ? cfgSmtp.pool : coerceBool(process.env.SMTP_POOL || '')
  const maxConnections = safeNumber(cfgSmtp?.maxConnections ?? process.env.SMTP_MAX_CONNECTIONS ?? 2, 2)
  const maxMessages = safeNumber(cfgSmtp?.maxMessages ?? process.env.SMTP_MAX_MESSAGES ?? 50, 50)

  return { enabled, host, port, secure, user, pass, from, replyTo, adminEmail, pool, maxConnections, maxMessages }
}

function getBrandConfig() {
  const panelUrl =
    (process.env.PANEL_URL || process.env.NEXT_PUBLIC_API_URL || '').trim() ||
    'http://localhost:3000'
  const primary = (process.env.EMAIL_BRAND_PRIMARY || '').trim() || '#6366f1'
  const secondary = (process.env.EMAIL_BRAND_SECONDARY || '').trim() || '#7c3aed'
  const background = (process.env.EMAIL_BRAND_BG || '').trim() || '#0b1020'
  const card = (process.env.EMAIL_BRAND_CARD || '').trim() || '#111827'
  const name = (process.env.EMAIL_BRAND_NAME || '').trim() || 'Oguri Bot'
  const product = (process.env.EMAIL_BRAND_PRODUCT || '').trim() || 'Panel'
  return { panelUrl, primary, secondary, background, card, name, product }
}

function renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText }) {
  const brand = getBrandConfig()
  const safePreheader = String(preheader || '').trim()
  const safeTitle = String(title || '').trim()
  const safeCtaText = String(ctaText || '').trim()
  const safeCtaUrl = String(ctaUrl || '').trim()

  return `
  <!doctype html>
  <html>
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${subject}</title>
    </head>
    <body style="margin:0;padding:0;background:${brand.background};">
      <span style="display:none;opacity:0;visibility:hidden;height:0;width:0;color:transparent;">
        ${safePreheader}
      </span>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${brand.background};padding:32px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;">
              <tr>
                <td style="padding:0 0 16px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                    <tr>
                      <td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e5e7eb;font-weight:850;font-size:18px;letter-spacing:0.2px;">
                        <span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:linear-gradient(90deg,${brand.primary},${brand.secondary});margin-right:10px;vertical-align:middle;"></span>
                        ${brand.name} <span style="color:#94a3b8;font-weight:750;">${brand.product}</span>
                      </td>
                      <td align="right" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#64748b;font-size:12px;letter-spacing:0.2px;">
                        ${brand.panelUrl}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="border-radius:22px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:${brand.card};box-shadow:0 24px 80px rgba(0,0,0,0.55);">
                  <div style="height:10px;background:linear-gradient(90deg,${brand.primary},${brand.secondary});"></div>
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${brand.card};background-image:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02));">
                    <tr>
                      <td style="padding:18px 24px 0 24px;">
                        <div style="display:inline-block;padding:6px 10px;border-radius:9999px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#cbd5e1;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">
                          Notificaci&oacute;n autom&aacute;tica
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:14px 24px 10px 24px;">
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;font-size:24px;font-weight:900;line-height:1.2;letter-spacing:-0.2px;">
                          ${safeTitle}
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:0 24px 18px 24px;">
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#cbd5e1;font-size:14px;line-height:1.7;">
                          ${contentHtml}
                        </div>
                      </td>
                    </tr>

                    ${safeCtaUrl && safeCtaText
      ? `
                    <tr>
                      <td style="padding:0 24px 18px 24px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td style="border-radius:14px;background:${brand.primary};background-image:linear-gradient(90deg,${brand.primary},${brand.secondary});box-shadow:0 14px 35px rgba(0,0,0,0.35);">
                              <a href="${safeCtaUrl}" target="_blank"
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
                      <td style="padding:0 24px 22px 24px;">
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#94a3b8;font-size:12px;line-height:1.6;">
                          Si vos no hiciste esta acci&oacute;n, pod&eacute;s ignorar este email.
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <tr>
                <td style="padding:14px 0 0 0;">
                  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
                    &copy; ${new Date().getFullYear()} Oguri Bot &middot; Notificaci&oacute;n autom&aacute;tica
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
  if (!config?.host || !config?.from) return null

  const nextKey = [
    config.host,
    config.port,
    config.secure ? '1' : '0',
    config.user || '',
    config.pool ? 'pool' : 'nopool',
    config.maxConnections,
    config.maxMessages,
  ].join('|')

  if (transporterKey && transporterKey !== nextKey) {
    transporterPromise = null
  }
  transporterKey = nextKey

  if (!transporterPromise) {
    transporterPromise = import('nodemailer')
      .then(({ default: nodemailer }) => {
        const auth = config.user && config.pass ? { user: config.user, pass: config.pass } : undefined
        return nodemailer.createTransport({
          host: config.host,
          port: config.port,
          secure: config.secure,
          auth,
          ...(config.pool
            ? {
                pool: true,
                maxConnections: config.maxConnections,
                maxMessages: config.maxMessages,
              }
            : {}),
          connectionTimeout: 10_000,
          greetingTimeout: 10_000,
          socketTimeout: 15_000,
        })
      })
      .catch(() => null)
  }

  return transporterPromise
}

export async function sendMail({ to, subject, html, text, cc, bcc, replyTo, from, attachments, headers }) {
  const config = getSmtpConfig()
  if (config?.enabled === false) return { ok: false, skipped: true, reason: 'Email disabled' }
  if (!config?.host || !config?.from) return { ok: false, skipped: true, reason: 'SMTP not configured' }

  const transporter = await getTransporter()
  if (!transporter) return { ok: false, skipped: true, reason: 'SMTP transporter unavailable' }

  const toList = normalizeEmailList(to)
  if (!toList) return { ok: false, skipped: false, reason: 'Missing recipient' }

  const message = {
    from: String(from || '').trim() || config.from,
    to: toList,
    ...(normalizeEmailList(cc) ? { cc: normalizeEmailList(cc) } : {}),
    ...(normalizeEmailList(bcc) ? { bcc: normalizeEmailList(bcc) } : {}),
    subject,
    ...(String(replyTo || '').trim() ? { replyTo: String(replyTo).trim() } : (config.replyTo ? { replyTo: config.replyTo } : {})),
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(attachments ? { attachments } : {}),
    ...(headers ? { headers } : {}),
  }

  try {
    const info = await transporter.sendMail(message)
    return { ok: true, info }
  } catch (error) {
    return { ok: false, skipped: false, reason: 'SMTP send failed', error }
  }
}

export async function verifySmtp() {
  const config = getSmtpConfig()
  if (config?.enabled === false) return { ok: false, skipped: true, reason: 'Email disabled' }
  if (!config?.host || !config?.from) return { ok: false, skipped: true, reason: 'SMTP not configured' }

  const transporter = await getTransporter()
  if (!transporter) return { ok: false, skipped: true, reason: 'SMTP transporter unavailable' }

  try {
    const verified = await transporter.verify()
    return { ok: true, verified: Boolean(verified) }
  } catch (error) {
    return { ok: false, skipped: false, reason: 'SMTP verify failed', error }
  }
}

export function getEmailServiceStatus() {
  const config = getSmtpConfig()
  return {
    enabled: config?.enabled !== false,
    configured: Boolean(config?.host && config?.from),
    host: config?.host || '',
    port: config?.port || 0,
    secure: Boolean(config?.secure),
    from: config?.from || '',
    replyTo: config?.replyTo || '',
    hasAuth: Boolean(config?.user && config?.pass),
    pool: Boolean(config?.pool),
  }
}

export async function sendTestEmail({ to }) {
  const config = getSmtpConfig()
  const brand = getBrandConfig()
  const resolvedTo = normalizeEmailList(to) || normalizeEmailList(config?.adminEmail) || null
  if (!resolvedTo) {
    return { ok: false, skipped: false, reason: 'Falta destinatario (to) y no hay adminEmail configurado' }
  }

  const subject = '✅ Prueba de Email (SMTP)'
  const title = 'Email de prueba'

  const contentHtml = `
    Este es un email de prueba para verificar la configuraci&oacute;n SMTP.<br /><br />
    <strong style="color:#ffffff;">Host:</strong> ${String(config?.host || '—')}<br />
    <strong style="color:#ffffff;">Puerto:</strong> ${String(config?.port || '—')}<br />
    <strong style="color:#ffffff;">Seguro:</strong> ${String(Boolean(config?.secure))}<br />
    <strong style="color:#ffffff;">From:</strong> ${String(config?.from || '—')}<br />
    <strong style="color:#ffffff;">Reply-To:</strong> ${String(config?.replyTo || '—')}<br />
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: 'Prueba SMTP del panel.',
    title,
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Abrir panel',
  })

  const text =
    `Prueba SMTP del panel.\n\n` +
    `Host: ${String(config?.host || '—')}\n` +
    `Puerto: ${String(config?.port || '—')}\n` +
    `Seguro: ${String(Boolean(config?.secure))}\n` +
    `From: ${String(config?.from || '—')}\n` +
    `Reply-To: ${String(config?.replyTo || '—')}\n\n` +
    `Panel: ${brand.panelUrl}\n`

  return sendMail({ to: resolvedTo, subject, html, text })
}

export async function sendRegistrationEmail({ to, username }) {
  const brand = getBrandConfig()
  const safeUsername = typeof username === 'string' ? username.trim() : ''
  const subject = 'Registro exitoso'
  const text =
    `Hola${safeUsername ? ` ${safeUsername}` : ''},\n\n` +
    `Tu cuenta fue creada correctamente.\n\nTu rol: Usuario\n\n` +
    `Ingresá al panel: ${brand.panelUrl}\n\n` +
    `Si vos no hiciste este registro, podés ignorar este email.\n`

  const contentHtml = `
    Hola${safeUsername ? ` <strong style="color:#ffffff;">${safeUsername}</strong>` : ''}, tu cuenta fue creada correctamente.<br />
    <span style="color:#e2e8f0;">Tu rol: <strong style="color:#ffffff;">Usuario</strong></span>
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: 'Tu cuenta fue creada correctamente.',
    title: 'Registro exitoso',
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
  const subject = 'Restablecer contraseña'

  const text =
    `Hola${safeUsername ? ` ${safeUsername}` : ''},\n\n` +
    `Recibimos una solicitud para restablecer tu contraseña.\n\n` +
    `Abrí este link (vence en ${expiresMinutes} min): ${resetUrl}\n\n` +
    `Si vos no pediste esto, ignorá este email.\n`

  const contentHtml = `
    Hola${safeUsername ? ` <strong style="color:#ffffff;">${safeUsername}</strong>` : ''}.<br />
    Recibimos una solicitud para restablecer tu contrase&ntilde;a.<br /><br />
    <strong style="color:#ffffff;">Este link vence en ${expiresMinutes} minutos.</strong>
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: 'Restablecer contraseña',
    title: 'Restablecer contraseña',
    contentHtml,
    ctaUrl: resetUrl,
    ctaText: 'Cambiar contraseña',
  })

  return sendMail({ to, subject, html, text })
}

export async function sendSecurityAlertEmail({ to, subject, title, message, details = [] }) {
  const safeSubject = String(subject || 'Alerta de seguridad').trim()
  const safeTitle = String(title || 'Alerta de seguridad').trim()
  const safeMessage = String(message || '').trim()
  const list = Array.isArray(details) ? details : []

  const detailHtml = list.length
    ? `
      <div style="margin-top:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);">
        ${list
      .map((d) => `<div style="font-size:12px;color:#cbd5e1;line-height:1.5;"><strong style="color:#ffffff;">${d.label}:</strong> ${d.value}</div>`)
      .join('')}
      </div>
    `
    : ''

  const html = renderPanelEmail({
    subject: safeSubject,
    preheader: safeTitle,
    title: safeTitle,
    contentHtml: `${safeMessage}${detailHtml}`,
    ctaUrl: '',
    ctaText: '',
  })

  const text =
    `${safeTitle}\n\n` +
    `${safeMessage}\n\n` +
    list.map((d) => `${d.label}: ${d.value}`).join('\n')

  return sendMail({ to, subject: safeSubject, html, text })
}

// ========================================
// NUEVAS NOTIFICACIONES ADMINISTRATIVAS
// ========================================

/**
 * Notificación al admin cuando se registra un nuevo usuario
 */
export async function sendAdminNewUserNotification({ username, email, ip, userAgent }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const brand = getBrandConfig()
  const subject = '🆕 Nuevo usuario registrado'
  const title = 'Nuevo registro en el panel'
  const message = `Se ha registrado un nuevo usuario en ${brand.name}.`

  const details = [
    { label: 'Usuario', value: username || 'Sin especificar' },
    { label: 'Email', value: email },
    { label: 'IP', value: ip || 'Desconocida' },
    { label: 'Navegador', value: userAgent || 'Desconocido' },
    { label: 'Fecha', value: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}

/**
 * Notificación al admin cuando alguien cambia su contraseña
 */
export async function sendAdminPasswordChangeNotification({ username, email, ip }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const subject = '🔐 Cambio de contraseña'
  const title = 'Contraseña modificada'
  const message = `Un usuario ha cambiado su contraseña.`

  const details = [
    { label: 'Usuario', value: username || 'Sin especificar' },
    { label: 'Email', value: email },
    { label: 'IP', value: ip || 'Desconocida' },
    { label: 'Fecha', value: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}

/**
 * Notificación al admin cuando se solicita restablecer contraseña
 */
export async function sendAdminPasswordResetRequestNotification({ username, email, ip }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const subject = '🔑 Solicitud de restablecimiento'
  const title = 'Solicitud de restablecer contraseña'
  const message = `Un usuario ha solicitado restablecer su contraseña.`

  const details = [
    { label: 'Usuario', value: username || 'Sin especificar' },
    { label: 'Email', value: email },
    { label: 'IP', value: ip || 'Desconocida' },
    { label: 'Fecha', value: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}

/**
 * Notificación al admin cuando hay múltiples intentos fallidos de login
 */
export async function sendAdminBruteForceAlert({ email, ip, attemptCount }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const subject = '⚠️ ALERTA: Múltiples intentos fallidos'
  const title = 'Posible ataque de fuerza bruta'
  const message = `Se detectaron ${attemptCount} intentos fallidos de inicio de sesión.`

  const details = [
    { label: 'Email objetivo', value: email },
    { label: 'IP atacante', value: ip || 'Desconocida' },
    { label: 'Intentos', value: attemptCount.toString() },
    { label: 'Fecha', value: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}

/**
 * Notificación al admin cuando un usuario elimina su cuenta
 */
export async function sendAdminAccountDeletionNotification({ username, email, ip }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const subject = '🗑️ Cuenta eliminada'
  const title = 'Usuario eliminó su cuenta'
  const message = `Un usuario ha eliminado su cuenta del sistema.`

  const details = [
    { label: 'Usuario', value: username || 'Sin especificar' },
    { label: 'Email', value: email },
    { label: 'IP', value: ip || 'Desconocida' },
    { label: 'Fecha', value: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}

/**
 * Notificación al admin cuando se cambia el rol de un usuario
 */
export async function sendAdminRoleChangeNotification({ targetUsername, targetEmail, oldRole, newRole, changedBy }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const subject = '👤 Cambio de rol'
  const title = 'Rol de usuario modificado'
  const message = `Se ha cambiado el rol de un usuario.`

  const details = [
    { label: 'Usuario afectado', value: targetUsername || 'Sin especificar' },
    { label: 'Email', value: targetEmail },
    { label: 'Rol anterior', value: oldRole },
    { label: 'Rol nuevo', value: newRole },
    { label: 'Modificado por', value: changedBy },
    { label: 'Fecha', value: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}

/**
 * Notificación al admin sobre actividad sospechosa
 */
export async function sendAdminSuspiciousActivityAlert({ username, email, activity, ip, reason }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const subject = '🚨 Actividad sospechosa detectada'
  const title = 'Alerta de seguridad'
  const message = `Se detectó actividad potencialmente sospechosa.`

  const details = [
    { label: 'Usuario', value: username || 'Desconocido' },
    { label: 'Email', value: email || 'Desconocido' },
    { label: 'Actividad', value: activity },
    { label: 'Razón', value: reason },
    { label: 'IP', value: ip || 'Desconocida' },
    { label: 'Fecha', value: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}

/**
 * Resumen diario de actividad (opcional, para enviar 1 vez al día)
 */
export async function sendAdminDailySummary({ stats }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const brand = getBrandConfig()
  const subject = '📊 Resumen diario del panel'
  const title = 'Resumen de actividad'
  const message = `Estadísticas de actividad del día en ${brand.name}.`

  const details = [
    { label: 'Nuevos registros', value: stats.newUsers?.toString() || '0' },
    { label: 'Logins exitosos', value: stats.successfulLogins?.toString() || '0' },
    { label: 'Logins fallidos', value: stats.failedLogins?.toString() || '0' },
    { label: 'Restablecimientos de contraseña', value: stats.passwordResets?.toString() || '0' },
    { label: 'Fecha', value: new Date().toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}

/**
 * Notificación al admin cuando un subbot se conecta
 */
export async function sendAdminSubbotConnectedNotification({ subbotCode, phone, name }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const subject = '🤖 Subbot Conectado'
  const title = 'Nueva conexión de subbot'
  const message = `El subbot ${subbotCode} se ha conectado exitosamente.`

  const details = [
    { label: 'Código', value: subbotCode },
    { label: 'Número', value: phone || 'Desconocido' },
    { label: 'Nombre WA', value: name || 'Anónimo' },
    { label: 'Fecha', value: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}

/**
 * Notificación al admin cuando un subbot se desconecta
 */
export async function sendAdminSubbotDisconnectedNotification({ subbotCode, reason }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const subject = '⚠️ Subbot Desconectado'
  const title = 'Desconexión de subbot'
  const message = `El subbot ${subbotCode} se ha desconectado.`

  const details = [
    { label: 'Código', value: subbotCode },
    { label: 'Razón', value: reason || 'Desconocida' },
    { label: 'Fecha', value: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}

/**
 * Notificación al admin por error en subbot
 */
export async function sendAdminSubbotErrorNotification({ subbotCode, error }) {
  const config = getSmtpConfig()
  if (!config?.adminEmail) return { ok: false, skipped: true, reason: 'Admin email not configured' }

  const subject = '❌ Error en Subbot'
  const title = 'Error crítico en subbot'
  const message = `Se ha detectado un error en el subbot ${subbotCode}.`

  const details = [
    { label: 'Código', value: subbotCode },
    { label: 'Error', value: error || 'Desconocido' },
    { label: 'Fecha', value: new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) }
  ]

  return sendSecurityAlertEmail({
    to: config.adminEmail,
    subject,
    title,
    message,
    details
  })
}
