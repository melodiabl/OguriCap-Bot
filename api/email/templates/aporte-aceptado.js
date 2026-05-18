import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAporteAceptadoEmail({ username, amount, concept = '', acceptedBy = '', creditDate = '' }) {
  const brand = getBrandConfig()
  const safeUsername  = escapeHtml(String(username || ''))
  const safeAmount    = escapeHtml(String(amount || ''))
  const safeAcceptedBy = escapeHtml(String(acceptedBy || 'Admin'))
  const subject = `✅ Tu aporte fue aceptado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#111827;">${safeUsername}</strong>, tu aporte fue revisado y aceptado.</p>` +
    renderDataBlock({ label: 'Monto aceptado', value: safeAmount, badge: 'ACEPTADO', badgeColor: 'green' }) +
    renderDataBlock({ label: 'Revisado por', value: safeAcceptedBy, badgeColor: 'teal' })

  if (concept)    contentHtml += renderDataBlock({ label: 'Concepto',           value: escapeHtml(String(concept)),    badgeColor: 'gray' })
  if (creditDate) contentHtml += renderDataBlock({ label: 'Fecha de acreditación', value: escapeHtml(String(creditDate)), badgeColor: 'gold' })

  const text = `Hola ${String(username || '')},\n\nTu aporte de ${String(amount || '')} fue aceptado.\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject, preheader: `Tu aporte de ${String(amount || '')} fue aceptado`,
    title: 'Aporte aceptado', contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`, ctaText: 'Ver mis aportes',
    type: 'success', icon: 'check-circle',
  })

  return { subject, html, text }
}

export async function sendAporteAceptadoEmail({ to, username, amount, concept = '', acceptedBy = '', creditDate = '' }) {
  const { subject, html, text } = buildAporteAceptadoEmail({ username, amount, concept, acceptedBy, creditDate })
  return sendMail({ to, subject, html, text })
}
