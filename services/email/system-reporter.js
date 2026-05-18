/**
 * system-reporter.js — snapshot del sistema + resumen IA para emails de mantenimiento
 *
 * Recolecta métricas reales (bot, memoria, plugins, usuarios, grupos) y opcionalmente
 * genera un párrafo narrativo via Claude API (claude-haiku).
 * Si ANTHROPIC_API_KEY no está configurada, renderiza solo la tabla de datos.
 */

import os from 'os'
import fs from 'fs'
import path from 'path'
import { escapeHtml } from './renderer.js'

const ROOT = process.cwd()

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m} min`
  return `${Math.round(seconds)}s`
}

async function collectSnapshot() {
  const snap = {
    timestamp: new Date().toLocaleString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit',
    }),
    bot: {
      connected: false,
      phone: null,
      uptimeSeconds: process.uptime(),
    },
    system: {
      nodeVersion: process.version,
      memTotalMB: Math.round(os.totalmem() / 1024 / 1024),
      memFreeMB:  Math.round(os.freemem() / 1024 / 1024),
      memUsedPct: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
      cpuCount:   os.cpus().length,
      cpuModel:   os.cpus()[0]?.model?.split(' ').slice(0, 3).join(' ') || '?',
      loadAvg:    Math.round(os.loadavg()[0] * 100) / 100,
      platform:   os.platform(),
    },
    plugins: { total: 0, categories: {}, list: [] },
    users:   { total: 0, byRole: {} },
    groups:  0,
    version: '1.8.2',
  }

  // Bot status
  try {
    if (global.conn?.user) {
      snap.bot.connected = true
      snap.bot.phone = global.conn.user.id?.split(':')[0] || null
    }
  } catch {}

  // Plugins from filesystem (exclude internal _*.js and backups)
  try {
    const dir = path.join(ROOT, 'plugins')
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.js') && !f.startsWith('_') && !f.includes('.bak') && !f.includes('.backup'))
    snap.plugins.total = files.length
    snap.plugins.list  = files.map(f => f.replace('.js', ''))
    for (const f of snap.plugins.list) {
      const cat = f.split('-')[0]
      snap.plugins.categories[cat] = (snap.plugins.categories[cat] || 0) + 1
    }
  } catch {}

  // Users from postgres
  try {
    const { pgListUsers } = await import('../lib/pg-usuarios.js')
    const users = await pgListUsers()
    snap.users.total = users.length
    for (const u of users) {
      const rol = String(u.rol || 'user').toLowerCase()
      snap.users.byRole[rol] = (snap.users.byRole[rol] || 0) + 1
    }
  } catch {}

  // Groups from in-memory panelDb
  try {
    snap.groups = Object.keys(global.db?.data?.groups || {}).length
  } catch {}

  return snap
}

function renderDataTable(snap) {
  const botHtml = snap.bot.connected
    ? `<span style="color:#16a34a;font-weight:700;">CONECTADO</span>${snap.bot.phone ? ` · +${escapeHtml(snap.bot.phone)}` : ''} · uptime ${formatUptime(snap.bot.uptimeSeconds)}`
    : `<span style="color:#dc2626;font-weight:700;">DESCONECTADO</span> · proceso activo ${formatUptime(snap.bot.uptimeSeconds)}`

  const catTags = Object.entries(snap.plugins.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) =>
      `<span style="display:inline-block;margin:2px;padding:2px 7px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;font-size:11px;color:#374151;">${escapeHtml(cat)} <strong>${n}</strong></span>`)
    .join('')

  const roleLines = Object.entries(snap.users.byRole)
    .map(([r, n]) => `${escapeHtml(r)}: ${n}`).join(' · ') || 'sin datos'

  const rows = [
    { label: 'Bot WhatsApp',     value: botHtml },
    { label: 'Memoria RAM',      value: `${snap.system.memUsedPct}% en uso · ${snap.system.memFreeMB} MB libres / ${snap.system.memTotalMB} MB` },
    { label: 'CPU / Carga',      value: `${snap.system.cpuCount} núcleos · carga 1m: ${snap.system.loadAvg}` },
    { label: 'Plugins activos',  value: `${snap.plugins.total} comandos` },
    { label: 'Usuarios',         value: `${snap.users.total} registrados (${roleLines})` },
    { label: 'Grupos WA',        value: `${snap.groups} activos` },
    { label: 'Runtime',          value: `Node.js ${snap.system.nodeVersion} · ${snap.system.platform} · v${snap.version}` },
  ]

  const rowsHtml = rows.map((r, i) => {
    const isLast = i === rows.length - 1
    return `<tr>
      <td style="padding:7px 0;border-bottom:${isLast ? 'none' : '1px solid #f3f4f6'};font-size:12px;color:#9ca3af;width:36%;vertical-align:top;padding-right:12px;">${r.label}</td>
      <td style="padding:7px 0;border-bottom:${isLast ? 'none' : '1px solid #f3f4f6'};font-size:13px;color:#374151;">${r.value}</td>
    </tr>`
  }).join('')

  return `
    <div style="margin:24px 0 0;">
      <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">Estado del sistema</p>
      <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
          style="padding:14px 16px;">
          <tr><td colspan="2">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${rowsHtml}
            </table>
          </td></tr>
        </table>
        ${catTags ? `<div style="padding:10px 16px 14px;border-top:1px solid #f3f4f6;">${catTags}</div>` : ''}
      </div>
    </div>`
}

async function callClaudeNarrative(snap, context) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const categorySummary = Object.entries(snap.plugins.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}(${v})`)
    .join(', ')

  const roleBreakdown = Object.entries(snap.users.byRole)
    .map(([r, n]) => `${r}: ${n}`).join(', ') || 'sin datos'

  const contextLabel = context === 'completed'
    ? 'mantenimiento completado, sistema restaurado'
    : 'inicio de mantenimiento programado'

  const systemData = `
Bot WhatsApp: ${snap.bot.connected ? 'CONECTADO' : 'DESCONECTADO'}${snap.bot.phone ? ` (+${snap.bot.phone})` : ''}, uptime ${formatUptime(snap.bot.uptimeSeconds)}
Versión: ${snap.version} — Node.js ${snap.system.nodeVersion}
Memoria: ${snap.system.memUsedPct}% en uso (${snap.system.memFreeMB} MB libres de ${snap.system.memTotalMB} MB)
CPU: ${snap.system.cpuCount} núcleos, carga 1m: ${snap.system.loadAvg}
Plugins: ${snap.plugins.total} comandos — categorías: ${categorySummary}
Usuarios registrados: ${snap.users.total} (${roleBreakdown})
Grupos de WhatsApp: ${snap.groups} activos
Contexto del email: ${contextLabel}
`.trim()

  const prompt = `Sos un asistente técnico que redacta el párrafo de "estado del sistema" para un email de mantenimiento de un bot de WhatsApp con panel de administración.

Datos del sistema:
${systemData}

Escribí UN párrafo corto (3-4 oraciones) en español rioplatense, tono profesional y tranquilizador.
- Mencioná el estado del bot, las métricas clave y el contexto del mantenimiento.
- Si el contexto es "completado", destacá que el sistema está operativo.
- No uses markdown, no uses asteriscos, no uses listas, solo texto plano corrido.
- No empieces con "El sistema" ni con pronombres en primera persona.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 250,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.content?.[0]?.text?.trim() || null
  } catch {
    return null
  }
}

/**
 * Genera el bloque HTML del reporte del sistema.
 * @param {'notice'|'completed'} context
 * @returns {Promise<string>} HTML listo para insertar en el email
 */
export async function generateSystemReportHtml(context = 'notice') {
  let snap
  try {
    snap = await collectSnapshot()
  } catch {
    return ''
  }

  const dataTable = renderDataTable(snap)

  let narrativeHtml = ''
  try {
    const text = await callClaudeNarrative(snap, context)
    if (text) {
      narrativeHtml = `
        <div style="margin:24px 0 0;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
          <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">Diagnóstico generado por IA</p>
          <p style="margin:0;font-size:14px;color:#374151;line-height:1.75;">${escapeHtml(text)}</p>
        </div>`
    }
  } catch {}

  return `<div style="margin:24px 0;">${narrativeHtml}${dataTable}</div>`
}
