/**
 * system-reporter.js — snapshot del sistema + resumen completo via Claude Code CLI
 *
 * Recolecta métricas de runtime (bot, RAM, CPU, usuarios, grupos) y contexto
 * del código (plugins, servicios, rutas del panel, dependencias) y llama a
 * `claude --print` como subproceso autenticado (cuenta premium, sin API key).
 *
 * Fallback: si el CLI no está disponible, renderiza solo la tabla de datos.
 */

import os from 'os'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { escapeHtml } from './renderer.js'

const ROOT = process.cwd()

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Recolección de runtime ────────────────────────────────────────────────────

async function collectRuntimeSnapshot() {
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
      loadAvg:    Math.round(os.loadavg()[0] * 100) / 100,
      platform:   os.platform(),
    },
    plugins: { total: 0, categories: {}, list: [] },
    users:   { total: 0, byRole: {} },
    groups:  0,
  }

  try {
    if (global.conn?.user) {
      snap.bot.connected = true
      snap.bot.phone = global.conn.user.id?.split(':')[0] || null
    }
  } catch {}

  try {
    const files = safeReadDir(path.join(ROOT, 'plugins'))
      .filter(f => f.endsWith('.js') && !f.startsWith('_') && !f.includes('.bak') && !f.includes('.backup'))
    snap.plugins.total = files.length
    snap.plugins.list  = files.map(f => f.replace('.js', ''))
    for (const f of snap.plugins.list) {
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

// ── Recolección de contexto de código ────────────────────────────────────────

function collectCodeContext() {
  const ctx = {
    version: '1.8.2',
    services: [],
    routes: [],
    emailTemplates: [],
    frontendPages: [],
    pluginDetails: {},
  }

  // Services directory
  ctx.services = safeReadDir(path.join(ROOT, 'services'))
    .filter(f => f.endsWith('.js'))
    .map(f => f.replace('.js', ''))

  // Routes
  ctx.routes = safeReadDir(path.join(ROOT, 'services', 'routes'))
    .filter(f => f.endsWith('.js'))
    .map(f => f.replace('.js', ''))

  // Email templates
  ctx.emailTemplates = safeReadDir(path.join(ROOT, 'services', 'email', 'templates'))
    .filter(f => f.endsWith('.js'))
    .map(f => f.replace('.js', ''))

  // Frontend pages (Next.js app dir)
  const appDir = path.join(ROOT, 'frontend-next', 'src', 'app')
  function listPages(dir, prefix = '') {
    const pages = []
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith('_') && entry.name !== 'api') {
          pages.push(prefix + entry.name)
          pages.push(...listPages(path.join(dir, entry.name), prefix + entry.name + '/'))
        }
      }
    } catch {}
    return pages
  }
  ctx.frontendPages = listPages(appDir)

  // Plugin descriptions by category (hardcoded from code knowledge)
  ctx.pluginDetails = {
    anime:     'Búsqueda de anime/manga, personajes, info de series, Pokédex, reactions, waifu',
    downloads: 'Descargador de TikTok, Spotify, YouTube, Twitter/X, Pinterest, Play Store, Mega, MediaFire, Instagram/Facebook',
    fun:       'Tiempo AFK, comandos de entretenimiento general',
    gacha:     'Sistema gacha: roll de waifus, harim, shop, trade, rankings, gift, delete, info de personajes',
    group:     'Gestión de grupos: bienvenida, tagall, admins, kick, promote, demote, warns, antilink, banchat, link, configuración',
    main:      'Menú principal, ping, info del bot, canal, status',
    nsfw:      'Contenido adulto (role-gated: solo usuarios premium)',
    owner:     'Gestión del bot: plugins, restart, update, prefix, config, savefiles, banned, exec, subbot-capacity',
    panel:     'Integración con el panel web: registro, control, notificaciones, stats, info',
    pedidos:   'Sistema de pedidos/solicitudes de usuarios',
    profile:   'Perfil, sistema de niveles, matrimonio, leaderboards, foto de perfil, badge premium',
    rpg:       'Economía y RPG completo: balance, coinflip, casino, roulette, slot, daily/weekly/monthly, work, crime, hunt, fish, mine, dungeon, adventure, heal, steal, givecoins, banco',
    sockets:   'Gestión de sub-bots: lista, editar, configurar, iconos, banners, owner, prefix, nombre',
    tools:     'Herramientas: stickers, traducción, búsqueda Google, letra de canciones, screenshot web, IP info, NPM info, syntax check, TenorGIF, HD, reconocimiento de música, uploader',
  }

  return ctx
}

// ── Llamada a Claude Code CLI ─────────────────────────────────────────────────

const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude'

function callClaudeCli(prompt, timeoutMs = 45000) {
  return new Promise((resolve) => {
    let proc
    try {
      proc = spawn(CLAUDE_BIN, ['--print'], {
        env: { ...process.env, NO_COLOR: '1', TERM: 'dumb' },
        timeout: timeoutMs,
      })
    } catch {
      return resolve(null)
    }

    let stdout = ''
    let stderr = ''
    let settled = false

    const done = (val) => {
      if (settled) return
      settled = true
      resolve(val)
    }

    const timer = setTimeout(() => done(null), timeoutMs)

    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('close', code => {
      clearTimeout(timer)
      const text = stdout.trim()
      done(code === 0 && text ? text : null)
    })

    proc.on('error', () => {
      clearTimeout(timer)
      done(null)
    })

    try {
      proc.stdin.write(prompt, 'utf8')
      proc.stdin.end()
    } catch {
      clearTimeout(timer)
      done(null)
    }
  })
}

// ── Construcción del prompt ───────────────────────────────────────────────────

function buildPrompt(snap, ctx, context) {
  const botState = snap.bot.connected
    ? `CONECTADO${snap.bot.phone ? ` (+${snap.bot.phone})` : ''}, uptime ${formatUptime(snap.bot.uptimeSeconds)}`
    : `DESCONECTADO (proceso activo ${formatUptime(snap.bot.uptimeSeconds)})`

  const pluginCats = Object.entries(snap.plugins.categories)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `  - ${k} (${v} comandos): ${ctx.pluginDetails[k] || ''}`)
    .join('\n')

  const roleBreak = Object.entries(snap.users.byRole)
    .map(([r, n]) => `${r}: ${n}`).join(', ') || 'sin datos'

  const emailTpls = ctx.emailTemplates.slice(0, 20).join(', ')
  const frontendPagesStr = ctx.frontendPages.filter(p => !p.includes('/')).join(', ')
  const routesStr = ctx.routes.join(', ')

  const contextLabel = context === 'completed'
    ? 'MANTENIMIENTO COMPLETADO — el sistema ya está operativo y restaurado'
    : 'INICIO DE MANTENIMIENTO — el sistema va a entrar en mantenimiento programado'

  return `Sos el asistente de soporte técnico de OguriCap-Bot. Tu tarea es escribir el párrafo de diagnóstico del sistema para un email de mantenimiento enviado a los usuarios.

=== CONTEXTO DEL EMAIL ===
${contextLabel}

=== PROYECTO: OguriCap-Bot v${ctx.version} ===
Bot de WhatsApp Multi-Device (librería Baileys) con panel de administración Next.js.
Infraestructura: Docker Compose — 4 contenedores: PostgreSQL, postgres-backup, whatsapp-bot (puerto 3001), admin-panel (puerto 3000).

BACKEND (services/):
- Servidor HTTP principal (api.js) + WebSocket (socket-io.js)
- Rutas: ${routesStr}
- Sistema de emails: ${emailTpls}
- Otros: metrics-system, task-scheduler, backup-system, security-monitor, intelligent-alerts, resource-monitor, reporting-system

FRONTEND (Next.js):
- Páginas del dashboard: ${frontendPagesStr}
- Funcionalidades: gestión de bot (QR, conexión), usuarios/roles, plugins, grupos WhatsApp, sub-bots (JadiBot), configuración del sistema, preview de emails, logs de actividad, sistema de aportes, alertas de seguridad

PLUGINS DE WHATSAPP (${snap.plugins.total} comandos totales):
${pluginCats}

=== MÉTRICAS EN TIEMPO REAL ===
Bot WhatsApp: ${botState}
Node.js: ${snap.system.nodeVersion} · ${snap.system.platform}
Memoria RAM: ${snap.system.memUsedPct}% en uso · ${snap.system.memFreeMB} MB libres de ${snap.system.memTotalMB} MB
CPU: ${snap.system.cpuCount} núcleos · carga promedio 1m: ${snap.system.loadAvg}
Usuarios registrados: ${snap.users.total} (${roleBreak})
Grupos de WhatsApp activos: ${snap.groups}

=== INSTRUCCIONES DE ESCRITURA ===
Escribí DOS párrafos cortos en español rioplatense, tono profesional y tranquilizador:
1. Primer párrafo: estado general del sistema con las métricas más relevantes. Si el mantenimiento está completado, destacá que todo está operativo.
2. Segundo párrafo: descripción breve de qué es el proyecto (bot + panel + plugins + funcionalidades clave). Mencioná algo interesante del ecosistema.

IMPORTANTE: Solo texto plano corrido. Sin markdown, sin asteriscos, sin listas, sin títulos. Máximo 6 oraciones en total.`
}

// ── Render HTML ───────────────────────────────────────────────────────────────

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
    { label: 'Bot WhatsApp',    value: botHtml },
    { label: 'Memoria RAM',     value: `${snap.system.memUsedPct}% en uso · ${snap.system.memFreeMB} MB libres / ${snap.system.memTotalMB} MB` },
    { label: 'CPU / Carga 1m',  value: `${snap.system.cpuCount} núcleos · ${snap.system.loadAvg}` },
    { label: 'Plugins activos', value: `${snap.plugins.total} comandos` },
    { label: 'Usuarios',        value: `${snap.users.total} registrados (${roleLines})` },
    { label: 'Grupos WA',       value: `${snap.groups} activos` },
    { label: 'Runtime',         value: `Node.js ${snap.system.nodeVersion} · ${snap.system.platform}` },
  ]

  const rowsHtml = rows.map((r, i) => {
    const border = i < rows.length - 1 ? '1px solid #f3f4f6' : 'none'
    return `<tr>
      <td style="padding:7px 0;border-bottom:${border};font-size:12px;color:#9ca3af;width:36%;vertical-align:top;padding-right:12px;">${r.label}</td>
      <td style="padding:7px 0;border-bottom:${border};font-size:13px;color:#374151;">${r.value}</td>
    </tr>`
  }).join('')

  return `
    <div style="margin:20px 0 0;">
      <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">Estado del sistema</p>
      <div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:14px 16px;">
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

// ── Export principal ──────────────────────────────────────────────────────────

/**
 * Genera el bloque HTML del reporte del sistema para incluir en emails de mantenimiento.
 * @param {'notice'|'completed'} context
 * @returns {Promise<string>}
 */
export async function generateSystemReportHtml(context = 'notice') {
  let snap, ctx
  try {
    ;[snap, ctx] = await Promise.all([collectRuntimeSnapshot(), collectCodeContext()])
  } catch {
    return ''
  }

  const dataTable = renderDataTable(snap)

  let narrativeHtml = ''
  try {
    const prompt = buildPrompt(snap, ctx, context)
    const text   = await callClaudeCli(prompt)

    if (text) {
      // Split into paragraphs if Claude returned two
      const paras = text.split(/\n{2,}/).filter(p => p.trim())
      const parasHtml = paras
        .map(p => `<p style="margin:0 0 10px;font-size:14px;color:#374151;line-height:1.75;">${escapeHtml(p.trim())}</p>`)
        .join('')

      narrativeHtml = `
        <div style="margin:24px 0 0;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;">
          <p style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#9ca3af;font-weight:700;">Diagnóstico del sistema</p>
          ${parasHtml}
          <p style="margin:6px 0 0;font-size:11px;color:#cbd5e1;text-align:right;">Generado por Claude AI</p>
        </div>`
    }
  } catch {}

  return `<div style="margin:24px 0;">${narrativeHtml}${dataTable}</div>`
}
