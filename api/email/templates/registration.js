import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendRegistrationEmail({ to, username, role = 'Usuario' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeRole = escapeHtml(String(role || 'Usuario'))
  const subject = `¡Bienvenido a ${brand.name}! — Registro exitoso`
  const date = new Date().toLocaleString('es-ES', { dateStyle: 'long' })

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, ¡tu cuenta fue creada correctamente!</p>` +
    renderDataBlock({ label: 'Rol asignado', value: safeRole, badge: 'ACTIVO', badgeColor: 'green' }) +
    renderDataBlock({ label: 'Fecha de registro', value: date, badgeColor: 'gray' }) +
    `<p style="margin:20px 0 0;font-size:13px;color:#84968e;">Si vos no hiciste este registro, podés ignorar este email de forma segura.</p>`

  const text =
    `Hola ${String(username || '')},\n\n¡Tu cuenta fue creada correctamente en ${brand.name}!\n\nRol: ${String(role || 'Usuario')}\n\nIngresá al panel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: 'Tu cuenta fue creada correctamente.',
    title: `¡Bienvenido a ${brand.name}!`, contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Ir al panel',
    type: 'success', icon: '🎉',
  })

  return sendMail({ to, subject, html, text })
}
