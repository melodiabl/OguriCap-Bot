import { getBrandConfig } from './config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from './renderer.js'
import { sendMail } from './service.js'

const OUTAGE_PRESET_CFG = {
  outage: {
    type: 'danger', icon: 'x-circle',
    statusLabel: 'FUERA DE LÍNEA', statusColor: 'pink',
    ctaText: 'Ver estado',
    footer: 'Te notificaremos cuando el servicio se restaure. Pedimos disculpas por las molestias.',
  },
  issues: {
    type: 'warning', icon: 'exclamation-triangle',
    statusLabel: 'DEGRADADO', statusColor: 'gold',
    ctaText: 'Ver estado del sistema',
    footer: 'Nuestro equipo está trabajando para resolver el problema lo antes posible.',
  },
  maintenance: {
    type: 'warning', icon: 'cog',
    statusLabel: 'EN MANTENIMIENTO', statusColor: 'gold',
    ctaText: 'Ver estado',
    footer: 'El sistema volverá a estar disponible una vez finalizado el mantenimiento.',
  },
  'back-online': {
    type: 'success', icon: 'check-circle',
    statusLabel: 'EN LÍNEA', statusColor: 'green',
    ctaText: 'Usar el servicio',
    footer: '¡Gracias por tu paciencia! Todo está funcionando con normalidad.',
  },
  custom: {
    type: 'info', icon: 'bell',
    statusLabel: null, statusColor: 'gray',
    ctaText: 'Ver en el panel',
    footer: null,
  },
}

export function buildGlobalBroadcastEmail({ preset = 'custom', title, message, priority = 'normal' }) {
  const brand = getBrandConfig()
  const cfg = OUTAGE_PRESET_CFG[preset] || OUTAGE_PRESET_CFG.custom
  const safeTitle   = escapeHtml(String(title || 'Aviso del sistema'))
  const safeMessage = escapeHtml(String(message || '')).replace(/\n/g, '<br />')
  const timestamp   = new Date().toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' })

  let emailType = cfg.type
  if (preset === 'custom') {
    emailType = priority === 'critical' ? 'danger' : priority === 'high' ? 'warning' : 'info'
  }

  let contentHtml = `<p style="margin:0 0 20px;font-size:15px;color:#374151;">${safeMessage}</p>`

  if (cfg.statusLabel) {
    contentHtml =
      renderDataBlock({ label: 'Estado del servicio', value: brand.name, badge: cfg.statusLabel, badgeColor: cfg.statusColor }) +
      renderDataBlock({ label: 'Fecha y hora', value: escapeHtml(timestamp), badgeColor: 'gray' }) +
      `<p style="margin:16px 0 20px;font-size:15px;color:#374151;">${safeMessage}</p>`
  }

  if (cfg.footer) {
    contentHtml += `<div style="margin:20px 0 0;padding:14px 16px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;"><p style="margin:0;font-size:13px;color:#6b7280;">${escapeHtml(cfg.footer)}</p></div>`
  }

  const subject = `${brand.name} — ${String(title || 'Aviso del sistema')}`
  const text = `${String(title || 'Aviso del sistema')}\n\n${String(message || '')}\n\nFecha: ${timestamp}\nPanel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: String(message || '').slice(0, 100),
    title: safeTitle, contentHtml,
    ctaUrl: brand.panelUrl, ctaText: cfg.ctaText,
    type: emailType, icon: cfg.icon,
  })

  return { subject, html, text }
}

export async function sendGlobalBroadcastEmail({ to, preset, title, message, priority }) {
  const { subject, html, text } = buildGlobalBroadcastEmail({ preset, title, message, priority })
  return sendMail({ to, subject, html, text })
}

export async function sendBroadcastEmail({ subject, preheader, title, contentHtml, recipients }) {
  const brand = getBrandConfig()
  const html = renderPanelEmail({
    subject: `${brand.name} - ${subject}`,
    preheader,
    title,
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ver más en el panel',
  })
  return sendMail({ to: recipients, subject: `${brand.name} - ${subject}`, html })
}

export async function sendPushBroadcast({ title, body, data = {}, recipients = [], tag = 'broadcast' }) {
  const broadcastId = `push_${Date.now()}`

  const panelDb = global.panelDb || (typeof global.loadDatabase === 'function' ? global.loadDatabase() : null)
  if (panelDb?.broadcasts) {
    panelDb.broadcasts[broadcastId] = {
      id: broadcastId, type: 'push', title, body, data, recipients,
      createdAt: new Date().toISOString(), sent: false,
    }
  }

  try {
    const { emitNotification } = await import('../socket-io.js')
    if (emitNotification) {
      emitNotification({
        id: broadcastId, titulo: title || 'Broadcast Push', mensaje: body || '',
        tipo: 'info', categoria: 'broadcast', targetRoles: null, para: 'all',
        timestamp: new Date().toISOString(),
      })
    }
  } catch {}

  try {
    const { getIO } = await import('../socket-io.js')
    const io = getIO()
    if (io) {
      io.emit('push:broadcast', { id: broadcastId, title, body, data, tag, timestamp: Date.now() })
    }
  } catch {}

  return { success: true, broadcastId }
}

export async function sendFullBroadcast({ subject, preheader, title, contentHtml, emailRecipients = [], pushRecipients = [], sendEmail = true, sendPush = true }) {
  const results = { email: null, push: null, errors: [] }

  if (sendEmail && emailRecipients.length > 0) {
    try {
      results.email = await sendBroadcastEmail({ subject, preheader, title, contentHtml, recipients: emailRecipients })
    } catch (error) {
      results.errors.push(`Email error: ${error.message}`)
    }
  }

  if (sendPush && pushRecipients.length > 0) {
    try {
      results.push = await sendPushBroadcast({
        title, body: preheader, recipients: pushRecipients,
        data: { subject, contentHtml: contentHtml.substring(0, 200) },
      })
    } catch (error) {
      results.errors.push(`Push error: ${error.message}`)
    }
  }

  return results
}

export async function generateBroadcastContent(prompt, context = {}) {
  const brand = getBrandConfig()
  const stats = context.stats || {
    messages: context.messagesProcessed || 0,
    commands: context.commandsExecuted || 0,
    users: context.newUsers || 0,
    uptime: context.uptime || 0,
  }

  const aiContext = `
Eres el asistente de marketing de ${brand.name}.
Genera contenido para un broadcast (notificación/email) con el siguiente contexto:

ESTADÍSTICAS DEL BOT:
- Mensajes procesados: ${stats.messages}
- Comandos ejecutados: ${stats.commands}
- Usuarios nuevos: ${stats.users}
- Uptime: ${Math.floor(stats.uptime / 3600)} horas

SOLICITUD DEL USUARIO:
${prompt}

INSTRUCCIONES:
1. Genera un título breve y atractivo (máx 60 caracteres)
2. Genera un preheader/extracto (máx 100 caracteres)
3. Genera contenido HTML para el email (máx 500 palabras)
4. El tono debe ser profesional pero amigable
5. Incluye datos relevantes de las estadísticas cuando aplique
6. Usa emojis apropiados

FORMATO DE RESPUESTA (JSON):
{
  "title": "...",
  "preheader": "...",
  "content": "..."
}
`

  try {
    const { default: fetch } = await import('node-fetch')
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'llama3.2:latest', prompt: aiContext, stream: false, format: 'json' }),
      signal: AbortSignal.timeout(10000),
    })
    if (response.ok) {
      const data = await response.json()
      if (data.response) {
        const parsed = JSON.parse(data.response)
        return { success: true, title: parsed.title || 'Notificación', preheader: parsed.preheader || '', contentHtml: parsed.content || '', source: 'ai' }
      }
    }
  } catch {}

  return {
    success: false,
    title: 'Notificación',
    preheader: prompt.substring(0, 100),
    contentHtml: `<p style="color:#94a3b8;">${escapeHtml(prompt)}</p>
    <p style="color:#64748b;font-size:12px;margin-top:20px;">
      Stats: ${stats.messages} msgs | ${stats.commands} comandos | ${stats.users} usuarios nuevos
    </p>`,
    source: 'manual',
  }
}
