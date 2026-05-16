import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAccountDeletedEmail({ username, deletedBy = 'el sistema', reason = '' }) {
  const brand = getBrandConfig()
  const safeUsername  = escapeHtml(String(username || ''))
  const safeDeletedBy = escapeHtml(String(deletedBy || 'el sistema'))
  const subject = `Tu cuenta en ${brand.name} fue eliminada`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu cuenta fue eliminada del sistema.</p>` +
    renderDataBlock({ label: 'Eliminado por', value: safeDeletedBy, badgeColor: 'gray' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  contentHtml += `<p style="margin:20px 0 0;color:#84968e;font-size:13px;">Si creés que esto fue un error, contactá al equipo.</p>`

  const text =
    `Hola ${String(username || '')},\n\n` +
    `Tu cuenta en ${brand.name} fue eliminada.\n\n` +
    `Eliminado por: ${String(deletedBy || 'el sistema')}\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    `\nSi creés que fue un error, contactá al equipo.`

  const html = renderPanelEmail({
    subject,
    preheader: 'Tu cuenta fue eliminada del sistema',
    title: '🗑️ Cuenta eliminada',
    contentHtml,
    ctaUrl: '',
    ctaText: '',
  })

  return { subject, html, text }
}

export async function sendAccountDeletedEmail({ to, username, deletedBy = 'el sistema', reason = '' }) {
  const { subject, html, text } = buildAccountDeletedEmail({ username, deletedBy, reason })
  return sendMail({ to, subject, html, text })
}
