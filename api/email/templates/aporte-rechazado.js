import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAporteRechazadoEmail({ username, amount, reason = '', rejectedBy = '' }) {
  const brand = getBrandConfig()
  const safeUsername   = escapeHtml(String(username || ''))
  const safeAmount     = escapeHtml(String(amount || ''))
  const safeRejectedBy = escapeHtml(String(rejectedBy || 'Admin'))
  const subject = `❌ Tu aporte fue rechazado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#111827;">${safeUsername}</strong>, lamentablemente tu aporte fue rechazado.</p>` +
    renderDataBlock({ label: 'Monto', value: safeAmount, badge: 'RECHAZADO', badgeColor: 'pink' }) +
    renderDataBlock({ label: 'Revisado por', value: safeRejectedBy, badgeColor: 'gray' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'pink' })

  contentHtml += `
    <div style="margin:20px 0 0;padding:16px 20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">¿Qué hacer ahora?</p>
      <p style="margin:0 0 8px;font-size:14px;color:#374151;">→ Revisá el motivo del rechazo</p>
      <p style="margin:0;font-size:14px;color:#374151;">→ Corregí el comprobante y reenviá el aporte</p>
    </div>`

  const text = `Hola ${String(username || '')},\n\nTu aporte de ${String(amount || '')} fue rechazado.\n` +
    (reason ? `Motivo: ${reason}\n` : '') + `\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject, preheader: `Tu aporte de ${String(amount || '')} fue rechazado`,
    title: 'Aporte rechazado', contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`, ctaText: 'Ver mis aportes',
    type: 'danger', icon: '❌',
  })

  return { subject, html, text }
}

export async function sendAporteRechazadoEmail({ to, username, amount, reason = '', rejectedBy = '' }) {
  const { subject, html, text } = buildAporteRechazadoEmail({ username, amount, reason, rejectedBy })
  return sendMail({ to, subject, html, text })
}
