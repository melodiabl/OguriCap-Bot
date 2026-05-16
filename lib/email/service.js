import { getSmtpConfig, getSmtpMode, getSmtpWarnings, getSmtpTransportHint, getBrandConfig } from './config.js'
import { getTransporter } from './transport.js'
import { getActiveProvider } from './providers/index.js'

function isValidEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function normalizeRecipients(to) {
  const list = Array.isArray(to) ? to : [to]
  return list
    .flatMap(item => String(item || '').split(','))
    .map(email => email.trim())
    .filter((email, index, arr) => email && isValidEmailAddress(email) && arr.indexOf(email) === index)
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
      'Importance': 'Normal',
    },
  }

  try {
    const info = await transporter.sendMail(message)
    console.log(`✅ Email enviado: ${info.messageId}`)
    return { ok: true, info, messageId: info.messageId }
  } catch (error) {
    const provider = getActiveProvider()
    const normalizedError = provider?.normalizeError(error) ?? String(error?.message || '')
    console.error('❌ Error al enviar email:', normalizedError)
    return { ok: false, skipped: false, reason: 'SMTP send failed', error: normalizedError, raw: String(error?.message || '') }
  }
}

export async function verifySmtp() {
  const config = getSmtpConfig()
  if (!config) return { ok: false, reason: 'SMTP not configured' }

  const transporter = await getTransporter({ forceRefresh: true })
  if (!transporter) return { ok: false, reason: 'Failed to create transporter' }

  try {
    await transporter.verify()
    return { ok: true, mode: getSmtpMode(config) }
  } catch (error) {
    const provider = getActiveProvider()
    const reason = provider?.normalizeError(error) ?? String(error?.message || '')
    return { ok: false, reason, raw: String(error?.message || '') }
  }
}

export async function sendTestEmail({ to = null } = {}) {
  const config = getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: 'SMTP not configured' }

  const { renderPanelEmail, escapeHtml } = await import('./renderer.js')
  const brand = getBrandConfig()
  const recipient = to || config.user || config.from
  if (!recipient) return { ok: false, reason: 'No test recipient available' }

  const subject = `Prueba de configuración - ${brand.name}`
  const contentHtml = `
    Este es un mensaje de prueba enviado desde tu panel para confirmar que la configuración SMTP es correcta.<br /><br />
    Tu bot ahora puede enviar notificaciones, reportes y correos de seguridad a <strong style="color:#ffffff;">${escapeHtml(recipient)}</strong>.
  `.trim()

  const text =
    `¡Servicio de Email Activo! - ${brand.name}\n\n` +
    `Este es un mensaje de prueba para confirmar que la configuración SMTP funciona correctamente.\n` +
    `Destinatario: ${recipient}`

  const html = renderPanelEmail({
    subject,
    preheader: 'Mensaje de prueba del sistema.',
    title: '¡Servicio de Email Activo!',
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ir al panel',
  })

  return sendMail({ to: recipient, subject, html, text })
}

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
      panelUrl: brand.panelUrl,
    },
  }
}
