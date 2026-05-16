import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildRoleChangedEmail({ username, oldRole, newRole, roleDescription = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const subject = `Tu rol fue actualizado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu rol en el panel fue actualizado.</p>` +
    renderDataBlock({ label: 'Rol anterior', value: escapeHtml(String(oldRole || 'Usuario')), badgeColor: 'gray' }) +
    renderDataBlock({ label: 'Nuevo rol', value: escapeHtml(String(newRole || 'Usuario')), badge: '✓ ACTIVO', badgeColor: 'teal' })

  if (roleDescription) {
    contentHtml += `<p style="margin:16px 0 0;font-size:13px;color:#84968e;">${escapeHtml(String(roleDescription))}</p>`
  }

  const text =
    `Hola ${String(username || '')},\n\nTu rol fue actualizado.\nAnterior: ${String(oldRole || '')}\nNuevo: ${String(newRole || '')}\n\nPanel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: `Tu rol cambió de ${String(oldRole || '')} a ${String(newRole || '')}`,
    title: 'Tu rol fue actualizado', contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Ver mi perfil',
    type: 'info', icon: '🔄',
  })

  return { subject, html, text }
}

export async function sendRoleChangedEmail({ to, username, oldRole, newRole, roleDescription = '' }) {
  const { subject, html, text } = buildRoleChangedEmail({ username, oldRole, newRole, roleDescription })
  return sendMail({ to, subject, html, text })
}
