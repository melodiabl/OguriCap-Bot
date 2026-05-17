import { sendMail, renderPanelEmail, escapeHtml, getBrandConfig } from '../../email/index.js'
import { NOTIFICATION_TYPES } from '../types.js'

const TYPE_MAP = {
  [NOTIFICATION_TYPES.SUCCESS]:  { type: 'success', icon: '✅' },
  [NOTIFICATION_TYPES.INFO]:     { type: 'info',    icon: '📢' },
  [NOTIFICATION_TYPES.WARNING]:  { type: 'warning', icon: '⚠️' },
  [NOTIFICATION_TYPES.ERROR]:    { type: 'danger',  icon: '🚨' },
  [NOTIFICATION_TYPES.CRITICAL]: { type: 'danger',  icon: '🔴' },
}

export function generateEmailTemplate(notification) {
  const cfg = TYPE_MAP[notification.type] || TYPE_MAP[NOTIFICATION_TYPES.INFO]
  const brand = getBrandConfig()
  const title = String(notification.title || notification.titulo || 'Notificación').trim()
  const rawMessage = String(notification.message || notification.mensaje || '').trim()
  const category = String(notification.category || notification.categoria || '').trim().toUpperCase()
  const details = notification.data ? JSON.stringify(notification.data, null, 2) : ''
  const safeMessage = escapeHtml(rawMessage).replace(/\n/g, '<br />')
  const detailsBlock = details
    ? `<pre style="margin:16px 0 0;padding:14px 16px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.07);border-radius:10px;font-size:12px;color:#84968e;white-space:pre-wrap;word-wrap:break-word;font-family:monospace;">${escapeHtml(details)}</pre>`
    : ''
  const categoryBadge = category
    ? `<p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#84968e;text-transform:uppercase;">${escapeHtml(category)}</p>`
    : ''
  return renderPanelEmail({
    subject: `${brand.name} — ${title}`,
    preheader: rawMessage.slice(0, 100),
    title, contentHtml: categoryBadge + `<p style="margin:0 0 0;">${safeMessage}</p>` + detailsBlock,
    ctaUrl: brand.panelUrl, ctaText: 'Ver en el panel',
    type: cfg.type, icon: cfg.icon,
  })
}

export async function sendToEmail(notification) {
  try {
    const toOverrideRaw = notification?.to || notification?.emailTo || notification?.email_to || null
    const toOverride = Array.isArray(toOverrideRaw)
      ? toOverrideRaw.filter(Boolean).join(',')
      : (toOverrideRaw ? String(toOverrideRaw) : '')
    const fallbackTo = process.env.NOTIFICATION_EMAIL || process.env.SECURITY_ALERT_EMAIL_TO ||
      process.env.ADMIN_EMAIL || process.env.SMTP_USER || ''
    const result = await sendMail({
      to: toOverride || fallbackTo,
      subject: `[${String(notification.category || notification.categoria || '').toUpperCase()}] ${String(notification.title || notification.titulo || '')}`,
      html: generateEmailTemplate(notification),
      text: `${notification.title || notification.titulo}\n\n${notification.message || notification.mensaje}`
    })
    if (result?.ok) { console.log('Email notification sent:', result?.info?.messageId || '(no messageId)'); return true }
    if (result?.skipped) { console.warn('Email notification skipped:', result.reason); return false }
    console.error('Email notification failed:', result?.reason || 'unknown')
    return false
  } catch (error) {
    console.error('Error sending email notification:', error)
    return false
  }
}
