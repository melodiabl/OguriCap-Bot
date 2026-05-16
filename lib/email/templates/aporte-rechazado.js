import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAporteRechazadoEmail({ username, amount, reason = '', rejectedBy = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeAmount = escapeHtml(String(amount || ''))
  const subject = `❌ Tu aporte no pudo ser procesado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, lamentablemente tu aporte no pudo ser aceptado.</p>` +
    renderDataBlock({ label: 'Monto', value: `💔 ${safeAmount}`, badge: 'RECHAZADO', badgeColor: 'pink' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })
  if (rejectedBy) contentHtml += renderDataBlock({ label: 'Revisado por', value: escapeHtml(String(rejectedBy)), badgeColor: 'gray' })

  contentHtml += `<p style="margin:20px 0 0;color:#84968e;font-size:13px;">Si tenés dudas, contactá al equipo.</p>`

  const text =
    `Hola ${String(username || '')},\n\nTu aporte de ${String(amount || '')} fue rechazado.\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    `\nContactá al equipo si tenés preguntas.`

  const html = renderPanelEmail({
    subject,
    preheader: `Tu aporte de ${String(amount || '')} no pudo procesarse`,
    title: '❌ Aporte no procesado',
    contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`,
    ctaText: 'Ver mis aportes',
  })

  return { subject, html, text }
}

export async function sendAporteRechazadoEmail({ to, username, amount, reason = '', rejectedBy = '' }) {
  const { subject, html, text } = buildAporteRechazadoEmail({ username, amount, reason, rejectedBy })
  return sendMail({ to, subject, html, text })
}
