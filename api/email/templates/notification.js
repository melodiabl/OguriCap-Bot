import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

const PRIORITY_CFG = {
  critical: { type: 'danger',  icon: '🚨' },
  high:     { type: 'warning', icon: '⚠️' },
  normal:   { type: 'info',    icon: '📢' },
  low:      { type: 'info',    icon: 'ℹ️' },
}

export async function sendNotificationEmail({ to, title, message, priority = 'normal' }) {
  const brand = getBrandConfig()
  const rawTitle   = String(title   || 'Notificación')
  const rawMessage = String(message || '')
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.normal
  const subject = `${brand.name} — ${rawTitle}`

  const html = renderPanelEmail({
    subject, preheader: rawMessage.slice(0, 100),
    title: rawTitle,
    contentHtml: escapeHtml(rawMessage).replace(/\n/g, '<br />'),
    ctaUrl: brand.panelUrl, ctaText: 'Ver en el panel',
    type: cfg.type, icon: cfg.icon,
  })

  const text = `${cfg.icon} ${rawTitle}\n\n${rawMessage}\n\nPanel: ${brand.panelUrl}`
  return sendMail({ to, subject, html, text })
}
