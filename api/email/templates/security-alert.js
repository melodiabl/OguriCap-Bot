import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendSecurityAlertEmail({ to, subject, title, message, details = [], ctaUrl = '', ctaText = '' }) {
  const brand = getBrandConfig()
  const safeSubject = String(subject || 'Alerta de seguridad').trim() || 'Alerta de seguridad'
  const rawTitle    = String(title   || safeSubject).trim() || safeSubject
  const safeMessage = escapeHtml(String(message || ''))

  const detailBlocks = Array.isArray(details)
    ? details.filter(d => d?.label).map(d =>
        renderDataBlock({ label: String(d.label), value: String(d.value || '-'), badgeColor: 'pink' })
      ).join('')
    : ''

  const contentHtml = `<p style="margin:0 0 20px;">${safeMessage}</p>${detailBlocks}`

  const textDetails = Array.isArray(details)
    ? details.filter(d => d?.label).map(d => `${d.label}: ${d.value || '-'}`).join('\n')
    : ''

  const text = [String(message || ''), textDetails, `Panel: ${brand.panelUrl}`].filter(Boolean).join('\n\n')

  const html = renderPanelEmail({
    subject: safeSubject, preheader: String(message || '').slice(0, 100),
    title: rawTitle, contentHtml,
    ctaUrl: ctaUrl || brand.panelUrl, ctaText: ctaText || 'Abrir panel',
    type: 'danger', icon: 'shield',
  })

  return sendMail({ to, subject: safeSubject, html, text })
}
