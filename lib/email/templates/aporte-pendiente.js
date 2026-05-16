import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAportePendienteEmail({ username, amount, dueDate = '', concept = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeAmount = escapeHtml(String(amount || ''))
  const subject = `⏳ Tenés un aporte pendiente — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, te recordamos que tenés un aporte pendiente de revisión.</p>` +
    renderDataBlock({ label: 'Monto', value: `⏳ ${safeAmount}`, badge: 'PENDIENTE', badgeColor: 'teal' })

  if (concept) contentHtml += renderDataBlock({ label: 'Concepto', value: escapeHtml(String(concept)), badgeColor: 'gray' })
  if (dueDate) contentHtml += renderDataBlock({ label: 'Vence', value: escapeHtml(String(dueDate)), badgeColor: 'pink' })

  const text =
    `Hola ${String(username || '')},\n\nTenés un aporte pendiente de ${String(amount || '')}.\n` +
    (concept ? `Concepto: ${concept}\n` : '') +
    (dueDate ? `Vence: ${dueDate}\n` : '') +
    `\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject,
    preheader: `Aporte pendiente de ${String(amount || '')}`,
    title: '⏳ Aporte pendiente',
    contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`,
    ctaText: 'Ver mis aportes',
  })

  return { subject, html, text }
}

export async function sendAportePendienteEmail({ to, username, amount, dueDate = '', concept = '' }) {
  const { subject, html, text } = buildAportePendienteEmail({ username, amount, dueDate, concept })
  return sendMail({ to, subject, html, text })
}
