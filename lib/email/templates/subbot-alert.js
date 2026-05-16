import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

const STATUS_CFG = {
  disconnected: { type: 'danger',  icon: '🔴', verb: 'se desconectó', badge: 'OFFLINE',   badgeColor: 'pink',  preheader: 'Un sub-bot se desconectó' },
  reconnected:  { type: 'success', icon: '🟢', verb: 'reconectado',   badge: 'EN LÍNEA',  badgeColor: 'green', preheader: 'Sub-bot volvió en línea' },
  error:        { type: 'warning', icon: '⚠️', verb: 'tuvo un error', badge: 'ERROR',     badgeColor: 'gold',  preheader: 'Error en sub-bot' },
}

export function buildSubbotAlertEmail({ subbotNumber, subbotName = '', status, reason = '' }) {
  const brand = getBrandConfig()
  const cfg = STATUS_CFG[status] || STATUS_CFG.disconnected
  const displayName = subbotName ? `${escapeHtml(subbotName)} (${escapeHtml(subbotNumber)})` : escapeHtml(subbotNumber)
  const subject = `Sub-bot ${displayName} ${cfg.verb} — ${brand.name}`

  let contentHtml = renderDataBlock({ label: 'Sub-bot', value: displayName, badge: cfg.badge, badgeColor: cfg.badgeColor })
  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  const text =
    `Sub-bot ${String(subbotNumber || '')} ${cfg.verb}.\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    `\nPanel: ${brand.panelUrl}/subbots`

  const html = renderPanelEmail({
    subject, preheader: cfg.preheader,
    title: `Sub-bot ${cfg.verb}`, contentHtml,
    ctaUrl: `${brand.panelUrl}/subbots`, ctaText: 'Ver sub-bots',
    type: cfg.type, icon: cfg.icon,
  })

  return { subject, html, text }
}

export async function sendSubbotAlertEmail({ to, subbotNumber, subbotName = '', status, reason = '' }) {
  const { subject, html, text } = buildSubbotAlertEmail({ subbotNumber, subbotName, status, reason })
  return sendMail({ to, subject, html, text })
}
