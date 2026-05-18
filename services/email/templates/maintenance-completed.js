import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'
import { generateSystemReportHtml } from '../system-reporter.js'

export async function buildMaintenanceCompletedEmail({
  completedAt = '',
  durationMinutes = '',
  restoredServices = [],
  note = '',
}) {
  const brand = getBrandConfig()
  const safeCompleted = completedAt
    ? escapeHtml(String(completedAt))
    : new Date().toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

  const subject = `Sistema restaurado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;font-size:15px;color:#374151;">El mantenimiento programado finalizó correctamente. Todos los servicios están operativos.</p>` +
    renderDataBlock({ label: 'Restaurado a las', value: safeCompleted, badge: 'COMPLETADO', badgeColor: 'green' })

  if (durationMinutes) {
    contentHtml += renderDataBlock({ label: 'Duración total', value: `${escapeHtml(String(durationMinutes))} minutos`, badgeColor: 'gray' })
  }

  if (restoredServices.length) {
    const rows = restoredServices.map(s =>
      `<tr><td style="padding:8px 0;border-bottom:1px solid #f0fdf4;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td style="width:20px;vertical-align:middle;">
            <div style="width:16px;height:16px;border-radius:50%;background:#dcfce7;border:1.5px solid #16a34a;text-align:center;line-height:14px;">
              <span style="font-size:9px;font-weight:900;color:#16a34a;">&#10003;</span>
            </div>
          </td>
          <td style="padding-left:10px;font-size:14px;color:#374151;font-weight:500;">${escapeHtml(String(s))}</td>
          <td style="text-align:right;white-space:nowrap;"><span style="font-size:11px;font-weight:700;color:#16a34a;background:#dcfce7;padding:3px 8px;border-radius:4px;">Restaurado</span></td>
        </tr></table>
      </td></tr>`).join('')

    contentHtml += `
      <div style="margin:20px 0;">
        <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">Servicios restaurados</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <tr><td style="padding:4px 14px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${rows}
            </table>
          </td></tr>
        </table>
      </div>`
  }

  if (note) {
    contentHtml += `<div style="margin:20px 0 0;padding:14px 16px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:0 6px 6px 0;">
      <p style="margin:0;font-size:13px;color:#374151;"><strong style="color:#111827;">Nota:</strong> ${escapeHtml(String(note))}</p>
    </div>`
  }

  contentHtml += await generateSystemReportHtml('completed')

  const text =
    `Sistema restaurado — ${brand.name}\n\n` +
    `Restaurado: ${safeCompleted}\n` +
    (durationMinutes ? `Duración: ${String(durationMinutes)} minutos\n` : '') +
    (restoredServices.length ? `Servicios restaurados: ${restoredServices.join(', ')}\n` : '') +
    (note ? `\nNota: ${String(note)}\n` : '') +
    `\nGracias por tu paciencia.\nPanel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject,
    preheader: `El sistema está operativo · Restaurado: ${safeCompleted}`,
    title: '¡Sistema restaurado!',
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Acceder al panel',
    type: 'success',
    icon: 'check-circle',
  })

  return { subject, html, text }
}

export async function sendMaintenanceCompletedEmail({ to, completedAt, durationMinutes, restoredServices = [], note = '' }) {
  const { subject, html, text } = await buildMaintenanceCompletedEmail({ completedAt, durationMinutes, restoredServices, note })
  return sendMail({ to, subject, html, text })
}
