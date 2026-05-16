import { getBrandConfig } from './config.js'
import { renderPanelEmail, escapeHtml } from './renderer.js'
import { sendMail } from './service.js'

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
