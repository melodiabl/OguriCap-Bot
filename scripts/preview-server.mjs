import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getEmailTemplatePreview } from '../api/email/preview.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PORT = 61940

// ─── Email templates ──────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: 'test',                   label: 'Prueba',                emoji: '🧪' },
  { id: 'welcome',                label: 'Bienvenida',            emoji: '🎉' },
  { id: 'registration',           label: 'Registro',              emoji: '📝' },
  { id: 'password-reset',         label: 'Reset contraseña',      emoji: '🔑' },
  { id: 'notification',           label: 'Notificación',          emoji: '🔔' },
  { id: 'security-alert',         label: 'Alerta seguridad',      emoji: '🚨' },
  { id: 'role-changed',           label: 'Cambio de rol',         emoji: '👤' },
  { id: 'bot-alert-disconnected', label: 'Bot offline',           emoji: '🔴' },
  { id: 'bot-alert-reconnected',  label: 'Bot reconectado',       emoji: '🟢' },
  { id: 'subbot-alert',           label: 'Subbot offline',        emoji: '🤖' },
  { id: 'aporte-received',        label: 'Aporte recibido',       emoji: '💚' },
  { id: 'aporte-aceptado',        label: 'Aporte aceptado',       emoji: '✅' },
  { id: 'aporte-rechazado',       label: 'Aporte rechazado',      emoji: '❌' },
  { id: 'aporte-pendiente',       label: 'Aporte pendiente',      emoji: '⏳' },
  { id: 'login-new-device',       label: 'Acceso nuevo',          emoji: '🔐' },
  { id: 'account-deleted',        label: 'Cuenta eliminada',      emoji: '🗑️' },
  { id: 'maintenance-notice',    label: 'Mantenimiento',         emoji: '🛠️' },
  { id: 'account-suspended',     label: 'Cuenta suspendida',     emoji: '🔒' },
  { id: 'account-reactivated',   label: 'Cuenta reactivada',     emoji: '✅' },
  { id: 'subbot-created',        label: 'Sub-bot creado',        emoji: '🤖' },
  { id: 'subbot-deleted',        label: 'Sub-bot eliminado',     emoji: '🗑️' },
  { id: 'two-factor-code',       label: 'Código 2FA',            emoji: '🔑' },
  { id: 'system-alert',          label: 'Alerta del sistema',    emoji: '⚠️' },
]

// ─── Shared CSS ───────────────────────────────────────────────────────────────
const BASE_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #060807; font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #f2f6f3; }
  ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a130e; }
  ::-webkit-scrollbar-thumb { background: rgba(37,211,102,0.3); border-radius: 3px; }
  .green { color: #25d366; } .teal { color: #2dd4bf; } .pink { color: #ff4d8d; } .muted { color: #84968e; }
  .pill { display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(37,211,102,0.2);border-radius:50px;padding:6px 16px;background:rgba(37,211,102,0.05); }
`

// ─── Mockup: Opción A — Drawer lateral ───────────────────────────────────────
function drawerMockup() {
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Opción A — Drawer Perfil</title>
<style>
${BASE_CSS}
body { overflow: hidden; }
.shell { display: flex; height: 100vh; position: relative; }

/* Sidebar */
.sidebar { width: 64px; background: #0a130e; border-right: 1px solid rgba(37,211,102,0.08); display: flex; flex-direction: column; align-items: center; padding: 16px 0; gap: 8px; flex-shrink: 0; }
.sidebar-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #3d6050; font-size: 18px; cursor: pointer; transition: all 0.15s; }
.sidebar-icon:hover, .sidebar-icon.active { background: rgba(37,211,102,0.1); color: #25d366; }
.sidebar-icon.active { border: 1px solid rgba(37,211,102,0.25); }
.sidebar-sep { height: 1px; background: rgba(255,255,255,0.06); width: 36px; margin: 4px 0; }
.sidebar-bottom { margin-top: auto; display: flex; flex-direction: column; align-items: center; gap: 8px; padding-bottom: 8px; }

/* Main area */
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 56px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0; }
.header-title { font-size: 13px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #3d6050; }
.header-right { display: flex; align-items: center; gap: 8px; }
.hbtn { width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; color: #84968e; font-size: 16px; cursor: pointer; }
.hbtn.notif { border-color: rgba(37,211,102,0.2); background: rgba(37,211,102,0.07); color: #25d366; position: relative; }
.hbtn.notif::after { content: '3'; position: absolute; top: -4px; right: -4px; background: #ff4d8d; color: #060807; font-size: 9px; font-weight: 900; width: 16px; height: 16px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.avatar-btn { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #25d366, #2dd4bf); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; color: #060807; cursor: pointer; border: 2px solid rgba(37,211,102,0.4); box-shadow: 0 0 12px rgba(37,211,102,0.3); }
.content { flex: 1; padding: 24px; overflow-y: auto; }
.page-title { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; margin: 0 0 20px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.card { background: linear-gradient(160deg, #0f1a14, #0c1410); border: 1px solid rgba(37,211,102,0.12); border-radius: 16px; padding: 16px; }
.card-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #84968e; margin-bottom: 8px; }
.card-val { font-size: 24px; font-weight: 900; color: #25d366; }
.card-sub { font-size: 11px; color: #3d6050; margin-top: 2px; }

/* Scrim */
.scrim { position: absolute; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(2px); z-index: 40; }

/* Drawer */
.drawer { position: absolute; top: 0; right: 0; width: 380px; height: 100%; background: linear-gradient(160deg, #0f1a14 0%, #0a130e 100%); border-left: 1px solid rgba(37,211,102,0.18); box-shadow: -8px 0 40px rgba(0,0,0,0.6), 0 0 60px rgba(37,211,102,0.05); z-index: 50; display: flex; flex-direction: column; overflow: hidden; }
.drawer-bar { height: 3px; background: linear-gradient(90deg, #25d366, #2dd4bf, #ff4d8d); flex-shrink: 0; }
.drawer-header { padding: 20px 20px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }
.drawer-close { float: right; width: 28px; height: 28px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: #84968e; font-size: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
.drawer-user { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
.avatar-lg { width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #25d366, #2dd4bf); display: flex; align-items: center; justify-content: justify-content; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; color: #060807; border: 2px solid rgba(37,211,102,0.4); box-shadow: 0 0 20px rgba(37,211,102,0.25); flex-shrink: 0; }
.user-name { font-size: 16px; font-weight: 800; }
.user-role { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #25d366; }
.drawer-body { flex: 1; overflow-y: auto; padding: 16px; }
.section-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #3d6050; margin: 16px 0 8px; }
.section-label:first-child { margin-top: 0; }

.device-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(37,211,102,0.04); border: 1px solid rgba(37,211,102,0.1); border-radius: 10px; margin-bottom: 6px; }
.device-icon { font-size: 18px; }
.device-info { flex: 1; min-width: 0; }
.device-name { font-size: 12px; font-weight: 700; color: #f2f6f3; }
.device-meta { font-size: 10px; color: #3d6050; margin-top: 1px; }
.device-badge { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background: rgba(37,211,102,0.12); color: #25d366; border: 1px solid rgba(37,211,102,0.25); border-radius: 50px; padding: 2px 8px; }
.device-badge.other { background: rgba(132,150,142,0.08); color: #84968e; border-color: rgba(132,150,142,0.2); }

.toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; background: rgba(255,255,255,0.02); border-radius: 8px; margin-bottom: 4px; }
.toggle-label { font-size: 12px; color: #b2c5ba; }
.toggle { width: 34px; height: 20px; background: rgba(37,211,102,0.8); border-radius: 50px; position: relative; flex-shrink: 0; }
.toggle::after { content:''; position:absolute; top:3px; right:3px; width:14px; height:14px; border-radius:50%; background: #060807; }
.toggle.off { background: rgba(132,150,142,0.25); }
.toggle.off::after { right:auto; left:3px; }

.drawer-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; }
.logout-btn { width: 100%; padding: 10px; border-radius: 10px; background: rgba(255,77,141,0.08); border: 1px solid rgba(255,77,141,0.2); color: #ff4d8d; font-size: 12px; font-weight: 700; cursor: pointer; }

.badge-new { display:inline-block;background:rgba(37,211,102,0.15);color:#25d366;border:1px solid rgba(37,211,102,0.3);font-size:9px;font-weight:900;padding:2px 8px;border-radius:50px;letter-spacing:1px;margin-left:6px;vertical-align:middle; }
</style>
</head><body>
<div style="background:#0a130e;padding:8px 16px;border-bottom:1px solid rgba(37,211,102,0.12);display:flex;align-items:center;justify-content:space-between;">
  <div style="display:flex;align-items:center;gap:10px;">
    <span style="font-size:16px;color:#25d366;">✦</span>
    <span style="font-size:12px;font-weight:900;letter-spacing:2px;color:#f2f6f3;">OPCIÓN A</span>
    <span style="font-size:12px;color:#84968e;">— Drawer lateral (se desliza desde la derecha)</span>
  </div>
  <a href="/mockup/page" style="font-size:11px;color:#2dd4bf;text-decoration:none;font-weight:700;">Ver Opción B →</a>
</div>

<div class="shell">
  <!-- Sidebar -->
  <div class="sidebar">
    <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
      <span style="color:#25d366;font-size:20px;">✦</span>
    </div>
    <div class="sidebar-sep"></div>
    <div class="sidebar-icon active">🏠</div>
    <div class="sidebar-icon">🤖</div>
    <div class="sidebar-icon">📱</div>
    <div class="sidebar-icon">👥</div>
    <div class="sidebar-icon">💰</div>
    <div class="sidebar-icon">📊</div>
    <div class="sidebar-sep"></div>
    <div class="sidebar-icon">⚙️</div>
    <div class="sidebar-bottom">
      <div class="sidebar-icon">🔔</div>
    </div>
  </div>

  <!-- Main content (dimmed) -->
  <div class="main">
    <div class="header">
      <span class="header-title">Dashboard</span>
      <div class="header-right">
        <div class="hbtn notif">🔔</div>
        <div style="width:1px;height:24px;background:rgba(255,255,255,0.06);"></div>
        <div class="avatar-btn" title="← Hacé clic aquí">OG</div>
      </div>
    </div>
    <div class="content" style="filter:brightness(0.4);">
      <div class="page-title">Dashboard <span style="color:#25d366;">OguriCap</span></div>
      <div class="grid">
        <div class="card"><div class="card-title">Bot Status</div><div class="card-val">✦ ON</div><div class="card-sub">Conectado · 4h 22m</div></div>
        <div class="card"><div class="card-title">Subbots</div><div class="card-val">3/4</div><div class="card-sub">1 offline</div></div>
        <div class="card"><div class="card-title">Usuarios</div><div class="card-val">128</div><div class="card-sub">+3 hoy</div></div>
      </div>
    </div>
  </div>

  <!-- Scrim -->
  <div class="scrim"></div>

  <!-- Drawer -->
  <div class="drawer">
    <div class="drawer-bar"></div>
    <div class="drawer-header">
      <div class="drawer-close">✕</div>
      <div class="drawer-user">
        <div class="avatar-lg">OG</div>
        <div>
          <div class="user-name">OguriAdmin</div>
          <div class="user-role">👑 Owner</div>
          <div style="font-size:10px;color:#3d6050;margin-top:2px;">oguri@ejemplo.com</div>
        </div>
      </div>
    </div>
    <div class="drawer-body">

      <div class="section-label">📱 Mis dispositivos</div>

      <div class="device-item">
        <div class="device-icon">💻</div>
        <div class="device-info">
          <div class="device-name">Chrome 124 · Windows 11</div>
          <div class="device-meta">190.210.45.123 · Buenos Aires · Ahora</div>
        </div>
        <div class="device-badge">Este</div>
      </div>
      <div class="device-item">
        <div class="device-icon">📱</div>
        <div class="device-info">
          <div class="device-name">Safari · iPhone 15</div>
          <div class="device-meta">190.210.45.100 · Buenos Aires · Hace 2d</div>
        </div>
        <div class="device-badge other">Confiable</div>
      </div>
      <div class="device-item">
        <div class="device-icon">💻</div>
        <div class="device-info">
          <div class="device-name">Firefox · macOS</div>
          <div class="device-meta">181.23.44.10 · Córdoba · Hace 7d</div>
        </div>
        <div class="device-badge other">Confiable</div>
      </div>

      <div class="section-label">🔔 Notificaciones por email <span class="badge-new">NUEVO</span></div>

      <div class="toggle-row"><span class="toggle-label">Acceso nuevo dispositivo</span><div class="toggle"></div></div>
      <div class="toggle-row"><span class="toggle-label">Bot offline / reconectado</span><div class="toggle"></div></div>
      <div class="toggle-row"><span class="toggle-label">Subbot offline</span><div class="toggle off"></div></div>
      <div class="toggle-row"><span class="toggle-label">Aporte recibido</span><div class="toggle"></div></div>
      <div class="toggle-row"><span class="toggle-label">Cambio de rol</span><div class="toggle off"></div></div>

      <div class="section-label">👤 Mi cuenta</div>

      <div class="toggle-row"><span class="toggle-label">Cambiar contraseña</span><span style="font-size:12px;color:#3d6050;">→</span></div>
      <div class="toggle-row"><span class="toggle-label">Email de contacto</span><span style="font-size:11px;color:#84968e;">oguri@ej.com</span></div>

    </div>
    <div class="drawer-footer">
      <button class="logout-btn">Cerrar sesión</button>
    </div>
  </div>
</div>
</body></html>`
}

// ─── Mockup: Opción B — Página /perfil ────────────────────────────────────────
function profilePageMockup() {
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Opción B — Página Perfil</title>
<style>
${BASE_CSS}
body { overflow: hidden; }
.shell { display: flex; height: 100vh; }

.sidebar { width: 64px; background: #0a130e; border-right: 1px solid rgba(37,211,102,0.08); display: flex; flex-direction: column; align-items: center; padding: 16px 0; gap: 8px; flex-shrink: 0; }
.sidebar-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #3d6050; font-size: 18px; }
.sidebar-icon.active { background: rgba(37,211,102,0.1); color: #25d366; border: 1px solid rgba(37,211,102,0.25); }
.sidebar-sep { height: 1px; background: rgba(255,255,255,0.06); width: 36px; margin: 4px 0; }
.sidebar-bottom { margin-top: auto; }

.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.header { height: 56px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0; }
.avatar-btn { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #25d366, #2dd4bf); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; color: #060807; border: 2px solid rgba(37,211,102,0.4); }
.hbtn { width: 36px; height: 36px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; color: #84968e; font-size: 16px; }
.hbtn.notif { border-color: rgba(37,211,102,0.2); background: rgba(37,211,102,0.07); color: #25d366; }

.page-content { flex: 1; overflow-y: auto; padding: 28px; }

/* Hero */
.hero { display: flex; align-items: center; gap: 20px; margin-bottom: 28px; }
.avatar-hero { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, #25d366, #2dd4bf); display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; color: #060807; border: 3px solid rgba(37,211,102,0.5); box-shadow: 0 0 32px rgba(37,211,102,0.2); flex-shrink: 0; }
.hero-info h1 { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; margin: 0 0 4px; }
.hero-role { display: inline-flex; align-items: center; gap: 6px; background: rgba(37,211,102,0.08); border: 1px solid rgba(37,211,102,0.2); border-radius: 50px; padding: 4px 12px; font-size: 11px; font-weight: 800; color: #25d366; text-transform: uppercase; letter-spacing: 1px; }
.hero-email { font-size: 12px; color: #3d6050; margin-top: 6px; }

/* Tabs */
.tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0; }
.tab { padding: 8px 16px; font-size: 12px; font-weight: 700; color: #84968e; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tab.active { color: #25d366; border-bottom-color: #25d366; }

/* Content grid */
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.panel { background: linear-gradient(160deg, #0f1a14, #0c1410); border: 1px solid rgba(37,211,102,0.12); border-radius: 16px; padding: 18px; }
.panel-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #84968e; margin-bottom: 14px; display: flex; align-items: center; gap: 8px; }

.device-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(37,211,102,0.04); border: 1px solid rgba(37,211,102,0.1); border-radius: 10px; margin-bottom: 6px; }
.device-icon { font-size: 20px; }
.device-info { flex: 1; min-width: 0; }
.device-name { font-size: 12px; font-weight: 700; }
.device-meta { font-size: 10px; color: #3d6050; margin-top: 1px; }
.badge { font-size: 9px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; border-radius: 50px; padding: 2px 8px; }
.badge-green { background: rgba(37,211,102,0.12); color: #25d366; border: 1px solid rgba(37,211,102,0.25); }
.badge-gray { background: rgba(132,150,142,0.08); color: #84968e; border: 1px solid rgba(132,150,142,0.2); }

.toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.toggle-row:last-child { border-bottom: none; }
.toggle-label { font-size: 12px; color: #b2c5ba; }
.toggle { width: 34px; height: 20px; background: rgba(37,211,102,0.8); border-radius: 50px; position: relative; flex-shrink: 0; }
.toggle::after { content:''; position:absolute; top:3px; right:3px; width:14px; height:14px; border-radius:50%; background: #060807; }
.toggle.off { background: rgba(132,150,142,0.25); }
.toggle.off::after { right:auto; left:3px; }

.badge-new { display:inline-block;background:rgba(37,211,102,0.15);color:#25d366;border:1px solid rgba(37,211,102,0.3);font-size:9px;font-weight:900;padding:2px 8px;border-radius:50px;letter-spacing:1px; }
</style>
</head><body>
<div style="background:#0a130e;padding:8px 16px;border-bottom:1px solid rgba(37,211,102,0.12);display:flex;align-items:center;justify-content:space-between;">
  <div style="display:flex;align-items:center;gap:10px;">
    <span style="font-size:16px;color:#25d366;">✦</span>
    <span style="font-size:12px;font-weight:900;letter-spacing:2px;color:#f2f6f3;">OPCIÓN B</span>
    <span style="font-size:12px;color:#84968e;">— Página dedicada /perfil (navegación completa)</span>
  </div>
  <a href="/mockup/drawer" style="font-size:11px;color:#2dd4bf;text-decoration:none;font-weight:700;">← Ver Opción A</a>
</div>

<div class="shell">
  <div class="sidebar">
    <div style="display:flex;align-items:center;justify-content:center;width:40px;height:40px;"><span style="color:#25d366;font-size:20px;">✦</span></div>
    <div class="sidebar-sep"></div>
    <div class="sidebar-icon">🏠</div>
    <div class="sidebar-icon">🤖</div>
    <div class="sidebar-icon">📱</div>
    <div class="sidebar-icon">👥</div>
    <div class="sidebar-icon active">👤</div>
    <div class="sidebar-sep"></div>
    <div class="sidebar-icon">⚙️</div>
    <div class="sidebar-bottom"><div class="sidebar-icon">🔔</div></div>
  </div>

  <div class="main">
    <div class="header">
      <span style="font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#3d6050;">Mi Perfil</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="hbtn notif">🔔</div>
        <div style="width:1px;height:24px;background:rgba(255,255,255,0.06);"></div>
        <div class="avatar-btn">OG</div>
      </div>
    </div>

    <div class="page-content">
      <!-- Hero -->
      <div class="hero">
        <div class="avatar-hero">OG</div>
        <div class="hero-info">
          <h1>OguriAdmin <span class="badge-new">Owner</span></h1>
          <div style="margin-top:6px;display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:#3d6050;">oguri@ejemplo.com</span>
            <span style="font-size:10px;color:#3d6050;">·</span>
            <span style="font-size:11px;color:#25d366;">Activo desde mayo 2024</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs">
        <div class="tab active">📱 Dispositivos</div>
        <div class="tab">🔔 Notificaciones</div>
        <div class="tab">🔒 Seguridad</div>
      </div>

      <!-- Content -->
      <div class="two-col">
        <div class="panel">
          <div class="panel-title">📱 Dispositivos vinculados</div>
          <div class="device-item">
            <div class="device-icon">💻</div>
            <div class="device-info">
              <div class="device-name">Chrome 124 · Windows 11</div>
              <div class="device-meta">190.210.45.123 · Buenos Aires · Ahora mismo</div>
            </div>
            <span class="badge badge-green">Este</span>
          </div>
          <div class="device-item">
            <div class="device-icon">📱</div>
            <div class="device-info">
              <div class="device-name">Safari · iPhone 15</div>
              <div class="device-meta">190.210.45.100 · Buenos Aires · Hace 2d</div>
            </div>
            <span class="badge badge-gray">Confiable</span>
          </div>
          <div class="device-item">
            <div class="device-icon">💻</div>
            <div class="device-info">
              <div class="device-name">Firefox · macOS 14</div>
              <div class="device-meta">181.23.44.10 · Córdoba · Hace 7d</div>
            </div>
            <span class="badge badge-gray">Confiable</span>
          </div>
          <div style="margin-top:10px;padding:8px;background:rgba(255,77,141,0.04);border:1px solid rgba(255,77,141,0.12);border-radius:8px;font-size:11px;color:#84968e;text-align:center;cursor:pointer;">
            Cerrar todas las demás sesiones
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">🔔 Alertas por email <span class="badge-new" style="font-size:9px;">NUEVO</span></div>
          <div class="toggle-row"><span class="toggle-label">Acceso nuevo dispositivo</span><div class="toggle"></div></div>
          <div class="toggle-row"><span class="toggle-label">Bot offline / reconectado</span><div class="toggle"></div></div>
          <div class="toggle-row"><span class="toggle-label">Subbot offline</span><div class="toggle off"></div></div>
          <div class="toggle-row"><span class="toggle-label">Aporte recibido</span><div class="toggle"></div></div>
          <div class="toggle-row"><span class="toggle-label">Aporte aceptado/rechazado</span><div class="toggle"></div></div>
          <div class="toggle-row"><span class="toggle-label">Cambio de mi rol</span><div class="toggle off"></div></div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`
}

// ─── Home de mockups ──────────────────────────────────────────────────────────
function mockupHome() {
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design Mockups — OguriCap</title>
<style>
${BASE_CSS}
body { padding: 32px 24px; }
.bar { height: 3px; background: linear-gradient(90deg,#25d366,#2dd4bf,#ff4d8d); border-radius: 2px; margin-bottom: 32px; }
h1 { margin: 0 0 8px; font-size: 22px; font-weight: 900; }
.sub { color: #84968e; font-size: 13px; margin-bottom: 28px; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 720px; }
.card { background: #0f1a14; border: 1px solid rgba(37,211,102,0.15); border-radius: 16px; padding: 24px; text-decoration: none; color: inherit; display: block; transition: border-color 0.15s, box-shadow 0.15s; }
.card:hover { border-color: rgba(37,211,102,0.4); box-shadow: 0 0 24px rgba(37,211,102,0.08); }
.card-emoji { font-size: 32px; margin-bottom: 12px; }
.card-title { font-size: 15px; font-weight: 800; margin-bottom: 6px; }
.card-desc { font-size: 12px; color: #84968e; line-height: 1.6; }
.pill-rec { display:inline-block;background:rgba(37,211,102,0.12);color:#25d366;border:1px solid rgba(37,211,102,0.3);font-size:10px;font-weight:900;padding:2px 10px;border-radius:50px;margin-top:8px;letter-spacing:0.5px; }
</style>
</head><body>
<div class="pill" style="margin-bottom:24px;">
  <span style="color:#25d366;font-size:16px;">✦</span>
  <span style="font-size:12px;font-weight:900;letter-spacing:2px;">OGURICAP BOT</span>
  <span style="color:#84968e;font-size:11px;">— Design Studio</span>
</div>
<div class="bar"></div>
<h1>Mockups de diseño</h1>
<p class="sub">Hacé clic para ver el mockup en pantalla completa</p>
<div class="grid">
  <a href="/mockup/drawer" class="card">
    <div class="card-emoji">🗂️</div>
    <div class="card-title">Opción A — Drawer lateral</div>
    <div class="card-desc">El perfil se abre como un panel que se desliza desde la derecha. No te saca de la página actual. Más rápido, ideal para mobile.</div>
    <div class="pill-rec">★ Recomendado</div>
  </a>
  <a href="/mockup/page" class="card">
    <div class="card-emoji">📄</div>
    <div class="card-title">Opción B — Página /perfil</div>
    <div class="card-desc">Navega a una página completa de perfil con tabs: Dispositivos · Notificaciones · Seguridad. Más espacio para mostrar info.</div>
  </a>
  <a href="/mockup/email-compare" class="card">
    <div class="card-emoji">✉️</div>
    <div class="card-title">Email — Comparación de estilos</div>
    <div class="card-desc">A vs B: franja de acento vs header temático. 4 tipos: success · danger · warning · info.</div>
    <div class="pill-rec">Diseño nuevo</div>
  </a>
</div>
<div style="margin-top:32px;border-top:1px solid rgba(255,255,255,0.06);padding-top:24px;">
  <a href="/" style="color:#84968e;font-size:12px;text-decoration:none;">← Volver a Email Previews</a>
</div>
</body></html>`
}

// ─── Index de emails ──────────────────────────────────────────────────────────
function indexPage() {
  const cards = TEMPLATES.map(t => `
    <a href="/preview?t=${t.id}" class="card">
      <span class="emoji">${t.emoji}</span>
      <span class="label">${t.label}</span>
      <span class="id">${t.id}</span>
    </a>`).join('')
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OguriCap — Previews</title>
<style>${BASE_CSS}
body{padding:32px 24px;}
.bar{height:3px;background:linear-gradient(90deg,#25d366,#2dd4bf,#ff4d8d);border-radius:2px;margin-bottom:28px;}
h1{margin:0 0 4px;font-size:22px;font-weight:900;} .sub{color:#84968e;font-size:13px;margin-bottom:28px;}
.nav{display:flex;gap:12px;margin-bottom:28px;}
.nav a{font-size:12px;font-weight:700;color:#2dd4bf;text-decoration:none;padding:6px 14px;border:1px solid rgba(45,212,191,0.2);border-radius:8px;background:rgba(45,212,191,0.05);}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;}
.card{display:flex;flex-direction:column;gap:4px;padding:14px 16px;background:#0f1a14;border:1px solid rgba(37,211,102,0.12);border-radius:12px;text-decoration:none;color:inherit;transition:border-color 0.15s;}
.card:hover{border-color:rgba(37,211,102,0.4);}
.emoji{font-size:24px;margin-bottom:2px;}.label{font-size:13px;font-weight:700;}.id{font-size:10px;color:#3d6050;font-family:monospace;}
</style></head><body>
<div class="pill" style="margin-bottom:20px;"><span style="color:#25d366;font-size:16px;">✦</span><span style="font-size:12px;font-weight:900;letter-spacing:2px;">OGURICAP BOT</span></div>
<div class="bar"></div>
<h1>Previews</h1>
<div class="nav">
  <a href="/mockup">🎨 Mockups de UI</a>
</div>
<p class="sub">${TEMPLATES.length} templates de email · clic para previsualizar</p>
<div class="grid">${cards}</div>
</body></html>`
}

function previewPage(templateId, subject, html) {
  const navLinks = TEMPLATES.map(t =>
    `<a href="/preview?t=${t.id}" style="display:block;padding:7px 12px;color:${t.id===templateId?'#25d366':'#84968e'};font-size:11px;text-decoration:none;border-left:2px solid ${t.id===templateId?'#25d366':'transparent'};background:${t.id===templateId?'rgba(37,211,102,0.07)':'transparent'};transition:color 0.1s;">${t.emoji} ${t.label}</a>`
  ).join('')
  return `<!doctype html><html lang="es"><head><meta charset="UTF-8"><title>${subject}</title>
<style>${BASE_CSS}body{display:flex;min-height:100vh;}
nav{width:220px;flex-shrink:0;background:#0a130e;border-right:1px solid rgba(37,211,102,0.1);padding:16px 0;overflow-y:auto;position:sticky;top:0;height:100vh;}
nav .brand{padding:0 12px 12px;border-bottom:1px solid rgba(37,211,102,0.08);margin-bottom:8px;}
nav .brand a{color:#25d366;font-weight:900;font-size:12px;text-decoration:none;letter-spacing:1px;}
main{flex:1;padding:28px 20px;overflow-y:auto;}
.subj{font-size:11px;color:#84968e;margin-bottom:14px;}
.subj strong{color:#b2c5ba;}
iframe{width:100%;border:1px solid rgba(37,211,102,0.1);border-radius:14px;background:#fff;min-height:700px;}
</style></head><body>
<nav>
  <div class="brand"><a href="/">← ✦ OGURICAP</a></div>
  ${navLinks}
</nav>
<main>
  <p class="subj">Subject: <strong>${subject}</strong></p>
  <iframe srcdoc="${html.replace(/"/g,'&quot;')}" frameborder="0" onload="this.style.height=(this.contentDocument.body.scrollHeight+40)+'px'"></iframe>
</main>
</body></html>`
}

// ─── Server ───────────────────────────────────────────────────────────────────
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname

  if (path === '/' || path === '') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(indexPage())
  }
  if (path === '/mockup' || path === '/mockup/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(mockupHome())
  }
  if (path === '/mockup/drawer') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(drawerMockup())
  }
  if (path === '/mockup/page') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(profilePageMockup())
  }
  if (path === '/mockup/email-compare') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(readFileSync(join(__dirname, 'email-compare.html'), 'utf-8'))
  }
  if (path === '/preview') {
    const t = url.searchParams.get('t') || 'test'
    try {
      const p = getEmailTemplatePreview(t)
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      return res.end(previewPage(t, p.subject, p.html))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      return res.end(`Error: ${e.message}`)
    }
  }
  res.writeHead(302, { Location: '/' })
  res.end()
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✦ Preview server → http://207.180.228.137:${PORT}`)
  console.log(`  Emails: http://207.180.228.137:${PORT}/`)
  console.log(`  Mockups: http://207.180.228.137:${PORT}/mockup`)
})
