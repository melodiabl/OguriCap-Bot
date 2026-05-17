import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendPasswordResetEmail({ to, username, token, expiresMinutes = 30 }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeToken = String(token || '').trim()
  const resetUrl = `${brand.panelUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(safeToken)}`
  const subject = `Restablecer contraseña — ${brand.name}`

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, recibimos una solicitud para restablecer tu contraseña.</p>` +
    renderDataBlock({ label: 'Este link vence en', value: `${expiresMinutes} minutos`, badge: 'URGENTE', badgeColor: 'gold' }) +
    `<p style="margin:16px 0 0;color:#ff4d8d;font-size:13px;font-weight:700;">⚠️ Si vos no lo pediste, ignorá este email. Tu contraseña no cambiará.</p>`

  const text =
    `Hola ${String(username || '')},\n\nLink para restablecer tu contraseña (vence en ${expiresMinutes} min):\n${resetUrl}\n\nSi no lo pediste, ignorá este email.`

  const html = renderPanelEmail({
    subject, preheader: `Restablecé tu contraseña — vence en ${expiresMinutes} min`,
    title: 'Restablecer contraseña', contentHtml,
    ctaUrl: resetUrl, ctaText: 'Restablecer contraseña',
    type: 'warning', icon: '🔑',
  })

  return sendMail({ to, subject, html, text })
}
