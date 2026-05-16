import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAporteAceptadoEmail({ username, amount, concept = '', acceptedBy = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeAmount = escapeHtml(String(amount || ''))
  const subject = `✅ Tu aporte fue aceptado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu aporte fue revisado y <strong style="color:#25d366;">aceptado</strong>.</p>` +
    renderDataBlock({ label: 'Monto', value: `💚 ${safeAmount}`, badge: 'ACEPTADO', badgeColor: 'green' })

  if (concept) contentHtml += renderDataBlock({ label: 'Concepto', value: escapeHtml(String(concept)), badgeColor: 'gray' })
  if (acceptedBy) contentHtml += renderDataBlock({ label: 'Revisado por', value: escapeHtml(String(acceptedBy)), badgeColor: 'teal' })

  const text =
    `Hola ${String(username || '')},\n\nTu aporte de ${String(amount || '')} fue aceptado.\n` +
    (concept ? `Concepto: ${concept}\n` : '') +
    (acceptedBy ? `Revisado por: ${acceptedBy}\n` : '') +
    `\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject,
    preheader: `Tu aporte de ${String(amount || '')} fue aceptado`,
    title: '✅ ¡Aporte aceptado!',
    contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`,
    ctaText: 'Ver mis aportes',
  })

  return { subject, html, text }
}

export async function sendAporteAceptadoEmail({ to, username, amount, concept = '', acceptedBy = '' }) {
  const { subject, html, text } = buildAporteAceptadoEmail({ username, amount, concept, acceptedBy })
  return sendMail({ to, subject, html, text })
}
