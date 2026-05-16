import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendPasswordResetEmail({ to, username, token, expiresMinutes = 30 }) {
  const brand = getBrandConfig()
  const safeUsername = typeof username === 'string' ? username.trim() : ''
  const safeToken = String(token || '').trim()
  const resetUrl = `${brand.panelUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(safeToken)}`
  const subject = 'Restablecer contraseña - Oguri Bot'

  const text =
    `Hola${safeUsername ? ` ${safeUsername}` : ''},\n\n` +
    `Recibimos una solicitud para restablecer tu contraseña.\n\n` +
    `Abrí este link para crear una nueva contraseña (vence en ${expiresMinutes} minutos):\n${resetUrl}\n\n` +
    `Si vos no pediste esto, ignorá este email y tu contraseña no cambiará.\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    Hola${safeUsername ? ` <strong style="color:#ffffff;">${escapeHtml(safeUsername)}</strong>` : ''}.<br /><br />
    Recibimos una solicitud para restablecer tu contraseña.<br /><br />
    <strong style="color:#ffffff;">Este link vence en ${expiresMinutes} minutos.</strong><br /><br />
    Si no solicitaste este cambio, simplemente ignorá este email y tu contraseña permanecerá sin cambios.
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: `Restablecé tu contraseña (vence en ${expiresMinutes} min)`,
    title: 'Restablecer contraseña',
    contentHtml,
    ctaUrl: resetUrl,
    ctaText: 'Restablecer contraseña',
  })

  return sendMail({ to, subject, html, text })
}
