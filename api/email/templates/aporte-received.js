import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAporteReceivedEmail({ username, amount, concept = '', date = '', totalAccumulated = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeAmount   = escapeHtml(String(amount || ''))
  const subject = `💚 Recibiste un aporte de ${safeUsername} — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">¡Buenas noticias! <strong style="color:#111827;">${safeUsername}</strong> te envió un aporte.</p>` +
    renderDataBlock({ label: 'De', value: safeUsername, badgeColor: 'teal' }) +
    renderDataBlock({ label: 'Monto', value: safeAmount, badge: 'RECIBIDO', badgeColor: 'green' })

  if (concept)          contentHtml += renderDataBlock({ label: 'Concepto',    value: escapeHtml(String(concept)), badgeColor: 'gray' })
  if (date)             contentHtml += renderDataBlock({ label: 'Fecha',       value: escapeHtml(String(date)),    badgeColor: 'gray' })
  if (totalAccumulated) contentHtml += renderDataBlock({ label: 'Acumulado',   value: escapeHtml(String(totalAccumulated)), badgeColor: 'teal' })

  const text =
    `Recibiste un aporte de ${String(username || '')} — ${String(amount || '')}\n` +
    (concept ? `Concepto: ${concept}\n` : '') +
    `\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject, preheader: `${String(username || '')} te envió ${String(amount || '')}`,
    title: '¡Recibiste un aporte!', contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`, ctaText: 'Ver aportes',
    type: 'success', icon: '💚',
  })

  return { subject, html, text }
}

export async function sendAporteReceivedEmail({ to, username, amount, concept = '', date = '', totalAccumulated = '' }) {
  const { subject, html, text } = buildAporteReceivedEmail({ username, amount, concept, date, totalAccumulated })
  return sendMail({ to, subject, html, text })
}
