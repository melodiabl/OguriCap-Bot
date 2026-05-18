import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildSubbotCreatedEmail({ subbotName, subbotNumber, createdBy }) {
  const brand = getBrandConfig()
  const safeSubbotName   = escapeHtml(String(subbotName || subbotNumber || ''))
  const safeSubbotNumber = escapeHtml(String(subbotNumber || ''))
  const safeCreatedBy    = escapeHtml(String(createdBy || 'Administrador'))
  const subject = `🤖 Nuevo sub-bot creado — ${brand.name}`

  const contentHtml =
    `<p style="margin:0 0 20px;">Un nuevo sub-bot fue añadido al sistema.</p>` +
    renderDataBlock({ label: 'Nombre', value: safeSubbotName, badge: 'ACTIVO', badgeColor: 'green' }) +
    renderDataBlock({ label: 'Número', value: safeSubbotNumber, badgeColor: 'teal' }) +
    renderDataBlock({ label: 'Creado por', value: safeCreatedBy, badgeColor: 'gray' })

  const text = `Nuevo sub-bot creado en ${brand.name}.\nNombre: ${String(subbotName || '')}\nNúmero: ${String(subbotNumber || '')}\nCreado por: ${String(createdBy || '')}\n\nPanel: ${brand.panelUrl}/subbots`

  const html = renderPanelEmail({
    subject, preheader: `Nuevo sub-bot ${String(subbotNumber || '')} creado`,
    title: 'Nuevo sub-bot creado', contentHtml,
    ctaUrl: `${brand.panelUrl}/subbots`, ctaText: 'Ver sub-bots',
    type: 'success', icon: 'cpu-chip',
  })

  return { subject, html, text }
}

export async function sendSubbotCreatedEmail({ to, subbotName, subbotNumber, createdBy }) {
  const { subject, html, text } = buildSubbotCreatedEmail({ subbotName, subbotNumber, createdBy })
  return sendMail({ to, subject, html, text })
}
