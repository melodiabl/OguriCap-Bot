import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendWelcomeEmail({ to, username, role = 'Usuario' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(username || '')
  const safeRole = escapeHtml(role || 'Usuario')
  const subject = `¡Bienvenido al equipo de ${brand.name}!`

  const text =
    `Hola ${username},\n\n` +
    `¡Bienvenido al equipo de ${brand.name}!\n\n` +
    `Tu cuenta ha sido creada con el rol: ${role}\n\n` +
    `Accedé al panel: ${brand.panelUrl}\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    Hola <strong style="color:#ffffff;">${safeUsername}</strong>,<br /><br />
    ¡Bienvenido al equipo de <strong style="color:#ffffff;">${escapeHtml(brand.name)}</strong>!<br /><br />
    Tu cuenta ha sido creada exitosamente con el rol: <strong style="color:#10b981;">${safeRole}</strong><br /><br />
    Ya podés acceder al panel de administración y comenzar a gestionar el bot.
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: 'Tu cuenta ha sido creada exitosamente.',
    title: '¡Bienvenido al equipo!',
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Acceder al panel',
  })

  return sendMail({ to, subject, html, text })
}
