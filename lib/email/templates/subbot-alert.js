import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

const STATUS_CFG = {
  disconnected: { emoji: '🔴', verb: 'se desconectó', badge: 'DESCONECTADO', badgeColor: 'pink'  },
  reconnected:  { emoji: '🟢', verb: 'reconectado',   badge: 'EN LÍNEA',     badgeColor: 'green' },
}

export function buildSubbotAlertEmail({ subbotNumber, subbotName = '', status, reason = '' }) {
  const brand = getBrandConfig()
  const cfg = STATUS_CFG[status] || STATUS_CFG.disconnected
  const safeNumber = escapeHtml(String(subbotNumber || ''))
  const safeName   = escapeHtml(String(subbotName || ''))
  const displayName = safeName ? `${safeName} (${safeNumber})` : safeNumber
  const subject = `🤖 Subbot ${safeNumber} ${cfg.verb} — ${brand.name}`

  let contentHtml = renderDataBlock({ label: 'Subbot', value: `🤖 ${displayName}`, badge: cfg.badge, badgeColor: cfg.badgeColor })
  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  const text =
    `Subbot ${String(subbotNumber || '')} ${cfg.verb}.\n\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    `\nPanel: ${brand.panelUrl}/subbots`

  const html = renderPanelEmail({
    subject,
    preheader: `Subbot ${String(subbotNumber || '')} ${cfg.verb}`,
    title: `🤖 Subbot ${cfg.verb}`,
    contentHtml,
    ctaUrl: `${brand.panelUrl}/subbots`,
    ctaText: 'Gestionar subbots',
  })

  return { subject, html, text }
}

export async function sendSubbotAlertEmail({ to, subbotNumber, subbotName = '', status, reason = '' }) {
  const { subject, html, text } = buildSubbotAlertEmail({ subbotNumber, subbotName, status, reason })
  return sendMail({ to, subject, html, text })
}
