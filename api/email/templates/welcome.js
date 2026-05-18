import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendWelcomeEmail({ to, username, role = 'Usuario' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeRole = escapeHtml(String(role || 'Usuario'))
  const subject = `¡Bienvenido al equipo de ${brand.name}!`

  const stepsHtml = `
    <div style="margin:20px 0;padding:16px 20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">Primeros pasos</p>
      <p style="margin:0 0 8px;font-size:14px;color:#374151;">→ Revisá el dashboard de control</p>
      <p style="margin:0 0 8px;font-size:14px;color:#374151;">→ Configurá tus notificaciones en tu perfil</p>
      <p style="margin:0;font-size:14px;color:#374151;">→ Explorá los grupos y sub-bots activos</p>
    </div>`

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#111827;">${safeUsername}</strong>, ¡ya sos parte del equipo de <strong style="color:#111827;">${escapeHtml(brand.name)}</strong>!</p>` +
    renderDataBlock({ label: 'Rol asignado', value: safeRole, badge: '✓ ACTIVO', badgeColor: 'green' }) +
    stepsHtml

  const text =
    `Hola ${String(username || '')},\n\n¡Bienvenido al equipo de ${brand.name}!\n\nTu rol: ${String(role || 'Usuario')}\n\nPanel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: 'Tu cuenta fue activada en el equipo.',
    title: '¡Bienvenido al equipo!', contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Acceder al panel',
    type: 'success', icon: 'rocket',
  })

  return sendMail({ to, subject, html, text })
}
