import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendRegistrationEmail({ to, username }) {
  const brand = getBrandConfig()
  const safeUsername = typeof username === 'string' ? username.trim() : ''
  const subject = '¡Bienvenido a Oguri Bot! - Registro exitoso'

  const text =
    `Hola${safeUsername ? ` ${safeUsername}` : ''},\n\n` +
    `¡Tu cuenta fue creada correctamente en ${brand.name}!\n\n` +
    `Tu rol: Usuario\n\n` +
    `Ingresá al panel: ${brand.panelUrl}\n\n` +
    `Si vos no hiciste este registro, podés ignorar este email de forma segura.\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    Hola${safeUsername ? ` <strong style="color:#ffffff;">${escapeHtml(safeUsername)}</strong>` : ''}, ¡tu cuenta fue creada correctamente!<br /><br />
    <span style="color:#e2e8f0;">Tu rol: <strong style="color:#ffffff;">Usuario</strong></span><br /><br />
    Ya podés acceder al panel y comenzar a usar todas las funcionalidades del bot.
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: 'Tu cuenta fue creada correctamente.',
    title: '¡Bienvenido a Oguri Bot!',
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ir al panel',
  })

  return sendMail({ to, subject, html, text })
}
