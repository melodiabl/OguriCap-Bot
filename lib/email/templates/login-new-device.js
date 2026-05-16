import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildLoginNewDeviceEmail({ username, ip, location = '', device = '', time = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const subject = `🔐 Acceso nuevo detectado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, detectamos un acceso desde un dispositivo que no reconocemos.</p>` +
    renderDataBlock({ label: 'IP de acceso', value: escapeHtml(String(ip || '')), badgeColor: 'pink' })

  if (location) contentHtml += renderDataBlock({ label: 'Ubicación', value: escapeHtml(String(location)), badgeColor: 'gray' })
  if (device)   contentHtml += renderDataBlock({ label: 'Dispositivo', value: escapeHtml(String(device)), badgeColor: 'gray' })
  if (time)     contentHtml += renderDataBlock({ label: 'Hora', value: escapeHtml(String(time)), badgeColor: 'gray' })

  contentHtml += `
    <div style="margin:20px 0 0;padding:14px;background:rgba(255,77,141,0.06);border:1px solid rgba(255,77,141,0.18);border-radius:10px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#ff4d8d;">¿No fuiste vos?</p>
      <p style="margin:0 0 4px;font-size:13px;color:#b2c5ba;">1. Cambiá tu contraseña de inmediato</p>
      <p style="margin:0;font-size:13px;color:#b2c5ba;">2. Revisá los dispositivos activos en tu perfil</p>
    </div>`

  const text =
    `Hola ${String(username || '')},\n\nAcceso nuevo detectado.\nIP: ${String(ip || '')}\n` +
    (location ? `Ubicación: ${location}\n` : '') +
    (device   ? `Dispositivo: ${device}\n` : '') +
    (time     ? `Hora: ${time}\n`          : '') +
    `\nSi no fuiste vos, cambiá tu contraseña: ${brand.panelUrl}/configuracion`

  const html = renderPanelEmail({
    subject, preheader: `Acceso desde IP ${String(ip || '')} en tu cuenta`,
    title: 'Acceso nuevo detectado', contentHtml,
    ctaUrl: `${brand.panelUrl}/configuracion`, ctaText: 'Revisar mi cuenta',
    type: 'danger', icon: '🔐',
  })

  return { subject, html, text }
}

export async function sendLoginNewDeviceEmail({ to, username, ip, location = '', device = '', time = '' }) {
  const { subject, html, text } = buildLoginNewDeviceEmail({ username, ip, location, device, time })
  return sendMail({ to, subject, html, text })
}
