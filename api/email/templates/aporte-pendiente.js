import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAportePendienteEmail({ username, amount, concept = '', dueDate = '', estimatedHours = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeAmount   = escapeHtml(String(amount || ''))
  const subject = `⏳ Tu aporte está en revisión — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#111827;">${safeUsername}</strong>, recibimos tu aporte y está siendo revisado.</p>` +
    renderDataBlock({ label: 'Monto', value: safeAmount, badge: 'EN REVISIÓN', badgeColor: 'gold' })

  if (concept)        contentHtml += renderDataBlock({ label: 'Concepto',           value: escapeHtml(String(concept)),        badgeColor: 'gray' })
  if (dueDate)        contentHtml += renderDataBlock({ label: 'Fecha límite',        value: escapeHtml(String(dueDate)),        badgeColor: 'gold' })
  if (estimatedHours) contentHtml += renderDataBlock({ label: 'Tiempo estimado',     value: `~${escapeHtml(String(estimatedHours))} horas`, badgeColor: 'gray' })

  contentHtml += `<p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Te notificaremos cuando tu aporte sea procesado.</p>`

  const text = `Hola ${String(username || '')},\n\nTu aporte de ${String(amount || '')} está en revisión.\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject, preheader: `Tu aporte de ${String(amount || '')} está siendo revisado`,
    title: 'Aporte en revisión', contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`, ctaText: 'Ver estado',
    type: 'warning', icon: 'clock',
  })

  return { subject, html, text }
}

export async function sendAportePendienteEmail({ to, username, amount, concept = '', dueDate = '', estimatedHours = '' }) {
  const { subject, html, text } = buildAportePendienteEmail({ username, amount, concept, dueDate, estimatedHours })
  return sendMail({ to, subject, html, text })
}
