# Email Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renovar el renderer de email con headers temáticos por tipo, mejorar 14 templates existentes, crear 7 nuevos, exponer un endpoint admin de envío y conectar UX en el panel.

**Architecture:** El renderer central (`lib/email/renderer.js`) recibe un nuevo parámetro `type` que inyecta un bloque header coloreado + badge + ícono antes del cuerpo. Los templates llaman `renderPanelEmail({ ..., type, icon })`. El API endpoint `POST /api/email/send` permite al admin disparar emails manualmente. Los flujos automáticos (subbot, usuarios, alertas) llaman directamente a las funciones `send*Email()`.

**Tech Stack:** Node.js ESM, `node:test`, `lib/email/renderer.js`, `lib/email/templates/*.js`, `api/routes/broadcast.js`, `api/routes/usuarios.js`, `api/routes/subbots.js`, `lib/alert-system.js`, Next.js App Router (frontend).

---

## Mapa de archivos

| Archivo | Acción |
|---------|--------|
| `lib/email/renderer.js` | Modificar — añadir `type`, `icon`, header temático, colores gold/lavender |
| `lib/email/templates/registration.js` | Modificar — type success, icon, data blocks |
| `lib/email/templates/welcome.js` | Modificar — type success, primeros pasos |
| `lib/email/templates/password-reset.js` | Modificar — type warning, tiempo prominente |
| `lib/email/templates/login-new-device.js` | Modificar — type danger, pasos de acción |
| `lib/email/templates/role-changed.js` | Modificar — type info, descripción de rol |
| `lib/email/templates/account-deleted.js` | Modificar — type danger, tono empático |
| `lib/email/templates/bot-alert.js` | Modificar — type dinámico por status |
| `lib/email/templates/subbot-alert.js` | Modificar — type dinámico |
| `lib/email/templates/aporte-received.js` | Modificar — type success, totalAccumulated |
| `lib/email/templates/aporte-aceptado.js` | Modificar — type success, creditDate |
| `lib/email/templates/aporte-rechazado.js` | Modificar — type danger, pasos siguientes |
| `lib/email/templates/aporte-pendiente.js` | Modificar — type warning, estimatedHours |
| `lib/email/templates/notification.js` | Modificar — type dinámico por priority |
| `lib/email/templates/security-alert.js` | Modificar — type danger, renderDataBlock |
| `lib/email/templates/maintenance-notice.js` | Crear |
| `lib/email/templates/account-suspended.js` | Crear |
| `lib/email/templates/account-reactivated.js` | Crear |
| `lib/email/templates/subbot-created.js` | Crear |
| `lib/email/templates/subbot-deleted.js` | Crear |
| `lib/email/templates/two-factor-code.js` | Crear |
| `lib/email/templates/system-alert.js` | Crear |
| `lib/email/index.js` | Modificar — añadir 7 exports nuevos |
| `lib/email/preview.js` | Modificar — añadir 7 casos nuevos en `buildEmailPreview` |
| `scripts/preview-server.mjs` | Modificar — añadir 7 entradas a TEMPLATES |
| `api/routes/broadcast.js` | Modificar — añadir `POST /api/email/send` |
| `api/routes/usuarios.js` | Modificar — email al suspender/reactivar |
| `api/routes/subbots.js` | Modificar — email al crear/eliminar subbot |
| `lib/alert-system.js` | Modificar — acción `email` en executeAction + regla memory |
| `frontend-next/src/app/(dashboard)/configuracion/page.tsx` | Modificar — 7 templates en preview list + btn maintenance email |
| `frontend-next/src/app/(dashboard)/usuarios/page.tsx` | Modificar — acciones suspender/reactivar con email |
| `test/email-renderer.test.mjs` | Modificar — tests para type/icon |
| `test/email-templates-new.test.mjs` | Modificar — añadir tests para 7 nuevos templates |

---

## Task 1: Renderer — header temático y tipos

**Files:**
- Modify: `lib/email/renderer.js`
- Test: `test/email-renderer.test.mjs`

- [ ] **Step 1: Escribir tests que fallen para el nuevo comportamiento**

Añadir al final del `describe('renderPanelEmail', ...)` existente en `test/email-renderer.test.mjs`:

```js
describe('renderPanelEmail — type/icon', () => {
  test('type=danger genera header con color rosa', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'danger' })
    assert.ok(h.includes('#ff4d8d'))
  })
  test('type=warning genera header con color dorado', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'warning' })
    assert.ok(h.includes('#fbbf24'))
  })
  test('type=info genera header con color teal', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', type: 'info' })
    assert.ok(h.includes('#2dd4bf'))
  })
  test('type=success (default) genera header verde', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '' })
    assert.ok(h.includes('#25d366'))
  })
  test('icon se renderiza en el header', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 'T', contentHtml: 'c', ctaUrl: '', ctaText: '', icon: '🚀' })
    assert.ok(h.includes('🚀'))
  })
})

describe('renderDataBlock — gold y lavender', () => {
  test('badgeColor=gold contiene #fbbf24', () => {
    const b = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'gold' })
    assert.ok(b.includes('#fbbf24'))
  })
  test('badgeColor=lavender contiene #818cf8', () => {
    const b = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'lavender' })
    assert.ok(b.includes('#818cf8'))
  })
})
```

- [ ] **Step 2: Correr tests — verificar que fallan**

```bash
node --test test/email-renderer.test.mjs 2>&1 | tail -20
```

Esperado: los nuevos tests fallan con errores de aserción (el HTML no tiene los colores nuevos).

- [ ] **Step 3: Implementar en `lib/email/renderer.js`**

Reemplazar la función `renderPanelEmail` completa con esta versión que soporta `type` e `icon`:

```js
const TYPE_PALETTE = {
  success: {
    primary: '#25d366',
    headerGradient: 'linear-gradient(135deg,rgba(37,211,102,0.18) 0%,rgba(45,212,191,0.08) 100%)',
    headerBorder: 'rgba(37,211,102,0.25)',
    iconBg: 'rgba(37,211,102,0.15)',
    iconBorder: 'rgba(37,211,102,0.3)',
    badgeBg: 'rgba(37,211,102,0.15)',
    badgeColor: '#25d366',
    badgeBorder: 'rgba(37,211,102,0.3)',
    badgeLabel: 'EXITOSO',
    titleColor: '#a7f3c7',
    ctaGradient: 'linear-gradient(135deg,#25d366 0%,#2dd4bf 100%)',
    ctaColor: '#060807',
  },
  danger: {
    primary: '#ff4d8d',
    headerGradient: 'linear-gradient(135deg,rgba(255,77,141,0.18) 0%,rgba(225,29,72,0.08) 100%)',
    headerBorder: 'rgba(255,77,141,0.25)',
    iconBg: 'rgba(255,77,141,0.15)',
    iconBorder: 'rgba(255,77,141,0.3)',
    badgeBg: 'rgba(255,77,141,0.15)',
    badgeColor: '#ff4d8d',
    badgeBorder: 'rgba(255,77,141,0.3)',
    badgeLabel: 'ACCIÓN REQUERIDA',
    titleColor: '#ffb3d0',
    ctaGradient: 'linear-gradient(135deg,#ff4d8d 0%,#e11d48 100%)',
    ctaColor: '#ffffff',
  },
  warning: {
    primary: '#fbbf24',
    headerGradient: 'linear-gradient(135deg,rgba(251,191,36,0.14) 0%,rgba(245,158,11,0.06) 100%)',
    headerBorder: 'rgba(251,191,36,0.22)',
    iconBg: 'rgba(251,191,36,0.15)',
    iconBorder: 'rgba(251,191,36,0.3)',
    badgeBg: 'rgba(251,191,36,0.15)',
    badgeColor: '#fbbf24',
    badgeBorder: 'rgba(251,191,36,0.3)',
    badgeLabel: 'AVISO IMPORTANTE',
    titleColor: '#fde68a',
    ctaGradient: 'linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%)',
    ctaColor: '#060807',
  },
  info: {
    primary: '#2dd4bf',
    headerGradient: 'linear-gradient(135deg,rgba(45,212,191,0.14) 0%,rgba(129,140,248,0.08) 100%)',
    headerBorder: 'rgba(45,212,191,0.22)',
    iconBg: 'rgba(45,212,191,0.15)',
    iconBorder: 'rgba(45,212,191,0.3)',
    badgeBg: 'rgba(45,212,191,0.15)',
    badgeColor: '#2dd4bf',
    badgeBorder: 'rgba(45,212,191,0.3)',
    badgeLabel: 'VERIFICACIÓN',
    titleColor: '#99f6e4',
    ctaGradient: 'linear-gradient(135deg,#2dd4bf 0%,#818cf8 100%)',
    ctaColor: '#060807',
  },
}

export function renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText, type = 'success', icon = '' }) {
  const brand = getBrandConfig()
  const p = TYPE_PALETTE[type] || TYPE_PALETTE.success
  const safePreheader = escapeHtml(preheader || '')
  const safeTitle = escapeHtml(title || '')
  const safeCtaText = escapeHtml(ctaText || '')
  const safeCtaUrl = sanitizeUrl(ctaUrl)
  const year = new Date().getFullYear()

  const iconHtml = icon
    ? `<div style="width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;margin-bottom:12px;background:${p.iconBg};border:1px solid ${p.iconBorder};">${escapeHtml(icon)}</div>`
    : ''

  const headerHtml = `
    <div style="padding:28px 36px 20px;background:${p.headerGradient};border-bottom:1px solid ${p.headerBorder};">
      ${iconHtml}
      <div style="display:inline-block;background:${p.badgeBg};color:${p.badgeColor};border:1px solid ${p.badgeBorder};font-size:10px;font-weight:800;padding:4px 12px;border-radius:50px;letter-spacing:1.5px;margin-bottom:10px;">${p.badgeLabel}</div>
      <h1 style="margin:0;font-size:26px;font-weight:900;letter-spacing:-0.5px;line-height:1.15;color:${p.titleColor};">${safeTitle}</h1>
    </div>`

  const ctaHtml = safeCtaUrl && safeCtaText
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background:${p.ctaGradient};border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.3);"><a href="${safeCtaUrl}" target="_blank" style="display:block;padding:17px;color:${p.ctaColor};font-size:15px;font-weight:900;text-decoration:none;text-align:center;letter-spacing:0.5px;">${safeCtaText}</a></td></tr></table>`
    : ''

  return `<!doctype html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#060807;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;font-size:1px;color:transparent;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${safePreheader}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#060807;">
      <tr><td align="center" style="padding:36px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="500" style="max-width:500px;width:100%;">
          <tr><td style="text-align:center;padding-bottom:24px;">
            <div style="display:inline-block;border:1px solid rgba(37,211,102,0.2);border-radius:50px;padding:8px 20px;background:rgba(37,211,102,0.05);">
              <span style="color:#25d366;font-size:18px;vertical-align:middle;">✦</span>
              <span style="color:#f2f6f3;font-size:14px;font-weight:900;letter-spacing:2px;vertical-align:middle;margin-left:8px;">${escapeHtml(brand.name.toUpperCase())}</span>
            </div>
            <div style="color:#3d504a;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;margin-top:8px;">El Monstruo de las Cenizas</div>
          </td></tr>
          <tr><td style="background:linear-gradient(160deg,#0f1a14 0%,#0c1410 100%);border-radius:20px;border:1px solid rgba(37,211,102,0.22);box-shadow:0 0 0 1px rgba(45,212,191,0.04),0 8px 32px rgba(0,0,0,0.6),0 0 60px rgba(37,211,102,0.07);overflow:hidden;">
            ${headerHtml}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding:28px 36px 36px;">
                <div style="color:#b2c5ba;font-size:15px;line-height:1.75;margin-bottom:28px;">${contentHtml}</div>
                ${ctaHtml}
                <p style="color:#2d4038;font-size:12px;text-align:center;margin:20px 0 0;line-height:1.6;">Si no fuiste vos quien realizó esta acción, podés ignorar este email.</p>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="text-align:center;padding-top:20px;">
            <p style="margin:0 0 4px;color:#2d4038;font-size:12px;">&copy; ${year} ${escapeHtml(brand.name)} &bull; El Monstruo de las Cenizas</p>
            <p style="margin:0;color:#1e2e26;font-size:10px;letter-spacing:2px;text-transform:uppercase;">Powered by Oguri Power System</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`.trim()
}
```

También añadir `gold` y `lavender` al objeto `palette` dentro de `renderDataBlock`:

```js
gold:    { bg: 'rgba(251,191,36,0.05)', border: 'rgba(251,191,36,0.14)', badgeBg: 'rgba(251,191,36,0.12)', badgeText: '#fbbf24', badgeBorder: 'rgba(251,191,36,0.28)' },
lavender:{ bg: 'rgba(129,140,248,0.05)', border: 'rgba(129,140,248,0.14)', badgeBg: 'rgba(129,140,248,0.12)', badgeText: '#818cf8', badgeBorder: 'rgba(129,140,248,0.28)' },
```

- [ ] **Step 4: Correr tests — verificar que pasan**

```bash
node --test test/email-renderer.test.mjs 2>&1 | tail -20
```

Esperado: todos los tests pasan.

- [ ] **Step 5: Commit**

```bash
git add lib/email/renderer.js test/email-renderer.test.mjs
git commit -m "feat(email): renderer temático con type/icon y colores gold/lavender"
```

---

## Task 2: Templates existentes renovados

**Files:**
- Modify: los 14 archivos en `lib/email/templates/`

Nota: Para cada template el patrón es el mismo — añadir `type`, `icon` al call de `renderPanelEmail` y enriquecer `contentHtml` con más `renderDataBlock` y mejor copy. Se muestran todos los archivos completos para evitar ambigüedad.

- [ ] **Step 1: Reemplazar `lib/email/templates/registration.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendRegistrationEmail({ to, username, role = 'Usuario' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeRole = escapeHtml(String(role || 'Usuario'))
  const subject = `¡Bienvenido a ${brand.name}! — Registro exitoso`
  const date = new Date().toLocaleString('es-ES', { dateStyle: 'long' })

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, ¡tu cuenta fue creada correctamente!</p>` +
    renderDataBlock({ label: 'Rol asignado', value: safeRole, badge: 'ACTIVO', badgeColor: 'green' }) +
    renderDataBlock({ label: 'Fecha de registro', value: date, badgeColor: 'gray' }) +
    `<p style="margin:20px 0 0;font-size:13px;color:#84968e;">Si vos no hiciste este registro, podés ignorar este email de forma segura.</p>`

  const text =
    `Hola ${String(username || '')},\n\n¡Tu cuenta fue creada correctamente en ${brand.name}!\n\nRol: ${String(role || 'Usuario')}\n\nIngresá al panel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: 'Tu cuenta fue creada correctamente.',
    title: `¡Bienvenido a ${brand.name}!`, contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Ir al panel',
    type: 'success', icon: '🎉',
  })

  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 2: Reemplazar `lib/email/templates/welcome.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendWelcomeEmail({ to, username, role = 'Usuario' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeRole = escapeHtml(String(role || 'Usuario'))
  const subject = `¡Bienvenido al equipo de ${brand.name}!`

  const stepsHtml = `
    <div style="margin:16px 0;padding:16px;background:rgba(37,211,102,0.04);border:1px solid rgba(37,211,102,0.12);border-radius:12px;">
      <p style="margin:0 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#84968e;font-weight:800;">Primeros pasos</p>
      <p style="margin:0 0 8px;font-size:14px;color:#f2f6f3;">→ Revisá el dashboard de control</p>
      <p style="margin:0 0 8px;font-size:14px;color:#f2f6f3;">→ Configurá tus notificaciones en tu perfil</p>
      <p style="margin:0;font-size:14px;color:#f2f6f3;">→ Explorá los grupos y sub-bots activos</p>
    </div>`

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, ¡ya sos parte del equipo de <strong style="color:#f2f6f3;">${escapeHtml(brand.name)}</strong>!</p>` +
    renderDataBlock({ label: 'Rol asignado', value: safeRole, badge: '✓ ACTIVO', badgeColor: 'green' }) +
    stepsHtml

  const text =
    `Hola ${String(username || '')},\n\n¡Bienvenido al equipo de ${brand.name}!\n\nTu rol: ${String(role || 'Usuario')}\n\nPanel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: 'Tu cuenta fue activada en el equipo.',
    title: '¡Bienvenido al equipo!', contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Acceder al panel',
    type: 'success', icon: '🚀',
  })

  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 3: Reemplazar `lib/email/templates/password-reset.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendPasswordResetEmail({ to, username, token, expiresMinutes = 30 }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeToken = String(token || '').trim()
  const resetUrl = `${brand.panelUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(safeToken)}`
  const subject = `Restablecer contraseña — ${brand.name}`

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, recibimos una solicitud para restablecer tu contraseña.</p>` +
    renderDataBlock({ label: 'Este link vence en', value: `${expiresMinutes} minutos`, badge: 'URGENTE', badgeColor: 'gold' }) +
    `<p style="margin:16px 0 0;color:#ff4d8d;font-size:13px;font-weight:700;">⚠️ Si vos no lo pediste, ignorá este email. Tu contraseña no cambiará.</p>`

  const text =
    `Hola ${String(username || '')},\n\nLink para restablecer tu contraseña (vence en ${expiresMinutes} min):\n${resetUrl}\n\nSi no lo pediste, ignorá este email.`

  const html = renderPanelEmail({
    subject, preheader: `Restablecé tu contraseña — vence en ${expiresMinutes} min`,
    title: 'Restablecer contraseña', contentHtml,
    ctaUrl: resetUrl, ctaText: 'Restablecer contraseña',
    type: 'warning', icon: '🔑',
  })

  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 4: Reemplazar `lib/email/templates/login-new-device.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildLoginNewDeviceEmail({ username, ip, location = '', device = '', time = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const subject = `🔐 Acceso nuevo detectado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, detectamos un acceso desde un dispositivo que no reconocemos.</p>` +
    renderDataBlock({ label: 'IP de acceso', value: escapeHtml(String(ip || '')), badgeColor: 'pink' })

  if (location) contentHtml += renderDataBlock({ label: 'Ubicación', value: escapeHtml(String(location)), badgeColor: 'gray' })
  if (device)   contentHtml += renderDataBlock({ label: 'Dispositivo', value: escapeHtml(String(device)), badgeColor: 'gray' })
  if (time)     contentHtml += renderDataBlock({ label: 'Hora', value: escapeHtml(String(time)), badgeColor: 'gray' })

  contentHtml += `
    <div style="margin:20px 0 0;padding:14px;background:rgba(255,77,141,0.06);border:1px solid rgba(255,77,141,0.18);border-radius:10px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#ff4d8d;">¿No fuiste vos?</p>
      <p style="margin:0 0 4px;font-size:13px;color:#b2c5ba;">1. Cambiá tu contraseña de inmediato</p>
      <p style="margin:0;font-size:13px;color:#b2c5ba;">2. Revisá los dispositivos activos en tu perfil</p>
    </div>`

  const text =
    `Hola ${String(username || '')},\n\nAcceso nuevo detectado.\nIP: ${String(ip || '')}\n` +
    (location ? `Ubicación: ${location}\n` : '') +
    (device   ? `Dispositivo: ${device}\n` : '') +
    (time     ? `Hora: ${time}\n`          : '') +
    `\nSi no fuiste vos, cambiá tu contraseña: ${brand.panelUrl}/configuracion`

  const html = renderPanelEmail({
    subject, preheader: `Acceso desde IP ${String(ip || '')} en tu cuenta`,
    title: 'Acceso nuevo detectado', contentHtml,
    ctaUrl: `${brand.panelUrl}/configuracion`, ctaText: 'Revisar mi cuenta',
    type: 'danger', icon: '🔐',
  })

  return { subject, html, text }
}

export async function sendLoginNewDeviceEmail({ to, username, ip, location = '', device = '', time = '' }) {
  const { subject, html, text } = buildLoginNewDeviceEmail({ username, ip, location, device, time })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 5: Reemplazar `lib/email/templates/role-changed.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildRoleChangedEmail({ username, oldRole, newRole, roleDescription = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const subject = `Tu rol fue actualizado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu rol en el panel fue actualizado.</p>` +
    renderDataBlock({ label: 'Rol anterior', value: escapeHtml(String(oldRole || 'Usuario')), badgeColor: 'gray' }) +
    renderDataBlock({ label: 'Nuevo rol', value: escapeHtml(String(newRole || 'Usuario')), badge: '✓ ACTIVO', badgeColor: 'teal' })

  if (roleDescription) {
    contentHtml += `<p style="margin:16px 0 0;font-size:13px;color:#84968e;">${escapeHtml(String(roleDescription))}</p>`
  }

  const text =
    `Hola ${String(username || '')},\n\nTu rol fue actualizado.\nAnterior: ${String(oldRole || '')}\nNuevo: ${String(newRole || '')}\n\nPanel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: `Tu rol cambió de ${String(oldRole || '')} a ${String(newRole || '')}`,
    title: 'Tu rol fue actualizado', contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Ver mi perfil',
    type: 'info', icon: '🔄',
  })

  return { subject, html, text }
}

export async function sendRoleChangedEmail({ to, username, oldRole, newRole, roleDescription = '' }) {
  const { subject, html, text } = buildRoleChangedEmail({ username, oldRole, newRole, roleDescription })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 6: Reemplazar `lib/email/templates/account-deleted.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAccountDeletedEmail({ username, deletedBy = 'el sistema', reason = '', contactEmail = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const subject = `Tu cuenta en ${brand.name} fue eliminada`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, lamentamos informarte que tu cuenta fue eliminada del sistema.</p>` +
    renderDataBlock({ label: 'Acción realizada por', value: escapeHtml(String(deletedBy || 'el sistema')), badgeColor: 'gray' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  const contactNote = contactEmail
    ? `Si creés que fue un error, escribinos a <strong style="color:#f2f6f3;">${escapeHtml(contactEmail)}</strong>.`
    : 'Si creés que fue un error, contactá al equipo de soporte.'

  contentHtml += `<p style="margin:20px 0 0;font-size:13px;color:#84968e;">${contactNote}</p>`

  const text =
    `Hola ${String(username || '')},\n\nTu cuenta en ${brand.name} fue eliminada.\nEliminado por: ${String(deletedBy || 'el sistema')}\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    (contactEmail ? `\nContacto: ${contactEmail}` : '')

  const html = renderPanelEmail({
    subject, preheader: 'Tu cuenta fue eliminada del sistema.',
    title: 'Cuenta eliminada', contentHtml,
    ctaUrl: '', ctaText: '',
    type: 'danger', icon: '🗑️',
  })

  return { subject, html, text }
}

export async function sendAccountDeletedEmail({ to, username, deletedBy = 'el sistema', reason = '', contactEmail = '' }) {
  const { subject, html, text } = buildAccountDeletedEmail({ username, deletedBy, reason, contactEmail })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 7: Reemplazar `lib/email/templates/bot-alert.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

const STATUS_CFG = {
  disconnected: { type: 'danger',  icon: '🔴', verb: 'se desconectó', badge: 'DESCONECTADO', badgeColor: 'pink',  preheader: 'El bot se desconectó' },
  reconnected:  { type: 'success', icon: '🟢', verb: 'está en línea', badge: 'EN LÍNEA',     badgeColor: 'green', preheader: 'El bot volvió en línea' },
  error:        { type: 'warning', icon: '⚠️', verb: 'tuvo un error', badge: 'ERROR',        badgeColor: 'gold',  preheader: 'Error detectado en el bot' },
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
```

- [ ] **Step 8: Reemplazar `lib/email/templates/subbot-alert.js`**

```js
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
```

- [ ] **Step 9: Reemplazar `lib/email/templates/aporte-received.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAporteReceivedEmail({ username, amount, concept = '', date = '', totalAccumulated = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeAmount   = escapeHtml(String(amount || ''))
  const subject = `💚 Recibiste un aporte de ${safeUsername} — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">¡Buenas noticias! <strong style="color:#f2f6f3;">${safeUsername}</strong> te envió un aporte.</p>` +
    renderDataBlock({ label: 'De', value: safeUsername, badgeColor: 'teal' }) +
    renderDataBlock({ label: 'Monto', value: safeAmount, badge: 'RECIBIDO', badgeColor: 'green' })

  if (concept)          contentHtml += renderDataBlock({ label: 'Concepto',    value: escapeHtml(String(concept)), badgeColor: 'gray' })
  if (date)             contentHtml += renderDataBlock({ label: 'Fecha',       value: escapeHtml(String(date)),    badgeColor: 'gray' })
  if (totalAccumulated) contentHtml += renderDataBlock({ label: 'Acumulado',   value: escapeHtml(String(totalAccumulated)), badgeColor: 'teal' })

  const text =
    `Recibiste un aporte de ${String(username || '')} — ${String(amount || '')}\n` +
    (concept ? `Concepto: ${concept}\n` : '') +
    `\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject, preheader: `${String(username || '')} te envió ${String(amount || '')}`,
    title: '¡Recibiste un aporte!', contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`, ctaText: 'Ver aportes',
    type: 'success', icon: '💚',
  })

  return { subject, html, text }
}

export async function sendAporteReceivedEmail({ to, username, amount, concept = '', date = '', totalAccumulated = '' }) {
  const { subject, html, text } = buildAporteReceivedEmail({ username, amount, concept, date, totalAccumulated })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 10: Reemplazar `lib/email/templates/aporte-aceptado.js`**

Leer el archivo actual y añadir `type: 'success', icon: '✅'` al call de `renderPanelEmail`, y añadir parámetro `creditDate = ''` con su `renderDataBlock`. La firma actual es `buildAporteAceptadoEmail({ username, amount, concept, acceptedBy })`.

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAporteAceptadoEmail({ username, amount, concept = '', acceptedBy = '', creditDate = '' }) {
  const brand = getBrandConfig()
  const safeUsername  = escapeHtml(String(username || ''))
  const safeAmount    = escapeHtml(String(amount || ''))
  const safeAcceptedBy = escapeHtml(String(acceptedBy || 'Admin'))
  const subject = `✅ Tu aporte fue aceptado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu aporte fue revisado y aceptado.</p>` +
    renderDataBlock({ label: 'Monto aceptado', value: safeAmount, badge: 'ACEPTADO', badgeColor: 'green' }) +
    renderDataBlock({ label: 'Revisado por', value: safeAcceptedBy, badgeColor: 'teal' })

  if (concept)    contentHtml += renderDataBlock({ label: 'Concepto',           value: escapeHtml(String(concept)),    badgeColor: 'gray' })
  if (creditDate) contentHtml += renderDataBlock({ label: 'Fecha de acreditación', value: escapeHtml(String(creditDate)), badgeColor: 'gold' })

  const text = `Hola ${String(username || '')},\n\nTu aporte de ${String(amount || '')} fue aceptado.\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject, preheader: `Tu aporte de ${String(amount || '')} fue aceptado`,
    title: 'Aporte aceptado', contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`, ctaText: 'Ver mis aportes',
    type: 'success', icon: '✅',
  })

  return { subject, html, text }
}

export async function sendAporteAceptadoEmail({ to, username, amount, concept = '', acceptedBy = '', creditDate = '' }) {
  const { subject, html, text } = buildAporteAceptadoEmail({ username, amount, concept, acceptedBy, creditDate })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 11: Reemplazar `lib/email/templates/aporte-rechazado.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAporteRechazadoEmail({ username, amount, reason = '', rejectedBy = '' }) {
  const brand = getBrandConfig()
  const safeUsername   = escapeHtml(String(username || ''))
  const safeAmount     = escapeHtml(String(amount || ''))
  const safeRejectedBy = escapeHtml(String(rejectedBy || 'Admin'))
  const subject = `❌ Tu aporte fue rechazado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, lamentablemente tu aporte fue rechazado.</p>` +
    renderDataBlock({ label: 'Monto', value: safeAmount, badge: 'RECHAZADO', badgeColor: 'pink' }) +
    renderDataBlock({ label: 'Revisado por', value: safeRejectedBy, badgeColor: 'gray' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'pink' })

  contentHtml += `
    <div style="margin:20px 0 0;padding:14px;background:rgba(255,77,141,0.05);border:1px solid rgba(255,77,141,0.15);border-radius:10px;">
      <p style="margin:0 0 6px;font-size:13px;font-weight:800;color:#ff4d8d;">¿Qué hacer ahora?</p>
      <p style="margin:0 0 4px;font-size:13px;color:#b2c5ba;">1. Revisá el motivo del rechazo</p>
      <p style="margin:0;font-size:13px;color:#b2c5ba;">2. Corregí el comprobante y reenviá el aporte</p>
    </div>`

  const text = `Hola ${String(username || '')},\n\nTu aporte de ${String(amount || '')} fue rechazado.\n` +
    (reason ? `Motivo: ${reason}\n` : '') + `\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject, preheader: `Tu aporte de ${String(amount || '')} fue rechazado`,
    title: 'Aporte rechazado', contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`, ctaText: 'Ver mis aportes',
    type: 'danger', icon: '❌',
  })

  return { subject, html, text }
}

export async function sendAporteRechazadoEmail({ to, username, amount, reason = '', rejectedBy = '' }) {
  const { subject, html, text } = buildAporteRechazadoEmail({ username, amount, reason, rejectedBy })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 12: Reemplazar `lib/email/templates/aporte-pendiente.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAportePendienteEmail({ username, amount, concept = '', dueDate = '', estimatedHours = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeAmount   = escapeHtml(String(amount || ''))
  const subject = `⏳ Tu aporte está en revisión — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, recibimos tu aporte y está siendo revisado.</p>` +
    renderDataBlock({ label: 'Monto', value: safeAmount, badge: 'EN REVISIÓN', badgeColor: 'gold' })

  if (concept)        contentHtml += renderDataBlock({ label: 'Concepto',           value: escapeHtml(String(concept)),        badgeColor: 'gray' })
  if (dueDate)        contentHtml += renderDataBlock({ label: 'Fecha límite',        value: escapeHtml(String(dueDate)),        badgeColor: 'gold' })
  if (estimatedHours) contentHtml += renderDataBlock({ label: 'Tiempo estimado',     value: `~${escapeHtml(String(estimatedHours))} horas`, badgeColor: 'gray' })

  contentHtml += `<p style="margin:16px 0 0;font-size:13px;color:#84968e;">Te notificaremos cuando tu aporte sea procesado.</p>`

  const text = `Hola ${String(username || '')},\n\nTu aporte de ${String(amount || '')} está en revisión.\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject, preheader: `Tu aporte de ${String(amount || '')} está siendo revisado`,
    title: 'Aporte en revisión', contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`, ctaText: 'Ver estado',
    type: 'warning', icon: '⏳',
  })

  return { subject, html, text }
}

export async function sendAportePendienteEmail({ to, username, amount, concept = '', dueDate = '', estimatedHours = '' }) {
  const { subject, html, text } = buildAportePendienteEmail({ username, amount, concept, dueDate, estimatedHours })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 13: Reemplazar `lib/email/templates/notification.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

const PRIORITY_CFG = {
  critical: { type: 'danger',  icon: '🚨' },
  high:     { type: 'warning', icon: '⚠️' },
  normal:   { type: 'info',    icon: '📢' },
  low:      { type: 'info',    icon: 'ℹ️' },
}

export async function sendNotificationEmail({ to, title, message, priority = 'normal' }) {
  const brand = getBrandConfig()
  const rawTitle   = String(title   || 'Notificación')
  const rawMessage = String(message || '')
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.normal
  const subject = `${brand.name} — ${rawTitle}`

  const html = renderPanelEmail({
    subject, preheader: rawMessage.slice(0, 100),
    title: rawTitle,
    contentHtml: escapeHtml(rawMessage).replace(/\n/g, '<br />'),
    ctaUrl: brand.panelUrl, ctaText: 'Ver en el panel',
    type: cfg.type, icon: cfg.icon,
  })

  const text = `${cfg.icon} ${rawTitle}\n\n${rawMessage}\n\nPanel: ${brand.panelUrl}`
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 14: Reemplazar `lib/email/templates/security-alert.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendSecurityAlertEmail({ to, subject, title, message, details = [], ctaUrl = '', ctaText = '' }) {
  const brand = getBrandConfig()
  const safeSubject = String(subject || 'Alerta de seguridad').trim() || 'Alerta de seguridad'
  const rawTitle    = String(title   || safeSubject).trim() || safeSubject
  const safeMessage = escapeHtml(String(message || ''))

  const detailBlocks = Array.isArray(details)
    ? details.filter(d => d?.label).map(d =>
        renderDataBlock({ label: String(d.label), value: String(d.value || '-'), badgeColor: 'pink' })
      ).join('')
    : ''

  const contentHtml = `<p style="margin:0 0 20px;">${safeMessage}</p>${detailBlocks}`

  const textDetails = Array.isArray(details)
    ? details.filter(d => d?.label).map(d => `${d.label}: ${d.value || '-'}`).join('\n')
    : ''

  const text = [String(message || ''), textDetails, `Panel: ${brand.panelUrl}`].filter(Boolean).join('\n\n')

  const html = renderPanelEmail({
    subject: safeSubject, preheader: String(message || '').slice(0, 100),
    title: rawTitle, contentHtml,
    ctaUrl: ctaUrl || brand.panelUrl, ctaText: ctaText || 'Abrir panel',
    type: 'danger', icon: '🛡️',
  })

  return sendMail({ to, subject: safeSubject, html, text })
}
```

- [ ] **Step 15: Verificar que el sistema de emails funciona con los templates renovados**

```bash
node -e "
import('./lib/email/index.js').then(async m => {
  const { buildBotAlertEmail } = m
  const r = buildBotAlertEmail({ botName: 'TestBot', status: 'disconnected' })
  console.log('subject:', r.subject)
  console.log('html length:', r.html.length)
  console.log('has danger color:', r.html.includes('#ff4d8d'))
  console.log('has icon:', r.html.includes('🔴'))
}).catch(e => console.error(e))
" 2>&1
```

Esperado: subject contiene "TestBot", html.length > 2000, has danger color: true, has icon: true.

- [ ] **Step 16: Commit**

```bash
git add lib/email/templates/
git commit -m "feat(email): renovar 14 templates con type/icon y contenido enriquecido"
```

---

## Task 3: Nuevos templates (7 archivos)

**Files:**
- Create: `lib/email/templates/maintenance-notice.js`
- Create: `lib/email/templates/account-suspended.js`
- Create: `lib/email/templates/account-reactivated.js`
- Create: `lib/email/templates/subbot-created.js`
- Create: `lib/email/templates/subbot-deleted.js`
- Create: `lib/email/templates/two-factor-code.js`
- Create: `lib/email/templates/system-alert.js`
- Test: `test/email-templates-new.test.mjs`

- [ ] **Step 1: Crear `lib/email/templates/maintenance-notice.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildMaintenanceNoticeEmail({ startTime, durationMinutes, affectedServices = [] }) {
  const brand = getBrandConfig()
  const safeStart    = escapeHtml(String(startTime || ''))
  const safeDuration = escapeHtml(String(durationMinutes || ''))
  const subject = `🛠️ Mantenimiento programado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">El sistema estará fuera de servicio por un período breve de mantenimiento.</p>` +
    renderDataBlock({ label: 'Inicio del mantenimiento', value: safeStart, badge: 'PROGRAMADO', badgeColor: 'gold' }) +
    renderDataBlock({ label: 'Duración estimada', value: `~${safeDuration} minutos`, badgeColor: 'gray' })

  if (affectedServices.length > 0) {
    const list = affectedServices.map(s => escapeHtml(String(s))).join(' · ')
    contentHtml += renderDataBlock({ label: 'Servicios afectados', value: list, badgeColor: 'gold' })
  }

  contentHtml += `<p style="margin:16px 0 0;font-size:13px;color:#84968e;">Pedimos disculpas por las molestias. El sistema volverá a estar disponible lo antes posible.</p>`

  const text =
    `Mantenimiento programado en ${brand.name}.\n\nInicio: ${String(startTime || '')}\nDuración: ~${String(durationMinutes || '')} min\n` +
    (affectedServices.length ? `Servicios afectados: ${affectedServices.join(', ')}\n` : '')

  const html = renderPanelEmail({
    subject, preheader: `Mantenimiento programado — inicio: ${String(startTime || '')}`,
    title: 'Mantenimiento programado', contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Ver estado del sistema',
    type: 'warning', icon: '🛠️',
  })

  return { subject, html, text }
}

export async function sendMaintenanceNoticeEmail({ to, startTime, durationMinutes, affectedServices = [] }) {
  const { subject, html, text } = buildMaintenanceNoticeEmail({ startTime, durationMinutes, affectedServices })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 2: Crear `lib/email/templates/account-suspended.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAccountSuspendedEmail({ username, suspendedBy, reason = '', contactUrl = '' }) {
  const brand = getBrandConfig()
  const safeUsername    = escapeHtml(String(username || ''))
  const safeSuspendedBy = escapeHtml(String(suspendedBy || 'Administrador'))
  const subject = `Tu cuenta fue suspendida — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu acceso al panel fue suspendido temporalmente.</p>` +
    renderDataBlock({ label: 'Suspendido por', value: safeSuspendedBy, badgeColor: 'pink' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  contentHtml += `<p style="margin:20px 0 0;font-size:13px;color:#84968e;">Si creés que esto es un error, contactá al equipo de soporte.</p>`

  const text =
    `Hola ${String(username || '')},\n\nTu cuenta en ${brand.name} fue suspendida.\nSuspendido por: ${String(suspendedBy || '')}\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    (contactUrl ? `\nContacto: ${contactUrl}` : '')

  const html = renderPanelEmail({
    subject, preheader: 'Tu acceso al panel fue suspendido.',
    title: 'Cuenta suspendida', contentHtml,
    ctaUrl: contactUrl || '', ctaText: contactUrl ? 'Contactar soporte' : '',
    type: 'danger', icon: '🔒',
  })

  return { subject, html, text }
}

export async function sendAccountSuspendedEmail({ to, username, suspendedBy, reason = '', contactUrl = '' }) {
  const { subject, html, text } = buildAccountSuspendedEmail({ username, suspendedBy, reason, contactUrl })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 3: Crear `lib/email/templates/account-reactivated.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAccountReactivatedEmail({ username, reactivatedBy, note = '' }) {
  const brand = getBrandConfig()
  const safeUsername      = escapeHtml(String(username || ''))
  const safeReactivatedBy = escapeHtml(String(reactivatedBy || 'Administrador'))
  const subject = `✅ Tu cuenta fue reactivada — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu acceso al panel fue restaurado.</p>` +
    renderDataBlock({ label: 'Reactivado por', value: safeReactivatedBy, badge: 'ACTIVA', badgeColor: 'green' })

  if (note) contentHtml += `<p style="margin:16px 0 0;font-size:13px;color:#b2c5ba;">${escapeHtml(String(note))}</p>`

  const text = `Hola ${String(username || '')},\n\nTu cuenta en ${brand.name} fue reactivada.\nReactivado por: ${String(reactivatedBy || '')}\n\nPanel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: 'Tu acceso al panel fue restaurado.',
    title: 'Cuenta reactivada', contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Acceder al panel',
    type: 'success', icon: '✅',
  })

  return { subject, html, text }
}

export async function sendAccountReactivatedEmail({ to, username, reactivatedBy, note = '' }) {
  const { subject, html, text } = buildAccountReactivatedEmail({ username, reactivatedBy, note })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 4: Crear `lib/email/templates/subbot-created.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildSubbotCreatedEmail({ subbotName, subbotNumber, createdBy }) {
  const brand = getBrandConfig()
  const safeSubbotName   = escapeHtml(String(subbotName || subbotNumber || ''))
  const safeSubbotNumber = escapeHtml(String(subbotNumber || ''))
  const safeCreatedBy    = escapeHtml(String(createdBy || 'Administrador'))
  const subject = `🤖 Nuevo sub-bot creado — ${brand.name}`

  const contentHtml =
    `<p style="margin:0 0 20px;">Un nuevo sub-bot fue añadido al sistema.</p>` +
    renderDataBlock({ label: 'Nombre', value: safeSubbotName, badge: 'ACTIVO', badgeColor: 'green' }) +
    renderDataBlock({ label: 'Número', value: safeSubbotNumber, badgeColor: 'teal' }) +
    renderDataBlock({ label: 'Creado por', value: safeCreatedBy, badgeColor: 'gray' })

  const text = `Nuevo sub-bot creado en ${brand.name}.\nNombre: ${String(subbotName || '')}\nNúmero: ${String(subbotNumber || '')}\nCreado por: ${String(createdBy || '')}\n\nPanel: ${brand.panelUrl}/subbots`

  const html = renderPanelEmail({
    subject, preheader: `Nuevo sub-bot ${String(subbotNumber || '')} creado`,
    title: 'Nuevo sub-bot creado', contentHtml,
    ctaUrl: `${brand.panelUrl}/subbots`, ctaText: 'Ver sub-bots',
    type: 'success', icon: '🤖',
  })

  return { subject, html, text }
}

export async function sendSubbotCreatedEmail({ to, subbotName, subbotNumber, createdBy }) {
  const { subject, html, text } = buildSubbotCreatedEmail({ subbotName, subbotNumber, createdBy })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 5: Crear `lib/email/templates/subbot-deleted.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildSubbotDeletedEmail({ subbotName, deletedBy, reason = '' }) {
  const brand = getBrandConfig()
  const safeSubbotName = escapeHtml(String(subbotName || ''))
  const safeDeletedBy  = escapeHtml(String(deletedBy || 'Administrador'))
  const subject = `🤖 Sub-bot eliminado — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">Un sub-bot fue eliminado del sistema.</p>` +
    renderDataBlock({ label: 'Sub-bot eliminado', value: safeSubbotName, badge: 'ELIMINADO', badgeColor: 'pink' }) +
    renderDataBlock({ label: 'Eliminado por', value: safeDeletedBy, badgeColor: 'gray' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  const text = `Sub-bot ${String(subbotName || '')} eliminado en ${brand.name}.\nEliminado por: ${String(deletedBy || '')}\n` +
    (reason ? `Motivo: ${reason}\n` : '')

  const html = renderPanelEmail({
    subject, preheader: `Sub-bot ${String(subbotName || '')} fue eliminado`,
    title: 'Sub-bot eliminado', contentHtml,
    ctaUrl: '', ctaText: '',
    type: 'danger', icon: '🤖',
  })

  return { subject, html, text }
}

export async function sendSubbotDeletedEmail({ to, subbotName, deletedBy, reason = '' }) {
  const { subject, html, text } = buildSubbotDeletedEmail({ subbotName, deletedBy, reason })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 6: Crear `lib/email/templates/two-factor-code.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildTwoFactorCodeEmail({ username, code, expiresMinutes = 5 }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeCode     = escapeHtml(String(code || ''))
  const subject = `${safeCode} es tu código de verificación — ${brand.name}`

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, usá este código para completar tu inicio de sesión.</p>` +
    `<div style="background:rgba(45,212,191,0.06);border:1px solid rgba(45,212,191,0.2);border-radius:12px;padding:20px 18px;margin-bottom:16px;text-align:center;">
      <p style="margin:0 0 4px;color:#84968e;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;">Tu código</p>
      <p style="margin:0;font-family:monospace;font-size:36px;font-weight:900;letter-spacing:10px;color:#f2f6f3;">${safeCode}</p>
      <p style="margin:8px 0 0;color:#fbbf24;font-size:12px;font-weight:700;">Vence en ${escapeHtml(String(expiresMinutes))} minutos</p>
    </div>` +
    `<p style="margin:0;font-size:13px;color:#ff4d8d;font-weight:700;">⚠️ No compartas este código con nadie. El equipo de ${escapeHtml(brand.name)} nunca te lo pedirá.</p>`

  const text =
    `Hola ${String(username || '')},\n\nTu código de verificación es: ${String(code || '')}\n\nVence en ${String(expiresMinutes)} minutos.\n\nNo compartas este código con nadie.`

  const html = renderPanelEmail({
    subject, preheader: `Tu código de verificación es ${String(code || '')}`,
    title: 'Código de verificación', contentHtml,
    ctaUrl: '', ctaText: '',
    type: 'info', icon: '🔑',
  })

  return { subject, html, text }
}

export async function sendTwoFactorCodeEmail({ to, username, code, expiresMinutes = 5 }) {
  const { subject, html, text } = buildTwoFactorCodeEmail({ username, code, expiresMinutes })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 7: Crear `lib/email/templates/system-alert.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildSystemAlertEmail({ metric, value, threshold, since = '', level = 'warning' }) {
  const brand = getBrandConfig()
  const safeMetric    = escapeHtml(String(metric || ''))
  const safeValue     = escapeHtml(String(value || ''))
  const safeThreshold = escapeHtml(String(threshold || ''))
  const isCritical    = level === 'critical'
  const subject       = `${isCritical ? '🚨' : '⚠️'} Alerta del sistema: ${safeMetric} — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">El sistema detectó una métrica que supera el umbral configurado.</p>` +
    renderDataBlock({ label: 'Métrica', value: safeMetric, badgeColor: 'gray' }) +
    renderDataBlock({ label: 'Valor actual', value: safeValue, badge: isCritical ? 'CRÍTICO' : 'ALTO', badgeColor: isCritical ? 'pink' : 'gold' }) +
    renderDataBlock({ label: 'Umbral', value: safeThreshold, badgeColor: 'gray' })

  if (since) contentHtml += renderDataBlock({ label: 'Desde', value: escapeHtml(String(since)), badgeColor: 'gray' })

  const text =
    `Alerta del sistema — ${brand.name}\n\nMétrica: ${String(metric || '')}\nValor: ${String(value || '')}\nUmbral: ${String(threshold || '')}\n` +
    (since ? `Desde: ${since}\n` : '') +
    `\nDiagnósticos: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject, preheader: `${String(metric || '')} superó el umbral de ${String(threshold || '')}`,
    title: `Alerta: ${safeMetric}`, contentHtml,
    ctaUrl: brand.panelUrl, ctaText: 'Ver diagnósticos',
    type: isCritical ? 'danger' : 'warning', icon: isCritical ? '🚨' : '⚠️',
  })

  return { subject, html, text }
}

export async function sendSystemAlertEmail({ to, metric, value, threshold, since = '', level = 'warning' }) {
  const { subject, html, text } = buildSystemAlertEmail({ metric, value, threshold, since, level })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 8: Añadir tests para los 7 nuevos templates en `test/email-templates-new.test.mjs`**

Añadir al final del archivo existente:

```js
import { buildMaintenanceNoticeEmail } from '../lib/email/templates/maintenance-notice.js'
import { buildAccountSuspendedEmail } from '../lib/email/templates/account-suspended.js'
import { buildAccountReactivatedEmail } from '../lib/email/templates/account-reactivated.js'
import { buildSubbotCreatedEmail } from '../lib/email/templates/subbot-created.js'
import { buildSubbotDeletedEmail } from '../lib/email/templates/subbot-deleted.js'
import { buildTwoFactorCodeEmail } from '../lib/email/templates/two-factor-code.js'
import { buildSystemAlertEmail } from '../lib/email/templates/system-alert.js'

describe('maintenance-notice', () => {
  const r = buildMaintenanceNoticeEmail({ startTime: '03:00 AM', durationMinutes: 30 })
  test('subject contiene mantenimiento', () => assert.ok(r.subject.toLowerCase().includes('mantenimiento')))
  test('html contiene startTime', () => assert.ok(r.html.includes('03:00 AM')))
  test('html es type warning (color dorado)', () => assert.ok(r.html.includes('#fbbf24')))
  test('html contiene ícono', () => assert.ok(r.html.includes('🛠️')))
  test('affectedServices se listan', () => {
    const r2 = buildMaintenanceNoticeEmail({ startTime: 'T', durationMinutes: 10, affectedServices: ['Panel', 'API'] })
    assert.ok(r2.html.includes('Panel'))
    assert.ok(r2.html.includes('API'))
  })
})

describe('account-suspended', () => {
  const r = buildAccountSuspendedEmail({ username: 'juan', suspendedBy: 'Admin', reason: 'fraude' })
  test('html contiene username', () => assert.ok(r.html.includes('juan')))
  test('html es type danger (color rosa)', () => assert.ok(r.html.includes('#ff4d8d')))
  test('html contiene motivo', () => assert.ok(r.html.includes('fraude')))
})

describe('account-reactivated', () => {
  const r = buildAccountReactivatedEmail({ username: 'juan', reactivatedBy: 'Admin' })
  test('html contiene username', () => assert.ok(r.html.includes('juan')))
  test('html es type success (color verde)', () => assert.ok(r.html.includes('#25d366')))
})

describe('subbot-created', () => {
  const r = buildSubbotCreatedEmail({ subbotName: 'TestBot', subbotNumber: '+549111', createdBy: 'Admin' })
  test('html contiene nombre', () => assert.ok(r.html.includes('TestBot')))
  test('html es type success', () => assert.ok(r.html.includes('#25d366')))
})

describe('subbot-deleted', () => {
  const r = buildSubbotDeletedEmail({ subbotName: 'TestBot', deletedBy: 'Admin' })
  test('html contiene nombre', () => assert.ok(r.html.includes('TestBot')))
  test('html es type danger', () => assert.ok(r.html.includes('#ff4d8d')))
})

describe('two-factor-code', () => {
  const r = buildTwoFactorCodeEmail({ username: 'juan', code: '482917', expiresMinutes: 5 })
  test('html contiene el código', () => assert.ok(r.html.includes('482917')))
  test('html no tiene CTA link', () => assert.ok(!r.html.includes('href="http')))
  test('html es type info (teal)', () => assert.ok(r.html.includes('#2dd4bf')))
  test('subject contiene el código', () => assert.ok(r.subject.includes('482917')))
})

describe('system-alert', () => {
  test('level warning → type warning (dorado)', () => {
    const r = buildSystemAlertEmail({ metric: 'memory_usage', value: '91%', threshold: '85%', level: 'warning' })
    assert.ok(r.html.includes('#fbbf24'))
  })
  test('level critical → type danger (rosa)', () => {
    const r = buildSystemAlertEmail({ metric: 'cpu_usage', value: '99%', threshold: '90%', level: 'critical' })
    assert.ok(r.html.includes('#ff4d8d'))
    assert.ok(r.html.includes('CRÍTICO'))
  })
  test('html contiene la métrica', () => {
    const r = buildSystemAlertEmail({ metric: 'disk_usage', value: '95%', threshold: '80%' })
    assert.ok(r.html.includes('disk_usage'))
  })
})
```

- [ ] **Step 9: Correr tests**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -30
```

Esperado: todos pasan.

- [ ] **Step 10: Commit**

```bash
git add lib/email/templates/ test/email-templates-new.test.mjs
git commit -m "feat(email): crear 7 nuevos templates (maintenance, suspended, reactivated, subbot, 2fa, system-alert)"
```

---

## Task 4: Index exports + Preview + Preview server

**Files:**
- Modify: `lib/email/index.js`
- Modify: `lib/email/preview.js`
- Modify: `scripts/preview-server.mjs`

- [ ] **Step 1: Añadir 7 exports en `lib/email/index.js`**

Añadir al final del bloque de exports existente (antes de `export { getActiveProvider }`):

```js
export { sendMaintenanceNoticeEmail, buildMaintenanceNoticeEmail } from './templates/maintenance-notice.js'
export { sendAccountSuspendedEmail, buildAccountSuspendedEmail } from './templates/account-suspended.js'
export { sendAccountReactivatedEmail, buildAccountReactivatedEmail } from './templates/account-reactivated.js'
export { sendSubbotCreatedEmail, buildSubbotCreatedEmail } from './templates/subbot-created.js'
export { sendSubbotDeletedEmail, buildSubbotDeletedEmail } from './templates/subbot-deleted.js'
export { sendTwoFactorCodeEmail, buildTwoFactorCodeEmail } from './templates/two-factor-code.js'
export { sendSystemAlertEmail, buildSystemAlertEmail } from './templates/system-alert.js'
```

- [ ] **Step 2: Añadir imports de los nuevos builders al inicio de `lib/email/preview.js`**

Añadir después de los imports existentes de builders:

```js
import { buildMaintenanceNoticeEmail } from './templates/maintenance-notice.js'
import { buildAccountSuspendedEmail } from './templates/account-suspended.js'
import { buildAccountReactivatedEmail } from './templates/account-reactivated.js'
import { buildSubbotCreatedEmail } from './templates/subbot-created.js'
import { buildSubbotDeletedEmail } from './templates/subbot-deleted.js'
import { buildTwoFactorCodeEmail } from './templates/two-factor-code.js'
import { buildSystemAlertEmail } from './templates/system-alert.js'
```

- [ ] **Step 3: Añadir los 7 casos nuevos al `switch` en `buildEmailPreview()` dentro de `lib/email/preview.js`**

Añadir antes del `default:`:

```js
case 'maintenance-notice': {
  const { html, subject } = buildMaintenanceNoticeEmail({ startTime: 'Hoy 03:00 AM', durationMinutes: 30, affectedServices: ['Panel', 'API', 'Bot'] })
  return { template: 'maintenance-notice', title: 'Mantenimiento programado', subject, recipient: previewTo, html }
}
case 'account-suspended': {
  const { html, subject } = buildAccountSuspendedEmail({ username: 'OguriAdmin', suspendedBy: 'melodia (Owner)', reason: 'Revisión de cuenta', contactUrl: brand.panelUrl })
  return { template: 'account-suspended', title: 'Cuenta suspendida', subject, recipient: previewTo, html }
}
case 'account-reactivated': {
  const { html, subject } = buildAccountReactivatedEmail({ username: 'OguriAdmin', reactivatedBy: 'melodia (Owner)', note: 'Tu acceso fue restaurado luego de la revisión.' })
  return { template: 'account-reactivated', title: 'Cuenta reactivada', subject, recipient: previewTo, html }
}
case 'subbot-created': {
  const { html, subject } = buildSubbotCreatedEmail({ subbotName: 'Lumine', subbotNumber: '+5217441977049', createdBy: 'melodia' })
  return { template: 'subbot-created', title: 'Sub-bot creado', subject, recipient: previewTo, html }
}
case 'subbot-deleted': {
  const { html, subject } = buildSubbotDeletedEmail({ subbotName: 'Mac (+50670090542)', deletedBy: 'melodia', reason: 'QR expirado sin renovar' })
  return { template: 'subbot-deleted', title: 'Sub-bot eliminado', subject, recipient: previewTo, html }
}
case 'two-factor-code': {
  const { html, subject } = buildTwoFactorCodeEmail({ username: 'OguriAdmin', code: '482 917', expiresMinutes: 5 })
  return { template: 'two-factor-code', title: 'Código 2FA', subject, recipient: previewTo, html }
}
case 'system-alert': {
  const { html, subject } = buildSystemAlertEmail({ metric: 'memory_usage_percent', value: '91.4%', threshold: '85%', since: '16/05/2026 14:32', level: 'warning' })
  return { template: 'system-alert', title: 'Alerta del sistema', subject, recipient: previewTo, html }
}
```

- [ ] **Step 4: Añadir las 7 entradas al array TEMPLATES en `scripts/preview-server.mjs`**

Añadir al array TEMPLATES existente:

```js
{ id: 'maintenance-notice',   label: 'Mantenimiento',        emoji: '🛠️' },
{ id: 'account-suspended',    label: 'Cuenta suspendida',    emoji: '🔒' },
{ id: 'account-reactivated',  label: 'Cuenta reactivada',    emoji: '✅' },
{ id: 'subbot-created',       label: 'Sub-bot creado',       emoji: '🤖' },
{ id: 'subbot-deleted',       label: 'Sub-bot eliminado',    emoji: '🗑️' },
{ id: 'two-factor-code',      label: 'Código 2FA',           emoji: '🔑' },
{ id: 'system-alert',         label: 'Alerta del sistema',   emoji: '⚠️' },
```

- [ ] **Step 5: Verificar que el preview server sirve los nuevos templates**

```bash
pkill -f "preview-server.mjs" 2>/dev/null; sleep 1
node scripts/preview-server.mjs &
sleep 2
curl -s "http://127.0.0.1:61940/preview?t=maintenance-notice" | grep -c "Mantenimiento"
curl -s "http://127.0.0.1:61940/preview?t=two-factor-code" | grep -c "482 917"
```

Esperado: ambos retornan `1` (el texto está en el HTML).

- [ ] **Step 6: Commit**

```bash
pkill -f "preview-server.mjs" 2>/dev/null
git add lib/email/index.js lib/email/preview.js scripts/preview-server.mjs
git commit -m "feat(email): exportar y registrar en preview los 7 nuevos templates"
```

---

## Task 5: API endpoint admin de envío

**Files:**
- Modify: `api/routes/broadcast.js`

El endpoint `POST /api/email/send` permite a admin/owner enviar manualmente cualquier template nuevo a un destinatario.

- [ ] **Step 1: Añadir el endpoint en `api/routes/broadcast.js`**

Añadir después del bloque `if (pathname === '/api/email/preview' && method === 'POST')`:

```js
// ── /api/email/send — admin manual send ───────────────────────────────────────
if (pathname === '/api/email/send' && method === 'POST') {
  const auth = await getJwtAuth(req)
  if (!auth.ok) return json(res, auth.status, { error: auth.error })
  if (!['owner', 'admin', 'administrador'].includes(auth.user?.rol)) {
    return json(res, 403, { error: 'Solo administradores pueden enviar emails manuales' })
  }

  let body
  try { body = await readJson(req) } catch { return json(res, 400, { error: 'JSON inválido' }) }

  const { template, to, ...params } = body || {}
  if (!template || !to) return json(res, 400, { error: 'template y to son requeridos' })

  try {
    const emailLib = await import('../../lib/email/index.js')

    const TEMPLATE_MAP = {
      'maintenance-notice':  'sendMaintenanceNoticeEmail',
      'account-suspended':   'sendAccountSuspendedEmail',
      'account-reactivated': 'sendAccountReactivatedEmail',
      'subbot-created':      'sendSubbotCreatedEmail',
      'subbot-deleted':      'sendSubbotDeletedEmail',
      'two-factor-code':     'sendTwoFactorCodeEmail',
      'system-alert':        'sendSystemAlertEmail',
      'notification':        'sendNotificationEmail',
      'security-alert':      'sendSecurityAlertEmail',
    }

    const fnName = TEMPLATE_MAP[template]
    if (!fnName || typeof emailLib[fnName] !== 'function') {
      return json(res, 400, { error: `Template desconocido: ${template}` })
    }

    await emailLib[fnName]({ to, ...params })
    return json(res, 200, { success: true, template, to })
  } catch (err) {
    return json(res, 500, { error: err?.message || 'Error al enviar email' })
  }
}
```

- [ ] **Step 2: Verificar que el endpoint responde (sin SMTP configurado debe retornar error de envío, no 404)**

```bash
curl -s -X POST http://127.0.0.1:3001/api/email/send \
  -H "Content-Type: application/json" \
  -d '{"template":"maintenance-notice","to":"test@test.com","startTime":"03:00","durationMinutes":30}' \
  | node -e "process.stdin.on('data',d=>{ const r=JSON.parse(d); console.log('status field present:', 'success' in r || 'error' in r) })"
```

Esperado: `status field present: true` (sin el JWT va a retornar 401, lo cual es correcto).

- [ ] **Step 3: Commit**

```bash
git add api/routes/broadcast.js
git commit -m "feat(api): añadir POST /api/email/send para envío manual por admin"
```

---

## Task 6: Auto-integraciones backend

**Files:**
- Modify: `api/routes/usuarios.js` — email al cambiar `activo`
- Modify: `api/routes/subbots.js` — email al crear/eliminar subbot
- Modify: `lib/alert-system.js` — acción `email` en executeAction + memoria regla

- [ ] **Step 1: Añadir emails de suspensión/reactivación en `api/routes/usuarios.js`**

Localizar el bloque `if (method === 'PATCH')` dentro del `idMatch` handler (alrededor de línea 161). Después de `if (method === 'PATCH') {` y luego de que el PATCH termina exitosamente (después de `return json(res, 200, ...)`), añadir el envío de email en un bloque `setImmediate`. Reemplazar la sección de PATCH para que quede así:

```js
if (method === 'PATCH') {
  const body = await readJson(req)
  const fields = {}
  for (const k of ['email', 'whatsapp_number', 'rol', 'activo']) { if (k in body) fields[k] = body[k] }
  if (!Object.keys(fields).length) return json(res, 400, { error: 'Sin campos a actualizar' })
  await pgUpdateUser(user.username, fields)
  if (db.data.usuarios[user.id]) Object.assign(db.data.usuarios[user.id], fields)

  // Notificar por email si cambia activo
  const ativoChanged = 'activo' in body
  if (ativoChanged && user.email) {
    const userEmail = user.email
    const adminName = safeString(auth.user?.username || 'Admin')
    const username  = safeString(user.username)
    setImmediate(async () => {
      try {
        const emailLib = await import('../../lib/email/index.js')
        if (body.activo === false) {
          await emailLib.sendAccountSuspendedEmail({ to: userEmail, username, suspendedBy: adminName })
        } else if (body.activo === true) {
          await emailLib.sendAccountReactivatedEmail({ to: userEmail, username, reactivatedBy: adminName })
        }
      } catch {}
    })
  }

  return json(res, 200, { success: true })
}
```

Nota: `safeString` ya existe como función en `usuarios.js`. Si no, usar `String(x || '')`.

- [ ] **Step 2: Añadir email de subbot creado en `api/routes/subbots.js`**

Localizar los dos puntos donde se registra `subbot_created` (líneas ~159 y ~238). Justo después de cada `global.sendTemplateNotification?.('subbot_created', ...)`, añadir:

```js
// Email al owner del bot
setImmediate(async () => {
  try {
    const ownerEmail = await getOwnerEmail()
    if (!ownerEmail) return
    const { sendSubbotCreatedEmail } = await import('../../lib/email/index.js')
    await sendSubbotCreatedEmail({
      to: ownerEmail,
      subbotName: code,   // o `numero` en el segundo caso
      subbotNumber: code, // ídem
      createdBy: safeString(auth.user?.username || 'panel'),
    })
  } catch {}
})
```

Nota: `getOwnerEmail()` ya existe definida al inicio de `subbots.js` (línea ~25).

- [ ] **Step 3: Añadir email de subbot eliminado en `api/routes/subbots.js`**

Localizar el bloque `if (delMatch && method === 'DELETE')` (línea ~322). Después de `global.sendTemplateNotification?.('subbot_deleted', ...)`, añadir:

```js
setImmediate(async () => {
  try {
    const ownerEmail = ownerEmail  // ya capturado antes del delete
    if (!ownerEmail) return
    const { sendSubbotDeletedEmail } = await import('../../lib/email/index.js')
    await sendSubbotDeletedEmail({
      to: ownerEmail,
      subbotName: code,
      deletedBy: safeString(auth.user?.username || 'panel'),
    })
  } catch {}
})
```

Nota: el código ya captura `ownerEmail` antes de eliminar el registro (línea ~327). Usar esa variable.

- [ ] **Step 4: Añadir acción `email` en `lib/alert-system.js`**

Localizar el método `executeAction(action, rule, alert)`. Añadir un nuevo case dentro del switch:

```js
case 'email':
  try {
    const config = await import('./email/config.js')
    const adminEmail = config.getBrandConfig?.()?.adminEmail || null
    if (!adminEmail) break
    const { sendSystemAlertEmail } = await import('./email/index.js')
    await sendSystemAlertEmail({
      to: adminEmail,
      metric: rule.metric || alert.metric || 'sistema',
      value: String(alert.value ?? ''),
      threshold: String(rule.threshold ?? ''),
      since: new Date().toUTCString(),
      level: rule.severity === 'critical' ? 'critical' : 'warning',
    })
  } catch {}
  break
```

Añadir `'email'` a las acciones de la regla `Uso de Memoria Alto`:

```js
actions: ['notification', 'log', 'email'],
```

- [ ] **Step 5: Verificar compilación (sin errores de sintaxis)**

```bash
node --check api/routes/usuarios.js && echo "usuarios.js OK"
node --check api/routes/subbots.js && echo "subbots.js OK"
node --check lib/alert-system.js && echo "alert-system.js OK"
```

Esperado: los tres imprimen `OK`.

- [ ] **Step 6: Commit**

```bash
git add api/routes/usuarios.js api/routes/subbots.js lib/alert-system.js
git commit -m "feat(email): auto-envío al suspender/reactivar usuario, crear/eliminar subbot y alerta de sistema"
```

---

## Task 7: UX frontend — Configuración, Usuarios

**Files:**
- Modify: `frontend-next/src/app/(dashboard)/configuracion/page.tsx`
- Modify: `frontend-next/src/app/(dashboard)/usuarios/page.tsx`

### Parte A: configuracion/page.tsx

- [ ] **Step 1: Añadir 7 templates al array `EMAIL_PREVIEW_TEMPLATES`**

Localizar `const EMAIL_PREVIEW_TEMPLATES = [` (línea 82). Añadir al final del array:

```ts
{ id: 'maintenance-notice',   label: 'Mantenimiento programado' },
{ id: 'account-suspended',    label: 'Cuenta suspendida' },
{ id: 'account-reactivated',  label: 'Cuenta reactivada' },
{ id: 'subbot-created',       label: 'Sub-bot creado' },
{ id: 'subbot-deleted',       label: 'Sub-bot eliminado' },
{ id: 'two-factor-code',      label: 'Código 2FA' },
{ id: 'system-alert',         label: 'Alerta del sistema' },
```

- [ ] **Step 2: Añadir botón "Notificar usuarios" en la sección de mantenimiento**

Localizar la sección de mantenimiento en el JSX (alrededor de donde está `systemConfig.maintenanceMode`). Añadir después del botón de activar/desactivar mantenimiento:

```tsx
{systemConfig.maintenanceMode && (
  <Button
    variant="ghost"
    size="sm"
    onClick={handleSendMaintenanceEmail}
    loading={maintenanceEmailLoading}
    className="border border-amber-500/20 text-amber-300 hover:bg-amber-500/10 text-xs"
  >
    📧 Notificar usuarios por email
  </Button>
)}
```

- [ ] **Step 3: Añadir el state y handler para el botón de mantenimiento en `configuracion/page.tsx`**

Añadir cerca de los otros `useState` de mantenimiento (alrededor de línea 364):

```tsx
const [maintenanceEmailLoading, setMaintenanceEmailLoading] = React.useState(false);

const handleSendMaintenanceEmail = async () => {
  setMaintenanceEmailLoading(true);
  try {
    await api.post('/api/email/send', {
      template: 'maintenance-notice',
      to: '__all_admin__',  // el endpoint puede ignorar esto si no hay soporte broadcast
      startTime: new Date().toLocaleString('es-ES'),
      durationMinutes: 30,
      affectedServices: ['Panel', 'Bot'],
    });
    notify.success('Email de mantenimiento enviado');
  } catch {
    notify.error('No se pudo enviar el email');
  } finally {
    setMaintenanceEmailLoading(false);
  }
};
```

Nota: `api.post` es el cliente HTTP configurado en el proyecto. Verificar el método exacto revisando otros handlers en la misma página.

### Parte B: usuarios/page.tsx

- [ ] **Step 4: Añadir acción "Suspender / Reactivar" en la tabla de usuarios**

Localizar donde se renderizan las acciones por usuario en la tabla (alrededor de línea 465 donde está el email). Añadir un botón de suspend/reactivate junto a las acciones existentes (editar, eliminar):

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => toggleUserActive(u)}
  className={cn(
    'h-7 w-7 rounded-lg text-xs',
    u.activo !== false
      ? 'text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/20 border border-transparent'
      : 'text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20 border border-transparent'
  )}
  title={u.activo !== false ? 'Suspender cuenta' : 'Reactivar cuenta'}
>
  {u.activo !== false ? '🔒' : '✅'}
</Button>
```

- [ ] **Step 5: Añadir la función `toggleUserActive` en `usuarios/page.tsx`**

Añadir cerca de las otras funciones de acción (como `deleteUser`):

```tsx
const toggleUserActive = async (u: User) => {
  const newState = u.activo === false ? true : false;
  const action = newState ? 'reactivar' : 'suspender';
  if (!confirm(`¿Querés ${action} la cuenta de ${u.username}?`)) return;
  try {
    await api.updateUsuario(u.id, { activo: newState });
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, activo: newState } : x));
    notify.success(`Usuario ${newState ? 'reactivado' : 'suspendido'}${u.email ? ' — email enviado' : ''}`);
  } catch (err: any) {
    notify.error(err.response?.data?.error || `Error al ${action}`);
  }
};
```

Nota: `api.updateUsuario` ya existe en el proyecto (usado en línea 175). Verificar la firma exacta en el código antes de implementar.

- [ ] **Step 6: Verificar TypeScript**

```bash
cd /home/OguriCap-Bot/frontend-next && node_modules/.bin/tsc --noEmit 2>&1 | head -20
```

Esperado: sin output (sin errores).

- [ ] **Step 7: Commit y build**

```bash
git add "frontend-next/src/app/(dashboard)/configuracion/page.tsx" \
        "frontend-next/src/app/(dashboard)/usuarios/page.tsx"
git commit -m "feat(ux): preview de nuevos templates, botón maintenance email y acciones suspend/reactivate"

docker compose build admin-panel 2>&1 | tail -5
docker compose up -d admin-panel
```

Esperado: build sin errores, contenedor arriba.

---

## Verificación final

```bash
# 1. Tests
node --test test/email-renderer.test.mjs test/email-templates-new.test.mjs 2>&1 | tail -10

# 2. Preview server con todos los templates
node scripts/preview-server.mjs &
sleep 2
for t in maintenance-notice account-suspended account-reactivated subbot-created subbot-deleted two-factor-code system-alert; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:61940/preview?t=$t")
  echo "$t: $code"
done
pkill -f preview-server.mjs

# 3. Syntax check de todos los archivos modificados
node --check lib/email/renderer.js lib/email/index.js api/routes/broadcast.js api/routes/usuarios.js api/routes/subbots.js lib/alert-system.js && echo "Todo OK"
```

Esperado: todos los tests pasan, todos los previews retornan 200, todos los archivos sin errores de sintaxis.
