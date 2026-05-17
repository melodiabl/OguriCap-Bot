import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAccountSuspendedEmail({ username, suspendedBy, reason = '', contactUrl = '' }) {
  const brand = getBrandConfig()
  const safeUsername    = escapeHtml(String(username || ''))
  const safeSuspendedBy = escapeHtml(String(suspendedBy || 'Administrador'))
  const subject = `Tu cuenta fue suspendida — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu acceso al panel fue suspendido temporalmente.</p>` +
    renderDataBlock({ label: 'Suspendido por', value: safeSuspendedBy, badgeColor: 'pink' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  contentHtml += `<p style="margin:20px 0 0;font-size:13px;color:#84968e;">Si creés que esto es un error, contactá al equipo de soporte.</p>`

  const text =
    `Hola ${String(username || '')},\n\nTu cuenta en ${brand.name} fue suspendida.\nSuspendido por: ${String(suspendedBy || '')}\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    (contactUrl ? `\nContacto: ${contactUrl}` : '')

  const html = renderPanelEmail({
    subject, preheader: 'Tu acceso al panel fue suspendido.',
    title: 'Cuenta suspendida', contentHtml,
    ctaUrl: contactUrl || '', ctaText: contactUrl ? 'Contactar soporte' : '',
    type: 'danger', icon: '🔒',
  })

  return { subject, html, text }
}

export async function sendAccountSuspendedEmail({ to, username, suspendedBy, reason = '', contactUrl = '' }) {
  const { subject, html, text } = buildAccountSuspendedEmail({ username, suspendedBy, reason, contactUrl })
  return sendMail({ to, subject, html, text })
}
