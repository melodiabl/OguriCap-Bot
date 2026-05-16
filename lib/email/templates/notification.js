import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendNotificationEmail({ to, title, message, priority = 'normal' }) {
  const brand = getBrandConfig()
  const rawTitle = String(title || 'Notificación')
  const rawMessage = String(message || '')
  const safeTitle = escapeHtml(rawTitle)
  const safeMessage = escapeHtml(rawMessage)
  const subject = `${brand.name} - ${rawTitle}`

  const priorityEmoji = { low: 'ℹ️', normal: '📢', high: '⚠️', critical: '🚨' }

  const text =
    `${priorityEmoji[priority] || '📢'} ${rawTitle}\n\n` +
    `${rawMessage}\n\n` +
    `Panel: ${brand.panelUrl}\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const html = renderPanelEmail({
    subject,
    preheader: rawMessage.slice(0, 100),
    title: safeTitle,
    contentHtml: safeMessage,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ver en el panel',
  })

  return sendMail({ to, subject, html, text })
}
