import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildTwoFactorCodeEmail({ username, code, expiresMinutes = 5 }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeCode     = escapeHtml(String(code || ''))
  const subject = `${safeCode} es tu código de verificación — ${brand.name}`

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#111827;">${safeUsername}</strong>, usá este código para completar tu inicio de sesión.</p>` +
    `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:20px 18px;margin-bottom:16px;text-align:center;">
      <p style="margin:0 0 4px;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;">Tu código</p>
      <p style="margin:0;font-family:monospace;font-size:36px;font-weight:900;letter-spacing:10px;color:#111827;">${safeCode}</p>
      <p style="margin:8px 0 0;color:#d97706;font-size:12px;font-weight:700;">Vence en ${escapeHtml(String(expiresMinutes))} minutos</p>
    </div>` +
    `<p style="margin:0;font-size:13px;color:#dc2626;font-weight:700;">⚠️ No compartas este código con nadie. El equipo de ${escapeHtml(brand.name)} nunca te lo pedirá.</p>`

  const text =
    `Hola ${String(username || '')},\n\nTu código de verificación es: ${String(code || '')}\n\nVence en ${String(expiresMinutes)} minutos.\n\nNo compartas este código con nadie.`

  const html = renderPanelEmail({
    subject, preheader: `Tu código de verificación es ${String(code || '')}`,
    title: 'Código de verificación', contentHtml,
    ctaUrl: '', ctaText: '',
    type: 'info', icon: 'shield',
  })

  return { subject, html, text }
}

export async function sendTwoFactorCodeEmail({ to, username, code, expiresMinutes = 5 }) {
  const { subject, html, text } = buildTwoFactorCodeEmail({ username, code, expiresMinutes })
  return sendMail({ to, subject, html, text })
}
