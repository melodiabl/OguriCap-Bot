import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendSecurityAlertEmail({ to, subject, title, message, details = [], ctaUrl = '', ctaText = '' }) {
  const brand = getBrandConfig()
  const safeSubject = String(subject || 'Alerta de seguridad').trim() || 'Alerta de seguridad'
  const rawTitle = String(title || safeSubject).trim() || safeSubject
  const safeMessage = escapeHtml(message || '')

  const detailRows = Array.isArray(details)
    ? details
        .map(item => {
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
        .map(item => {
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
