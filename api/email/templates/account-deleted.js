import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAccountDeletedEmail({ username, deletedBy = 'el sistema', reason = '', contactEmail = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const subject = `Tu cuenta en ${brand.name} fue eliminada`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#111827;">${safeUsername}</strong>, lamentamos informarte que tu cuenta fue eliminada del sistema.</p>` +
    renderDataBlock({ label: 'Acción realizada por', value: escapeHtml(String(deletedBy || 'el sistema')), badgeColor: 'gray' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  const contactNote = contactEmail
    ? `Si creés que fue un error, escribinos a <strong style="color:#111827;">${escapeHtml(contactEmail)}</strong>.`
    : 'Si creés que fue un error, contactá al equipo de soporte.'

  contentHtml += `<p style="margin:20px 0 0;font-size:13px;color:#6b7280;">${contactNote}</p>`

  const text =
    `Hola ${String(username || '')},\n\nTu cuenta en ${brand.name} fue eliminada.\nEliminado por: ${String(deletedBy || 'el sistema')}\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    (contactEmail ? `\nContacto: ${contactEmail}` : '')

  const html = renderPanelEmail({
    subject, preheader: 'Tu cuenta fue eliminada del sistema.',
    title: 'Cuenta eliminada', contentHtml,
    ctaUrl: '', ctaText: '',
    type: 'danger', icon: 'trash',
  })

  return { subject, html, text }
}

export async function sendAccountDeletedEmail({ to, username, deletedBy = 'el sistema', reason = '', contactEmail = '' }) {
  const { subject, html, text } = buildAccountDeletedEmail({ username, deletedBy, reason, contactEmail })
  return sendMail({ to, subject, html, text })
}
