import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAccountReactivatedEmail({ username, reactivatedBy, note = '' }) {
  const brand = getBrandConfig()
  const safeUsername      = escapeHtml(String(username || ''))
  const safeReactivatedBy = escapeHtml(String(reactivatedBy || 'Administrador'))
  const subject = `✅ Tu cuenta fue reactivada — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu acceso al panel fue restaurado.</p>` +
    renderDataBlock({ label: 'Reactivado por', value: safeReactivatedBy, badge: 'ACTIVA', badgeColor: 'green' })

  if (note) contentHtml += `<p style="margin:16px 0 0;font-size:13px;color:#b2c5ba;">${escapeHtml(String(note))}</p>`

  const text = `Hola ${String(username || '')},\n\nTu cuenta en ${brand.name} fue reactivada.\nReactivado por: ${String(reactivatedBy || '')}\n\nPanel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: 'Tu acceso al panel fue restaurado.',
    title: 'Cuenta reactivada', contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Acceder al panel',
    type: 'success', icon: '✅',
  })

  return { subject, html, text }
}

export async function sendAccountReactivatedEmail({ to, username, reactivatedBy, note = '' }) {
  const { subject, html, text } = buildAccountReactivatedEmail({ username, reactivatedBy, note })
  return sendMail({ to, subject, html, text })
}
