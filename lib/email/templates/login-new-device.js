import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildLoginNewDeviceEmail({ username, ip, location = '', device = '', time = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const subject = `🔐 Acceso nuevo detectado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, detectamos un acceso desde un dispositivo que no reconocemos.</p>` +
    renderDataBlock({ label: 'IP', value: escapeHtml(String(ip || '')), badgeColor: 'teal' })

  if (location) contentHtml += renderDataBlock({ label: 'Ubicación',   value: escapeHtml(String(location)), badgeColor: 'gray' })
  if (device)   contentHtml += renderDataBlock({ label: 'Dispositivo', value: escapeHtml(String(device)),   badgeColor: 'gray' })
  if (time)     contentHtml += renderDataBlock({ label: 'Hora',        value: escapeHtml(String(time)),     badgeColor: 'gray' })

  contentHtml += `<p style="margin:20px 0 0;color:#ff4d8d;font-size:13px;font-weight:700;">⚠️ Si no fuiste vos, cambiá tu contraseña de inmediato.</p>`

  const text =
    `Hola ${String(username || '')},\n\n` +
    `Detectamos un acceso desde un dispositivo nuevo.\n\n` +
    `IP: ${String(ip || '')}\n` +
    (location ? `Ubicación: ${location}\n`   : '') +
    (device   ? `Dispositivo: ${device}\n`   : '') +
    (time     ? `Hora: ${time}\n`            : '') +
    `\nSi no fuiste vos, cambiá tu contraseña de inmediato.\nPanel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject,
    preheader: `Acceso desde IP ${String(ip || '')} detectado en tu cuenta`,
    title: '🔐 Acceso nuevo detectado',
    contentHtml,
    ctaUrl: `${brand.panelUrl}/configuracion`,
    ctaText: 'Revisar mi cuenta',
  })

  return { subject, html, text }
}

export async function sendLoginNewDeviceEmail({ to, username, ip, location = '', device = '', time = '' }) {
  const { subject, html, text } = buildLoginNewDeviceEmail({ username, ip, location, device, time })
  return sendMail({ to, subject, html, text })
}
