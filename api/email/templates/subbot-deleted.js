import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildSubbotDeletedEmail({ subbotName, deletedBy, reason = '' }) {
  const brand = getBrandConfig()
  const safeSubbotName = escapeHtml(String(subbotName || ''))
  const safeDeletedBy  = escapeHtml(String(deletedBy || 'Administrador'))
  const subject = `🤖 Sub-bot eliminado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Un sub-bot fue eliminado del sistema.</p>` +
    renderDataBlock({ label: 'Sub-bot eliminado', value: safeSubbotName, badge: 'ELIMINADO', badgeColor: 'pink' }) +
    renderDataBlock({ label: 'Eliminado por', value: safeDeletedBy, badgeColor: 'gray' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  const text = `Sub-bot ${String(subbotName || '')} eliminado en ${brand.name}.\nEliminado por: ${String(deletedBy || '')}\n` +
    (reason ? `Motivo: ${reason}\n` : '')

  const html = renderPanelEmail({
    subject, preheader: `Sub-bot ${String(subbotName || '')} fue eliminado`,
    title: 'Sub-bot eliminado', contentHtml,
    ctaUrl: '', ctaText: '',
    type: 'danger', icon: 'cpu-chip',
  })

  return { subject, html, text }
}

export async function sendSubbotDeletedEmail({ to, subbotName, deletedBy, reason = '' }) {
  const { subject, html, text } = buildSubbotDeletedEmail({ subbotName, deletedBy, reason })
  return sendMail({ to, subject, html, text })
}
