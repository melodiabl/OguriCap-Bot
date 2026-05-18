import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

const STATUS_CFG = {
  disconnected: { type: 'danger',  icon: 'exclamation-triangle', verb: 'se desconectó', badge: 'DESCONECTADO', badgeColor: 'pink',  preheader: 'El bot se desconectó' },
  reconnected:  { type: 'success', icon: 'arrow-path',           verb: 'está en línea', badge: 'EN LÍNEA',     badgeColor: 'green', preheader: 'El bot volvió en línea' },
  error:        { type: 'warning', icon: 'exclamation-triangle', verb: 'tuvo un error', badge: 'ERROR',        badgeColor: 'gold',  preheader: 'Error detectado en el bot' },
}

export function buildBotAlertEmail({ botName, status, reason = '', since = '' }) {
  const brand = getBrandConfig()
  const cfg = STATUS_CFG[status] || STATUS_CFG.disconnected
  const safeBotName = escapeHtml(String(botName || 'Bot'))
  const subject = `${safeBotName} ${cfg.verb} — ${brand.name}`

  let contentHtml = renderDataBlock({ label: 'Bot', value: safeBotName, badge: cfg.badge, badgeColor: cfg.badgeColor })
  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })
  if (since)  contentHtml += renderDataBlock({ label: 'Desde',  value: escapeHtml(String(since)),  badgeColor: 'gray' })

  const text =
    `${String(botName || 'Bot')} ${cfg.verb}.\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    (since  ? `Desde: ${since}\n`  : '') +
    `\nPanel: ${brand.panelUrl}/bot`

  const html = renderPanelEmail({
    subject, preheader: cfg.preheader,
    title: `${safeBotName} ${cfg.verb}`, contentHtml,
    ctaUrl: `${brand.panelUrl}/bot`, ctaText: 'Ver estado del bot',
    type: cfg.type, icon: cfg.icon,
  })

  return { subject, html, text }
}

export async function sendBotAlertEmail({ to, botName, status, reason = '', since = '' }) {
  const { subject, html, text } = buildBotAlertEmail({ botName, status, reason, since })
  return sendMail({ to, subject, html, text })
}
