import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildTwoFactorCodeEmail({ username, code, expiresMinutes = 5 }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeCode     = escapeHtml(String(code || ''))
  const subject = `${safeCode} es tu código de verificación — ${brand.name}`

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, usá este código para completar tu inicio de sesión.</p>` +
    `<div style="background:rgba(45,212,191,0.06);border:1px solid rgba(45,212,191,0.2);border-radius:12px;padding:20px 18px;margin-bottom:16px;text-align:center;">
      <p style="margin:0 0 4px;color:#84968e;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">Tu código</p>
      <p style="margin:0;font-family:monospace;font-size:36px;font-weight:900;letter-spacing:10px;color:#f2f6f3;">${safeCode}</p>
      <p style="margin:8px 0 0;color:#fbbf24;font-size:12px;font-weight:700;">Vence en ${escapeHtml(String(expiresMinutes))} minutos</p>
    </div>` +
    `<p style="margin:0;font-size:13px;color:#ff4d8d;font-weight:700;">⚠️ No compartas este código con nadie. El equipo de ${escapeHtml(brand.name)} nunca te lo pedirá.</p>`

  const text =
    `Hola ${String(username || '')},\n\nTu código de verificación es: ${String(code || '')}\n\nVence en ${String(expiresMinutes)} minutos.\n\nNo compartas este código con nadie.`

  const html = renderPanelEmail({
    subject, preheader: `Tu código de verificación es ${String(code || '')}`,
    title: 'Código de verificación', contentHtml,
    ctaUrl: '', ctaText: '',
    type: 'info', icon: '🔑',
  })

  return { subject, html, text }
}

export async function sendTwoFactorCodeEmail({ to, username, code, expiresMinutes = 5 }) {
  const { subject, html, text } = buildTwoFactorCodeEmail({ username, code, expiresMinutes })
  return sendMail({ to, subject, html, text })
}
