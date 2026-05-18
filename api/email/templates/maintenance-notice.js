import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildMaintenanceNoticeEmail({ startTime, durationMinutes, affectedServices = [] }) {
  const brand = getBrandConfig()
  const safeStart    = escapeHtml(String(startTime || ''))
  const safeDuration = escapeHtml(String(durationMinutes || ''))
  const subject = `🛠️ Mantenimiento programado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">El sistema estará fuera de servicio por un período breve de mantenimiento.</p>` +
    renderDataBlock({ label: 'Inicio del mantenimiento', value: safeStart, badge: 'PROGRAMADO', badgeColor: 'gold' }) +
    renderDataBlock({ label: 'Duración estimada', value: `~${safeDuration} minutos`, badgeColor: 'gray' })

  if (affectedServices.length > 0) {
    const list = affectedServices.map(s => escapeHtml(String(s))).join(' · ')
    contentHtml += renderDataBlock({ label: 'Servicios afectados', value: list, badgeColor: 'gold' })
  }

  contentHtml += `<p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Pedimos disculpas por las molestias. El sistema volverá a estar disponible lo antes posible.</p>`

  const text =
    `Mantenimiento programado en ${brand.name}.\n\nInicio: ${String(startTime || '')}\nDuración: ~${String(durationMinutes || '')} min\n` +
    (affectedServices.length ? `Servicios afectados: ${affectedServices.join(', ')}\n` : '')

  const html = renderPanelEmail({
    subject, preheader: `Mantenimiento programado — inicio: ${String(startTime || '')}`,
    title: 'Mantenimiento programado', contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Ver estado del sistema',
    type: 'warning', icon: '🛠️',
  })

  return { subject, html, text }
}

export async function sendMaintenanceNoticeEmail({ to, startTime, durationMinutes, affectedServices = [] }) {
  const { subject, html, text } = buildMaintenanceNoticeEmail({ startTime, durationMinutes, affectedServices })
  return sendMail({ to, subject, html, text })
}
