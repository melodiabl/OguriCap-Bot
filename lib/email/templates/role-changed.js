import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildRoleChangedEmail({ username, oldRole, newRole }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const subject = `Tu rol fue actualizado — ${brand.name}`

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu rol en el panel fue actualizado.</p>` +
    renderDataBlock({ label: 'Rol anterior', value: `🔒 ${String(oldRole || 'Usuario')}`, badgeColor: 'gray' }) +
    renderDataBlock({ label: 'Nuevo rol', value: `🔑 ${String(newRole || 'Usuario')}`, badge: '✓ ACTIVO', badgeColor: 'green' })

  const text =
    `Hola ${String(username || '')},\n\n` +
    `Tu rol fue actualizado.\n\nAnterior: ${String(oldRole || '')}\nNuevo: ${String(newRole || '')}\n\n` +
    `Panel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject,
    preheader: `Tu rol cambió de ${String(oldRole || '')} a ${String(newRole || '')}`,
    title: `Tu rol cambió, ${String(username || '')}`,
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ver mi perfil',
  })

  return { subject, html, text }
}

export async function sendRoleChangedEmail({ to, username, oldRole, newRole }) {
  const { subject, html, text } = buildRoleChangedEmail({ username, oldRole, newRole })
  return sendMail({ to, subject, html, text })
}
