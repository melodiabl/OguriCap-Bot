import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'
import { generateSystemReportHtml } from '../system-reporter.js'

function formatEndTime(startTime, durationMinutes) {
  try {
    const start = new Date(startTime)
    if (isNaN(start.getTime())) return null
    const end = new Date(start.getTime() + Number(durationMinutes) * 60000)
    return end.toLocaleString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    })
  } catch {
    return null
  }
}

function buildTimeline(startTime, durationMinutes) {
  const endTime = formatEndTime(startTime, durationMinutes)
  const steps = [
    { label: 'Aviso enviado', sub: 'Ahora', active: true },
    { label: 'Inicio mantenimiento', sub: escapeHtml(String(startTime || '')), active: false },
    { label: 'Servicio restaurado', sub: endTime ? escapeHtml(endTime) : `~${escapeHtml(String(durationMinutes || ''))} min después`, active: false },
  ]

  const stepCells = steps.map((s, i) => `
    <td style="text-align:center;vertical-align:top;width:33.33%;padding:0 6px;">
      <div style="width:32px;height:32px;border-radius:50%;margin:0 auto 8px;background:${s.active ? '#d97706' : '#e5e7eb'};text-align:center;line-height:32px;">
        <span style="font-size:12px;font-weight:800;color:${s.active ? '#ffffff' : '#9ca3af'};">${i + 1}</span>
      </div>
      <div style="font-size:12px;font-weight:700;color:${s.active ? '#111827' : '#374151'};margin-bottom:2px;">${s.label}</div>
      <div style="font-size:11px;color:#9ca3af;line-height:1.4;">${s.sub}</div>
    </td>`).join(`<td style="vertical-align:middle;padding-bottom:24px;"><div style="height:1px;background:#e5e7eb;margin:0 4px;"></div></td>`)

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
    style="margin:24px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;">
    <tr>${stepCells}</tr>
  </table>`
}

function buildServiceList(affectedServices, unaffectedServices) {
  if (!affectedServices.length && !unaffectedServices.length) return ''

  const affectedRows = affectedServices.map(s =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #fef3c7;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td style="width:20px;vertical-align:middle;">
          <div style="width:16px;height:16px;border-radius:50%;background:#fef3c7;border:1.5px solid #d97706;text-align:center;line-height:14px;">
            <span style="font-size:9px;font-weight:900;color:#d97706;">!</span>
          </div>
        </td>
        <td style="padding-left:10px;font-size:14px;color:#374151;font-weight:500;">${escapeHtml(String(s))}</td>
        <td style="text-align:right;white-space:nowrap;"><span style="font-size:11px;font-weight:700;color:#d97706;background:#fef3c7;padding:3px 8px;border-radius:4px;">Afectado</span></td>
      </tr></table>
    </td></tr>`).join('')

  const unaffectedRows = unaffectedServices.map(s =>
    `<tr><td style="padding:8px 0;border-bottom:1px solid #f0fdf4;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td style="width:20px;vertical-align:middle;">
          <div style="width:16px;height:16px;border-radius:50%;background:#dcfce7;border:1.5px solid #16a34a;text-align:center;line-height:14px;">
            <span style="font-size:9px;font-weight:900;color:#16a34a;">&#10003;</span>
          </div>
        </td>
        <td style="padding-left:10px;font-size:14px;color:#374151;font-weight:500;">${escapeHtml(String(s))}</td>
        <td style="text-align:right;white-space:nowrap;"><span style="font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;padding:3px 8px;border-radius:4px;">Normal</span></td>
      </tr></table>
    </td></tr>`).join('')

  return `
    <div style="margin:20px 0;">
      <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">Estado de servicios</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <tr><td style="padding:4px 14px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${affectedRows}${unaffectedRows}
          </table>
        </td></tr>
      </table>
    </div>`
}

export async function buildMaintenanceNoticeEmail({
  startTime,
  durationMinutes,
  affectedServices = [],
  unaffectedServices = [],
  reason = '',
  contactEmail = '',
  customSummary = '',
  reportHtml = null, // pre-generado para no llamar a Claude una vez por destinatario
}) {
  const brand = getBrandConfig()
  const safeDuration = escapeHtml(String(durationMinutes || ''))
  const safeReason   = reason ? escapeHtml(String(reason)) : ''
  const endTime      = formatEndTime(startTime, durationMinutes)
  const subject      = `Mantenimiento programado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 4px;font-size:16px;font-weight:600;color:#111827;">Programamos un mantenimiento del sistema.</p>` +
    `<p style="margin:0 0 20px;font-size:14px;color:#6b7280;">Durante este período algunos servicios estarán temporalmente fuera de línea.</p>`

  if (safeReason) {
    contentHtml += `<div style="margin:0 0 20px;padding:14px 16px;background:#fafafa;border-left:3px solid #d97706;border-radius:0 6px 6px 0;">
      <p style="margin:0;font-size:13px;color:#374151;"><strong style="color:#111827;">Motivo:</strong> ${safeReason}</p>
    </div>`
  }

  contentHtml += buildTimeline(startTime, durationMinutes)

  contentHtml +=
    renderDataBlock({ label: 'Inicio del mantenimiento', value: escapeHtml(String(startTime || '')), badge: 'PROGRAMADO', badgeColor: 'gold' }) +
    renderDataBlock({ label: 'Duración estimada', value: `${safeDuration} minutos`, badgeColor: 'gray' })

  if (endTime) {
    contentHtml += renderDataBlock({ label: 'Finalización estimada', value: escapeHtml(endTime), badgeColor: 'teal' })
  }

  contentHtml += buildServiceList(affectedServices, unaffectedServices)

  contentHtml += reportHtml !== null ? reportHtml : await generateSystemReportHtml('notice', customSummary)

  contentHtml += `
    <div style="margin:20px 0;padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">Qué esperar</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
        <tr><td style="padding:4px 0;font-size:14px;color:#374151;">&#8594;&nbsp; El servicio se restaurará automáticamente al terminar.</td></tr>
        <tr><td style="padding:4px 0;font-size:14px;color:#374151;">&#8594;&nbsp; No necesitás hacer nada, tus datos están seguros.</td></tr>
        <tr><td style="padding:4px 0;font-size:14px;color:#374151;">&#8594;&nbsp; Recibirás otro aviso cuando el sistema esté online.</td></tr>
      </table>
    </div>`

  if (contactEmail) {
    const safeContact = escapeHtml(String(contactEmail))
    contentHtml += `<p style="margin:16px 0 0;font-size:13px;color:#6b7280;">
      ¿Tenés una consulta urgente? Contactanos en <a href="mailto:${safeContact}" style="color:#d97706;font-weight:600;">${safeContact}</a>
    </p>`
  } else {
    contentHtml += `<p style="margin:16px 0 0;font-size:13px;color:#6b7280;">Pedimos disculpas por las molestias. Trabajamos para volver lo antes posible.</p>`
  }

  const text =
    `Mantenimiento programado — ${brand.name}\n\n` +
    `Inicio: ${String(startTime || '')}\n` +
    `Duración estimada: ${String(durationMinutes || '')} minutos\n` +
    (endTime ? `Finalización estimada: ${endTime}\n` : '') +
    (safeReason ? `Motivo: ${String(reason)}\n` : '') +
    (affectedServices.length ? `Servicios afectados: ${affectedServices.join(', ')}\n` : '') +
    (unaffectedServices.length ? `Servicios normales: ${unaffectedServices.join(', ')}\n` : '') +
    `\nNo necesitás hacer nada. Recibirás aviso cuando el sistema esté disponible.\n` +
    `Panel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject,
    preheader: `Inicio: ${String(startTime || '')} · Duración: ~${String(durationMinutes || '')} minutos`,
    title: 'Mantenimiento programado',
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ver estado del sistema',
    type: 'warning',
    icon: 'cog',
  })

  return { subject, html, text }
}

export async function sendMaintenanceNoticeEmail({ to, startTime, durationMinutes, affectedServices = [], unaffectedServices = [], reason = '', contactEmail = '', customSummary = '', reportHtml = null }) {
  const { subject, html, text } = await buildMaintenanceNoticeEmail({ startTime, durationMinutes, affectedServices, unaffectedServices, reason, contactEmail, customSummary, reportHtml })
  return sendMail({ to, subject, html, text })
}
