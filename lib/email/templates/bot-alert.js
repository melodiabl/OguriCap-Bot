import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

const STATUS_CFG = {
  disconnected: { emoji: '🔴', verb: 'se desconectó', badge: 'DESCONECTADO', badgeColor: 'pink',  preheader: 'El bot se desconectó del sistema' },
  reconnected:  { emoji: '🟢', verb: 'reconectado',   badge: 'EN LÍNEA',     badgeColor: 'green', preheader: 'El bot está de vuelta en línea'  },
  error:        { emoji: '⚠️', verb: 'tuvo un error', badge: 'ERROR',        badgeColor: 'pink',  preheader: 'Error detectado en el bot'        },
}

export function buildBotAlertEmail({ botName, status, reason = '', since = '' }) {
  const brand = getBrandConfig()
  const cfg = STATUS_CFG[status] || STATUS_CFG.disconnected
  const safeBotName = escapeHtml(String(botName || 'Bot'))
  const subject = `${cfg.emoji} ${safeBotName} ${cfg.verb} — ${brand.name}`

  let contentHtml = renderDataBlock({ label: 'Bot', value: `${cfg.emoji} ${safeBotName}`, badge: cfg.badge, badgeColor: cfg.badgeColor })
  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })
  if (since)  contentHtml += renderDataBlock({ label: 'Desde',  value: escapeHtml(String(since)),  badgeColor: 'gray' })

  const text =
    `${safeBotName} ${cfg.verb}.\n\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    (since  ? `Desde: ${since}\n`  : '') +
    `\nPanel: ${brand.panelUrl}/bot`

  const html = renderPanelEmail({
    subject,
    preheader: cfg.preheader,
    title: `${cfg.emoji} ${safeBotName} ${cfg.verb}`,
    contentHtml,
    ctaUrl: `${brand.panelUrl}/bot`,
    ctaText: 'Ver estado del bot',
  })

  return { subject, html, text }
}

export async function sendBotAlertEmail({ to, botName, status, reason = '', since = '' }) {
  const { subject, html, text } = buildBotAlertEmail({ botName, status, reason, since })
  return sendMail({ to, subject, html, text })
}
