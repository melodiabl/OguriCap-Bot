import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAporteReceivedEmail({ username, amount, concept = '', date = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeAmount   = escapeHtml(String(amount || ''))
  const subject = `💚 ¡Recibiste un aporte de ${safeUsername}! — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">¡Buenas noticias! <strong style="color:#f2f6f3;">${safeUsername}</strong> te hizo un aporte.</p>` +
    renderDataBlock({ label: 'De',    value: `👤 ${safeUsername}`, badgeColor: 'teal' }) +
    renderDataBlock({ label: 'Monto', value: `💚 ${safeAmount}`,   badge: 'RECIBIDO', badgeColor: 'green' })

  if (concept) contentHtml += renderDataBlock({ label: 'Concepto', value: escapeHtml(String(concept)), badgeColor: 'gray' })
  if (date)    contentHtml += renderDataBlock({ label: 'Fecha',    value: escapeHtml(String(date)),    badgeColor: 'gray' })

  const text =
    `¡Recibiste un aporte de ${String(username || '')}!\n\n` +
    `Monto: ${String(amount || '')}\n` +
    (concept ? `Concepto: ${concept}\n` : '') +
    (date    ? `Fecha: ${date}\n`    : '') +
    `\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject,
    preheader: `${String(username || '')} te envió un aporte de ${String(amount || '')}`,
    title: '¡Recibiste un aporte! 💚',
    contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`,
    ctaText: 'Ver aportes',
  })

  return { subject, html, text }
}

export async function sendAporteReceivedEmail({ to, username, amount, concept = '', date = '' }) {
  const { subject, html, text } = buildAporteReceivedEmail({ username, amount, concept, date })
  return sendMail({ to, subject, html, text })
}
