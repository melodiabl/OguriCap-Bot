/**
 * system-reporter.js — reporte del sistema para emails de mantenimiento
 *
 * Recolecta métricas reales (bot, RAM, CPU, plugins, usuarios, grupos) y
 * genera HTML estructurado sin dependencias externas. Sin IA, sin subprocess.
 */

import os from 'os'
import fs from 'fs'
import path from 'path'
import { escapeHtml } from './renderer.js'

const ROOT = process.cwd()

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}min`
  if (m > 0) return `${m} min`
  return `${Math.round(seconds)}s`
}

function safeReadDir(p) {
  try { return fs.readdirSync(p) } catch { return [] }
}

// ── Recolección de datos ───────────────────────────────────────────────────────

async function collectSnapshot() {
  const snap = {
    bot: {
      connected: false,
      uptimeSeconds: process.uptime(),
    },
    system: {
      nodeVersion: process.version,
      memTotalMB: Math.round(os.totalmem() / 1024 / 1024),
      memFreeMB:  Math.round(os.freemem() / 1024 / 1024),
      memUsedPct: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
      cpuCount:   os.cpus().length,
      loadAvg:    Math.round(os.loadavg()[0] * 100) / 100,
      platform:   os.platform(),
    },
    plugins: { total: 0, categories: {} },
    users:   { total: 0, byRole: {} },
    groups:  0,
  }

  try {
    if (global.conn?.user) snap.bot.connected = true
  } catch {}

  try {
    const files = safeReadDir(path.join(ROOT, 'plugins'))
      .filter(f => f.endsWith('.js') && !f.startsWith('_') && !f.includes('.bak') && !f.includes('.backup'))
    snap.plugins.total = files.length
    for (const f of files) {
      const cat = f.split('-')[0]
      snap.plugins.categories[cat] = (snap.plugins.categories[cat] || 0) + 1
    }
  } catch {}

  try {
    const { pgListUsers } = await import('../lib/pg-usuarios.js')
    const users = await pgListUsers()
    snap.users.total = users.length
    for (const u of users) {
      const rol = String(u.rol || 'user').toLowerCase()
      snap.users.byRole[rol] = (snap.users.byRole[rol] || 0) + 1
    }
  } catch {}

  try {
    snap.groups = Object.keys(global.db?.data?.groups || {}).length
  } catch {}

  return snap
}

// ── Indicadores de estado ──────────────────────────────────────────────────────

function ramColor(pct) {
  if (pct >= 85) return { text: '#dc2626', bg: '#fee2e2', label: 'ALTO' }
  if (pct >= 65) return { text: '#d97706', bg: '#fef3c7', label: 'MODERADO' }
  return { text: '#16a34a', bg: '#dcfce7', label: 'NORMAL' }
}

function cpuColor(load, cores) {
  const pct = Math.round((load / cores) * 100)
  if (pct >= 80) return { text: '#dc2626', bg: '#fee2e2', label: 'ALTO' }
  if (pct >= 50) return { text: '#d97706', bg: '#fef3c7', label: 'MODERADO' }
  return { text: '#16a34a', bg: '#dcfce7', label: 'NORMAL' }
}

function badge(label, color, bg) {
  return `<span style="font-size:10px;font-weight:700;color:${color};background:${bg};padding:2px 7px;border-radius:4px;letter-spacing:.5px;">${label}</span>`
}

// ── Renderizado ────────────────────────────────────────────────────────────────

function renderReport(snap, context) {
  const isCompleted = context === 'completed'

  // ── Fila bot ──
  const botBadge = snap.bot.connected
    ? badge('CONECTADO', '#16a34a', '#dcfce7')
    : badge('DESCONECTADO', '#dc2626', '#fee2e2')
  const botUptime = `uptime ${formatUptime(snap.bot.uptimeSeconds)}`

  // ── Fila RAM ──
  const ram   = ramColor(snap.system.memUsedPct)
  const ramBadge = badge(ram.label, ram.text, ram.bg)
  const ramVal = `${snap.system.memUsedPct}% en uso · ${snap.system.memFreeMB} MB libres / ${snap.system.memTotalMB} MB`

  // ── Fila CPU ──
  const cpu     = cpuColor(snap.system.loadAvg, snap.system.cpuCount)
  const cpuBadge = badge(cpu.label, cpu.text, cpu.bg)
  const cpuVal  = `${snap.system.cpuCount} núcleos · carga ${snap.system.loadAvg}`

  // ── Fila usuarios ──
  const roleBreak = Object.entries(snap.users.byRole)
    .map(([r, n]) => `${r}: ${n}`).join(' · ') || '—'

  const rows = [
    { label: 'Bot WhatsApp',    right: `${botBadge} &nbsp;${botUptime}` },
    { label: 'Memoria RAM',     right: `${ramBadge} &nbsp;${escapeHtml(ramVal)}` },
    { label: 'CPU / Carga',     right: `${cpuBadge} &nbsp;${escapeHtml(cpuVal)}` },
    { label: 'Plugins activos', right: `<strong style="color:#111827;">${snap.plugins.total}</strong> comandos` },
    { label: 'Usuarios',        right: `${snap.users.total} registrados &nbsp;<span style="color:#9ca3af;font-size:12px;">(${escapeHtml(roleBreak)})</span>` },
    { label: 'Grupos WA',       right: `${snap.groups} activos` },
    { label: 'Runtime',         right: `Node.js ${escapeHtml(snap.system.nodeVersion)} · ${escapeHtml(snap.system.platform)}` },
  ]

  const rowsHtml = rows.map((r, i) => {
    const border = i < rows.length - 1 ? '1px solid #f3f4f6' : 'none'
    return `<tr>
      <td style="padding:8px 0;border-bottom:${border};font-size:12px;color:#9ca3af;width:34%;vertical-align:middle;padding-right:12px;">${r.label}</td>
      <td style="padding:8px 0;border-bottom:${border};font-size:13px;color:#374151;vertical-align:middle;">${r.right}</td>
    </tr>`
  }).join('')

  // ── Tags de categorías de plugins ──
  const catTags = Object.entries(snap.plugins.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) =>
      `<span style="display:inline-block;margin:2px;padding:2px 8px;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:4px;font-size:11px;color:#374151;">${escapeHtml(cat)} <strong style="color:#111827;">${n}</strong></span>`)
    .join('')

  // ── Bloque contextual según tipo de mantenimiento ──
  const contextColor   = isCompleted ? '#16a34a' : '#d97706'
  const contextBg      = isCompleted ? '#f0fdf4' : '#fffbeb'
  const contextBorder  = isCompleted ? '#bbf7d0' : '#fde68a'
  const contextTitle   = isCompleted ? 'Sistema operativo' : 'Sistema en mantenimiento'
  const contextMsg     = isCompleted
    ? 'Todas las métricas fueron relevadas al momento de finalizar el mantenimiento. Los servicios están disponibles.'
    : 'Estos datos corresponden al estado del sistema previo al inicio del mantenimiento programado.'

  const contextBlock = `
    <div style="margin:0 0 16px;padding:12px 14px;background:${contextBg};border:1px solid ${contextBorder};border-radius:6px;display:flex;align-items:flex-start;gap:10px;">
      <div style="flex-shrink:0;width:18px;height:18px;border-radius:50%;background:${contextColor};text-align:center;line-height:18px;margin-top:1px;">
        <span style="font-size:10px;font-weight:900;color:#fff;">${isCompleted ? '✓' : '!'}</span>
      </div>
      <div>
        <p style="margin:0 0 3px;font-size:12px;font-weight:700;color:${contextColor};text-transform:uppercase;letter-spacing:.5px;">${contextTitle}</p>
        <p style="margin:0;font-size:13px;color:#374151;line-height:1.5;">${contextMsg}</p>
      </div>
    </div>`

  return `
    <div style="margin:24px 0;">
      <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">Estado del sistema</p>
      <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <div style="padding:14px 16px 0;">
          ${contextBlock}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${rowsHtml}
          </table>
        </div>
        ${catTags ? `<div style="padding:10px 16px 14px;border-top:1px solid #f3f4f6;margin-top:8px;">${catTags}</div>` : ''}
      </div>
    </div>`
}

// ── Export ─────────────────────────────────────────────────────────────────────

/**
 * Genera el bloque HTML del reporte del sistema.
 * Si customSummary está presente, lo muestra como bloque destacado encima.
 * @param {'notice'|'completed'} context
 * @param {string} [customSummary]
 * @returns {Promise<string>}
 */
export async function generateSystemReportHtml(context = 'notice', customSummary = '') {
  let snap
  try {
    snap = await collectSnapshot()
  } catch {
    return ''
  }

  const reportHtml = renderReport(snap, context)

  if (!customSummary?.trim()) return reportHtml

  const summaryBlock = `
    <div style="margin:24px 0 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
      <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">Nota del administrador</p>
      <p style="margin:0;font-size:14px;color:#374151;line-height:1.75;">${escapeHtml(customSummary.trim())}</p>
    </div>`

  return `${summaryBlock}${reportHtml}`
}
