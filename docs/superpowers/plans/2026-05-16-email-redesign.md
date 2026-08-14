# Email Redesign + Nuevos Templates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactorizar el renderer de emails con la paleta real del panel (verde/teal/rosa) y agregar 6 nuevos templates con diseño aprobado.

**Architecture:** El renderer (`lib/email/renderer.js`) recibe el nuevo layout v2 y exporta un helper `renderDataBlock()` para bloques de datos reutilizables. Los templates nuevos usan `buildXxxEmail()` (retorna `{subject,html,text}`) y `sendXxxEmail()` (llama a sendMail). Los existentes heredan el nuevo visual sin cambiar API.

**Tech Stack:** Node.js ESM, nodemailer, node:test (tests), HTML email inline-styles (table-based layout email-safe).

---

## Archivos

| Acción | Archivo | Responsabilidad |
|---|---|---|
| Modify | `lib/email/renderer.js` | Nuevo layout v2 + exportar `renderDataBlock()` |
| Modify | `test/email-renderer.test.mjs` | Tests de nueva paleta + `renderDataBlock` |
| Create | `lib/email/templates/role-changed.js` | Email cambio de rol |
| Create | `lib/email/templates/bot-alert.js` | Email alerta bot (disconnected/reconnected/error) |
| Create | `lib/email/templates/subbot-alert.js` | Email alerta subbot |
| Create | `lib/email/templates/aporte-received.js` | Email aporte recibido |
| Create | `lib/email/templates/login-new-device.js` | Email acceso nuevo dispositivo |
| Create | `lib/email/templates/account-deleted.js` | Email cuenta eliminada |
| Create | `test/email-templates-new.test.mjs` | Smoke tests de los 6 nuevos templates |
| Modify | `lib/email/index.js` | Re-exportar los 6 nuevos templates |
| Modify | `lib/email/preview.js` | Agregar 6 casos en el switch de `buildEmailPreview` |

---

## Task 1: Actualizar renderer — tests primero

**Files:**
- Modify: `test/email-renderer.test.mjs`
- Modify: `lib/email/renderer.js`

- [ ] **Step 1: Agregar tests que fallarán con el renderer viejo**

Reemplazar el contenido completo de `test/email-renderer.test.mjs`:

```js
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, renderPanelEmail, renderDataBlock } from '../lib/email/renderer.js'

describe('escapeHtml', () => {
  test('escapa &', () => assert.equal(escapeHtml('a & b'), 'a &amp; b'))
  test('escapa <', () => assert.equal(escapeHtml('<script>'), '&lt;script&gt;'))
  test('escapa "', () => assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;'))
  test("escapa '", () => assert.equal(escapeHtml("it's"), 'it&#039;s'))
  test('null → string vacío', () => assert.equal(escapeHtml(null), ''))
  test('sin caracteres especiales → sin cambios', () => assert.equal(escapeHtml('hello world'), 'hello world'))
})

describe('renderPanelEmail', () => {
  const html = renderPanelEmail({
    subject: 'Test subject',
    preheader: 'Preview text',
    title: 'Hello World',
    contentHtml: '<p>Content</p>',
    ctaUrl: 'https://example.com',
    ctaText: 'Click me',
  })

  test('retorna string HTML', () => assert.ok(typeof html === 'string'))
  test('contiene el título', () => assert.ok(html.includes('Hello World')))
  test('contiene el CTA', () => assert.ok(html.includes('Click me')))
  test('contiene el preheader', () => assert.ok(html.includes('Preview text')))
  test('contiene el href del CTA', () => assert.ok(html.includes('https://example.com')))
  test('sin CTA si ctaUrl vacío', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 't', contentHtml: 'c', ctaUrl: '', ctaText: '' })
    assert.ok(!h.includes('href=""'))
  })
  test('rechaza ctaUrl con esquema javascript:', () => {
    const h = renderPanelEmail({ subject: 's', preheader: '', title: 't', contentHtml: 'c', ctaUrl: 'javascript:alert(1)', ctaText: 'click' })
    assert.ok(!h.includes('javascript:'))
  })
  test('paleta: contiene verde #25d366', () => assert.ok(html.includes('#25d366')))
  test('paleta: contiene teal #2dd4bf', () => assert.ok(html.includes('#2dd4bf')))
  test('paleta: contiene rosa #ff4d8d', () => assert.ok(html.includes('#ff4d8d')))
  test('branding: contiene El Monstruo de las Cenizas', () => assert.ok(html.includes('El Monstruo de las Cenizas')))
  test('branding: contiene Powered by Oguri Power System', () => assert.ok(html.includes('Powered by Oguri Power System')))
})

describe('renderDataBlock', () => {
  test('retorna string con label y value', () => {
    const block = renderDataBlock({ label: 'Rol', value: 'Admin' })
    assert.ok(typeof block === 'string')
    assert.ok(block.includes('Rol'))
    assert.ok(block.includes('Admin'))
  })
  test('escapa HTML en value', () => {
    const block = renderDataBlock({ label: 'X', value: '<script>' })
    assert.ok(!block.includes('<script>'))
    assert.ok(block.includes('&lt;script&gt;'))
  })
  test('escapa HTML en label', () => {
    const block = renderDataBlock({ label: '<b>Label</b>', value: 'v' })
    assert.ok(!block.includes('<b>'))
  })
  test('incluye badge cuando se proporciona', () => {
    const block = renderDataBlock({ label: 'Estado', value: 'OK', badge: 'ACTIVO' })
    assert.ok(block.includes('ACTIVO'))
  })
  test('no incluye markup de badge cuando badge está vacío', () => {
    const block = renderDataBlock({ label: 'Estado', value: 'OK' })
    assert.ok(!block.includes('letter-spacing:0.8px'))
  })
  test('usa color teal cuando badgeColor=teal', () => {
    const block = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'teal' })
    assert.ok(block.includes('#2dd4bf'))
  })
  test('usa color pink cuando badgeColor=pink', () => {
    const block = renderDataBlock({ label: 'X', value: 'Y', badge: 'B', badgeColor: 'pink' })
    assert.ok(block.includes('#ff4d8d'))
  })
  test('default badgeColor=green contiene #25d366', () => {
    const block = renderDataBlock({ label: 'X', value: 'Y', badge: 'B' })
    assert.ok(block.includes('#25d366'))
  })
})
```

- [ ] **Step 2: Verificar que los tests nuevos fallan**

```bash
node --test test/email-renderer.test.mjs 2>&1 | tail -15
```

Expected: fail en tests de paleta y `renderDataBlock is not a function`.

- [ ] **Step 3: Reescribir `lib/email/renderer.js` completo**

```js
import { getBrandConfig } from './config.js'

export function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return String(text || '').replace(/[&<>"']/g, m => map[m])
}

function sanitizeUrl(url) {
  const str = String(url || '').trim()
  if (!str) return ''
  try {
    const parsed = new URL(str)
    return ['https:', 'http:'].includes(parsed.protocol) ? str : ''
  } catch {
    return ''
  }
}

/**
 * Renders a styled data block for use inside contentHtml.
 * @param {{ label: string, value: string, badge?: string, badgeColor?: 'green'|'teal'|'pink'|'gray' }} params
 */
export function renderDataBlock({ label, value, badge = '', badgeColor = 'green' }) {
  const palette = {
    green: { bg: 'rgba(37,211,102,0.06)', border: 'rgba(37,211,102,0.18)', badgeBg: 'rgba(37,211,102,0.15)', badgeText: '#25d366', badgeBorder: 'rgba(37,211,102,0.35)' },
    teal:  { bg: 'rgba(45,212,191,0.05)', border: 'rgba(45,212,191,0.14)', badgeBg: 'rgba(45,212,191,0.12)', badgeText: '#2dd4bf', badgeBorder: 'rgba(45,212,191,0.28)' },
    pink:  { bg: 'rgba(255,77,141,0.05)', border: 'rgba(255,77,141,0.14)', badgeBg: 'rgba(255,77,141,0.12)', badgeText: '#ff4d8d', badgeBorder: 'rgba(255,77,141,0.28)' },
    gray:  { bg: 'rgba(132,150,142,0.06)', border: 'rgba(132,150,142,0.14)', badgeBg: 'rgba(132,150,142,0.12)', badgeText: '#84968e', badgeBorder: 'rgba(132,150,142,0.25)' },
  }
  const c = palette[badgeColor] || palette.green
  const safeLabel = escapeHtml(label)
  const safeValue = escapeHtml(value)
  const safeBadge = escapeHtml(badge)
  const badgeHtml = safeBadge
    ? `<td style="text-align:right;vertical-align:middle;"><span style="display:inline-block;background:${c.badgeBg};color:${c.badgeText};border:1px solid ${c.badgeBorder};font-size:11px;font-weight:700;padding:5px 12px;border-radius:50px;letter-spacing:0.8px;">${safeBadge}</span></td>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.bg};border:1px solid ${c.border};border-radius:12px;margin-bottom:12px;"><tr><td style="padding:14px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="vertical-align:middle;"><span style="color:#84968e;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;display:block;margin-bottom:3px;">${safeLabel}</span><span style="color:#f2f6f3;font-size:17px;font-weight:800;">${safeValue}</span></td>${badgeHtml}</tr></table></td></tr></table>`
}

/**
 * Renders the branded panel email HTML layout (v2 — paleta OguriCap verde/teal/rosa).
 * @param {Object} params
 * @param {string} params.contentHtml - Pre-composed HTML. Caller is responsible for
 *   escaping any user-controlled values. Use escapeHtml() for plain text fragments,
 *   renderDataBlock() for structured data rows.
 */
export function renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText }) {
  const brand = getBrandConfig()
  const safePreheader = escapeHtml(preheader || '')
  const safeTitle = escapeHtml(title || '')
  const safeCtaText = escapeHtml(ctaText || '')
  const safeCtaUrl = sanitizeUrl(ctaUrl)
  const year = new Date().getFullYear()

  const ctaHtml = safeCtaUrl && safeCtaText
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="background:linear-gradient(135deg,#25d366 0%,#2dd4bf 100%);border-radius:12px;box-shadow:0 4px 24px rgba(37,211,102,0.4),0 2px 8px rgba(45,212,191,0.2);"><a href="${safeCtaUrl}" target="_blank" style="display:block;padding:17px;color:#060807;font-size:15px;font-weight:900;text-decoration:none;text-align:center;letter-spacing:0.5px;">${safeCtaText}</a></td></tr></table>`
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
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="34%" height="4" style="background:#25d366;line-height:4px;font-size:0;"></td>
                <td width="33%" height="4" style="background:#2dd4bf;line-height:4px;font-size:0;"></td>
                <td width="33%" height="4" style="background:#ff4d8d;line-height:4px;font-size:0;"></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding:40px 36px 36px;">
                <h1 style="margin:0 0 12px;font-size:32px;font-weight:900;letter-spacing:-1px;line-height:1.1;color:#f2f6f3;">${safeTitle}</h1>
                <div style="height:1px;background:linear-gradient(90deg,rgba(37,211,102,0.4) 0%,rgba(45,212,191,0.2) 50%,transparent 100%);margin:20px 0;"></div>
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

- [ ] **Step 4: Correr todos los tests del renderer**

```bash
node --test test/email-renderer.test.mjs 2>&1 | tail -10
```

Expected: `# pass 21` `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/email/renderer.js test/email-renderer.test.mjs
git commit -m "feat(email): renderer v2 — paleta verde/teal/rosa, renderDataBlock, branding OguriCap"
```

---

## Task 2: Template role-changed

**Files:**
- Create: `lib/email/templates/role-changed.js`
- Create (partial): `test/email-templates-new.test.mjs` (solo el describe de este template)

- [ ] **Step 1: Crear test con describe de role-changed**

```js
// test/email-templates-new.test.mjs
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildRoleChangedEmail } from '../lib/email/templates/role-changed.js'

describe('buildRoleChangedEmail', () => {
  const result = buildRoleChangedEmail({ username: 'María', oldRole: 'Usuario', newRole: 'Admin' })
  test('retorna html, subject, text', () => {
    assert.ok(typeof result.html === 'string')
    assert.ok(typeof result.subject === 'string')
    assert.ok(typeof result.text === 'string')
  })
  test('html contiene newRole', () => assert.ok(result.html.includes('Admin')))
  test('html contiene oldRole', () => assert.ok(result.html.includes('Usuario')))
  test('subject contiene "rol"', () => assert.ok(result.subject.toLowerCase().includes('rol')))
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

Expected: FAIL — `Cannot find module '../lib/email/templates/role-changed.js'`

- [ ] **Step 3: Crear `lib/email/templates/role-changed.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildRoleChangedEmail({ username, oldRole, newRole }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const subject = `Tu rol fue actualizado — ${brand.name}`

  const contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu rol en el panel fue actualizado.</p>` +
    renderDataBlock({ label: 'Rol anterior', value: `🔒 ${String(oldRole || 'Usuario')}`, badgeColor: 'gray' }) +
    renderDataBlock({ label: 'Nuevo rol', value: `🔑 ${String(newRole || 'Usuario')}`, badge: '✓ ACTIVO', badgeColor: 'green' })

  const text =
    `Hola ${String(username || '')},\n\n` +
    `Tu rol fue actualizado.\n\nAnterior: ${String(oldRole || '')}\nNuevo: ${String(newRole || '')}\n\n` +
    `Panel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject,
    preheader: `Tu rol cambió de ${String(oldRole || '')} a ${String(newRole || '')}`,
    title: `Tu rol cambió, ${String(username || '')}`,
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ver mi perfil',
  })

  return { subject, html, text }
}

export async function sendRoleChangedEmail({ to, username, oldRole, newRole }) {
  const { subject, html, text } = buildRoleChangedEmail({ username, oldRole, newRole })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 4: Verificar que los tests pasan**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

Expected: `# pass 4` `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/email/templates/role-changed.js test/email-templates-new.test.mjs
git commit -m "feat(email): add role-changed template"
```

---

## Task 3: Template bot-alert

**Files:**
- Create: `lib/email/templates/bot-alert.js`
- Modify: `test/email-templates-new.test.mjs` (agregar describe)

- [ ] **Step 1: Agregar describe de bot-alert al test**

Agregar al final de `test/email-templates-new.test.mjs`:

```js
import { buildBotAlertEmail } from '../lib/email/templates/bot-alert.js'

describe('buildBotAlertEmail', () => {
  const disconnected = buildBotAlertEmail({ botName: 'OguriBot', status: 'disconnected', reason: 'Timeout' })
  const reconnected  = buildBotAlertEmail({ botName: 'OguriBot', status: 'reconnected' })
  test('disconnected: html contiene botName', () => assert.ok(disconnected.html.includes('OguriBot')))
  test('disconnected: html contiene reason',  () => assert.ok(disconnected.html.includes('Timeout')))
  test('reconnected: html contiene botName',  () => assert.ok(reconnected.html.includes('OguriBot')))
  test('disconnected: subject contiene 🔴',   () => assert.ok(disconnected.subject.includes('🔴')))
  test('reconnected: subject contiene 🟢',    () => assert.ok(reconnected.subject.includes('🟢')))
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

Expected: FAIL en los nuevos tests de bot-alert.

- [ ] **Step 3: Crear `lib/email/templates/bot-alert.js`**

```js
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
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

Expected: `# pass 9` `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/email/templates/bot-alert.js test/email-templates-new.test.mjs
git commit -m "feat(email): add bot-alert template (disconnected/reconnected/error)"
```

---

## Task 4: Template subbot-alert

**Files:**
- Create: `lib/email/templates/subbot-alert.js`
- Modify: `test/email-templates-new.test.mjs`

- [ ] **Step 1: Agregar describe al test**

Agregar al final de `test/email-templates-new.test.mjs`:

```js
import { buildSubbotAlertEmail } from '../lib/email/templates/subbot-alert.js'

describe('buildSubbotAlertEmail', () => {
  const result = buildSubbotAlertEmail({ subbotNumber: '+5491155555555', status: 'disconnected', reason: 'QR expirado' })
  test('retorna html string',           () => assert.ok(typeof result.html === 'string'))
  test('html contiene subbotNumber',    () => assert.ok(result.html.includes('+5491155555555')))
  test('html contiene reason',          () => assert.ok(result.html.includes('QR expirado')))
  test('subject contiene "Subbot"',     () => assert.ok(result.subject.includes('Subbot')))
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

Expected: FAIL — `Cannot find module '../lib/email/templates/subbot-alert.js'`

- [ ] **Step 3: Crear `lib/email/templates/subbot-alert.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

const STATUS_CFG = {
  disconnected: { emoji: '🔴', verb: 'se desconectó', badge: 'DESCONECTADO', badgeColor: 'pink'  },
  reconnected:  { emoji: '🟢', verb: 'reconectado',   badge: 'EN LÍNEA',     badgeColor: 'green' },
}

export function buildSubbotAlertEmail({ subbotNumber, subbotName = '', status, reason = '' }) {
  const brand = getBrandConfig()
  const cfg = STATUS_CFG[status] || STATUS_CFG.disconnected
  const safeNumber = escapeHtml(String(subbotNumber || ''))
  const safeName   = escapeHtml(String(subbotName || ''))
  const displayName = safeName ? `${safeName} (${safeNumber})` : safeNumber
  const subject = `🤖 Subbot ${safeNumber} ${cfg.verb} — ${brand.name}`

  let contentHtml = renderDataBlock({ label: 'Subbot', value: `🤖 ${displayName}`, badge: cfg.badge, badgeColor: cfg.badgeColor })
  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  const text =
    `Subbot ${String(subbotNumber || '')} ${cfg.verb}.\n\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    `\nPanel: ${brand.panelUrl}/subbots`

  const html = renderPanelEmail({
    subject,
    preheader: `Subbot ${String(subbotNumber || '')} ${cfg.verb}`,
    title: `🤖 Subbot ${cfg.verb}`,
    contentHtml,
    ctaUrl: `${brand.panelUrl}/subbots`,
    ctaText: 'Gestionar subbots',
  })

  return { subject, html, text }
}

export async function sendSubbotAlertEmail({ to, subbotNumber, subbotName = '', status, reason = '' }) {
  const { subject, html, text } = buildSubbotAlertEmail({ subbotNumber, subbotName, status, reason })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

Expected: `# pass 13` `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/email/templates/subbot-alert.js test/email-templates-new.test.mjs
git commit -m "feat(email): add subbot-alert template"
```

---

## Task 5: Template aporte-received

**Files:**
- Create: `lib/email/templates/aporte-received.js`
- Modify: `test/email-templates-new.test.mjs`

- [ ] **Step 1: Agregar describe al test**

```js
import { buildAporteReceivedEmail } from '../lib/email/templates/aporte-received.js'

describe('buildAporteReceivedEmail', () => {
  const result = buildAporteReceivedEmail({ username: 'Juan', amount: '$500', concept: 'Mes de octubre', date: '16/05/2026' })
  test('retorna html string',     () => assert.ok(typeof result.html === 'string'))
  test('html contiene amount',    () => assert.ok(result.html.includes('$500')))
  test('html contiene username',  () => assert.ok(result.html.includes('Juan')))
  test('html contiene concept',   () => assert.ok(result.html.includes('Mes de octubre')))
  test('subject contiene "aporte"', () => assert.ok(result.subject.toLowerCase().includes('aporte')))
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

- [ ] **Step 3: Crear `lib/email/templates/aporte-received.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAporteReceivedEmail({ username, amount, concept = '', date = '' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(String(username || ''))
  const safeAmount   = escapeHtml(String(amount || ''))
  const subject = `💚 ¡Recibiste un aporte de ${safeUsername}! — ${brand.name}`

  let contentHtml =
    `<p style="margin:0 0 20px;">¡Buenas noticias! <strong style="color:#f2f6f3;">${safeUsername}</strong> te hizo un aporte.</p>` +
    renderDataBlock({ label: 'De',    value: `👤 ${safeUsername}`, badgeColor: 'teal' }) +
    renderDataBlock({ label: 'Monto', value: `💚 ${safeAmount}`,   badge: 'RECIBIDO', badgeColor: 'green' })

  if (concept) contentHtml += renderDataBlock({ label: 'Concepto', value: escapeHtml(String(concept)), badgeColor: 'gray' })
  if (date)    contentHtml += renderDataBlock({ label: 'Fecha',    value: escapeHtml(String(date)),    badgeColor: 'gray' })

  const text =
    `¡Recibiste un aporte de ${String(username || '')}!\n\n` +
    `Monto: ${String(amount || '')}\n` +
    (concept ? `Concepto: ${concept}\n` : '') +
    (date    ? `Fecha: ${date}\n`    : '') +
    `\nPanel: ${brand.panelUrl}/aportes`

  const html = renderPanelEmail({
    subject,
    preheader: `${String(username || '')} te envió un aporte de ${String(amount || '')}`,
    title: '¡Recibiste un aporte! 💚',
    contentHtml,
    ctaUrl: `${brand.panelUrl}/aportes`,
    ctaText: 'Ver aportes',
  })

  return { subject, html, text }
}

export async function sendAporteReceivedEmail({ to, username, amount, concept = '', date = '' }) {
  const { subject, html, text } = buildAporteReceivedEmail({ username, amount, concept, date })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

Expected: `# pass 18` `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/email/templates/aporte-received.js test/email-templates-new.test.mjs
git commit -m "feat(email): add aporte-received template"
```

---

## Task 6: Template login-new-device

**Files:**
- Create: `lib/email/templates/login-new-device.js`
- Modify: `test/email-templates-new.test.mjs`

- [ ] **Step 1: Agregar describe al test**

```js
import { buildLoginNewDeviceEmail } from '../lib/email/templates/login-new-device.js'

describe('buildLoginNewDeviceEmail', () => {
  const result = buildLoginNewDeviceEmail({ username: 'María', ip: '192.168.1.1', location: 'Buenos Aires', device: 'Chrome' })
  test('retorna html string',             () => assert.ok(typeof result.html === 'string'))
  test('html contiene IP',               () => assert.ok(result.html.includes('192.168.1.1')))
  test('html contiene location',         () => assert.ok(result.html.includes('Buenos Aires')))
  test('html contiene aviso contraseña', () => assert.ok(result.html.includes('contraseña')))
  test('subject contiene "Acceso"',      () => assert.ok(result.subject.includes('Acceso')))
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

- [ ] **Step 3: Crear `lib/email/templates/login-new-device.js`**

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
    renderDataBlock({ label: 'IP', value: escapeHtml(String(ip || '')), badgeColor: 'teal' })

  if (location) contentHtml += renderDataBlock({ label: 'Ubicación',   value: escapeHtml(String(location)), badgeColor: 'gray' })
  if (device)   contentHtml += renderDataBlock({ label: 'Dispositivo', value: escapeHtml(String(device)),   badgeColor: 'gray' })
  if (time)     contentHtml += renderDataBlock({ label: 'Hora',        value: escapeHtml(String(time)),     badgeColor: 'gray' })

  contentHtml += `<p style="margin:20px 0 0;color:#ff4d8d;font-size:13px;font-weight:700;">⚠️ Si no fuiste vos, cambiá tu contraseña de inmediato.</p>`

  const text =
    `Hola ${String(username || '')},\n\n` +
    `Detectamos un acceso desde un dispositivo nuevo.\n\n` +
    `IP: ${String(ip || '')}\n` +
    (location ? `Ubicación: ${location}\n`   : '') +
    (device   ? `Dispositivo: ${device}\n`   : '') +
    (time     ? `Hora: ${time}\n`            : '') +
    `\nSi no fuiste vos, cambiá tu contraseña de inmediato.\nPanel: ${brand.panelUrl}`

  const html = renderPanelEmail({
    subject,
    preheader: `Acceso desde IP ${String(ip || '')} detectado en tu cuenta`,
    title: '🔐 Acceso nuevo detectado',
    contentHtml,
    ctaUrl: `${brand.panelUrl}/configuracion`,
    ctaText: 'Revisar mi cuenta',
  })

  return { subject, html, text }
}

export async function sendLoginNewDeviceEmail({ to, username, ip, location = '', device = '', time = '' }) {
  const { subject, html, text } = buildLoginNewDeviceEmail({ username, ip, location, device, time })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 4: Verificar que todos los tests pasan**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

Expected: `# pass 23` `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/email/templates/login-new-device.js test/email-templates-new.test.mjs
git commit -m "feat(email): add login-new-device template"
```

---

## Task 7: Template account-deleted

**Files:**
- Create: `lib/email/templates/account-deleted.js`
- Modify: `test/email-templates-new.test.mjs`

- [ ] **Step 1: Agregar describe al test**

```js
import { buildAccountDeletedEmail } from '../lib/email/templates/account-deleted.js'

describe('buildAccountDeletedEmail', () => {
  const result = buildAccountDeletedEmail({ username: 'testuser', deletedBy: 'admin', reason: 'Inactividad' })
  test('retorna html string',         () => assert.ok(typeof result.html === 'string'))
  test('html contiene username',      () => assert.ok(result.html.includes('testuser')))
  test('html contiene deletedBy',     () => assert.ok(result.html.includes('admin')))
  test('html contiene reason',        () => assert.ok(result.html.includes('Inactividad')))
  test('sin CTA — no hay href de acceso', () => {
    const r = buildAccountDeletedEmail({ username: 'u', deletedBy: 'sistema' })
    assert.ok(!r.html.includes('Ver mi perfil'))
  })
})
```

- [ ] **Step 2: Verificar que el test falla**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

- [ ] **Step 3: Crear `lib/email/templates/account-deleted.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, renderDataBlock, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export function buildAccountDeletedEmail({ username, deletedBy = 'el sistema', reason = '' }) {
  const brand = getBrandConfig()
  const safeUsername  = escapeHtml(String(username || ''))
  const safeDeletedBy = escapeHtml(String(deletedBy || 'el sistema'))
  const subject = `Tu cuenta en ${brand.name} fue eliminada`

  let contentHtml =
    `<p style="margin:0 0 20px;">Hola <strong style="color:#f2f6f3;">${safeUsername}</strong>, tu cuenta fue eliminada del sistema.</p>` +
    renderDataBlock({ label: 'Eliminado por', value: safeDeletedBy, badgeColor: 'gray' })

  if (reason) contentHtml += renderDataBlock({ label: 'Motivo', value: escapeHtml(String(reason)), badgeColor: 'gray' })

  contentHtml += `<p style="margin:20px 0 0;color:#84968e;font-size:13px;">Si creés que esto fue un error, contactá al equipo.</p>`

  const text =
    `Hola ${String(username || '')},\n\n` +
    `Tu cuenta en ${brand.name} fue eliminada.\n\n` +
    `Eliminado por: ${String(deletedBy || 'el sistema')}\n` +
    (reason ? `Motivo: ${reason}\n` : '') +
    `\nSi creés que fue un error, contactá al equipo.`

  const html = renderPanelEmail({
    subject,
    preheader: 'Tu cuenta fue eliminada del sistema',
    title: '🗑️ Cuenta eliminada',
    contentHtml,
    ctaUrl: '',
    ctaText: '',
  })

  return { subject, html, text }
}

export async function sendAccountDeletedEmail({ to, username, deletedBy = 'el sistema', reason = '' }) {
  const { subject, html, text } = buildAccountDeletedEmail({ username, deletedBy, reason })
  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 4: Verificar que TODOS los tests pasan**

```bash
node --test test/email-templates-new.test.mjs 2>&1 | tail -8
```

Expected: `# pass 28` `# fail 0`

- [ ] **Step 5: Commit**

```bash
git add lib/email/templates/account-deleted.js test/email-templates-new.test.mjs
git commit -m "feat(email): add account-deleted template"
```

---

## Task 8: Wiring — index.js + preview.js + tests finales

**Files:**
- Modify: `lib/email/index.js`
- Modify: `lib/email/preview.js`

- [ ] **Step 1: Agregar exports a `lib/email/index.js`**

Agregar estas líneas al final del archivo (antes de los exports de providers):

```js
export { sendRoleChangedEmail, buildRoleChangedEmail } from './templates/role-changed.js'
export { sendBotAlertEmail, buildBotAlertEmail } from './templates/bot-alert.js'
export { sendSubbotAlertEmail, buildSubbotAlertEmail } from './templates/subbot-alert.js'
export { sendAporteReceivedEmail, buildAporteReceivedEmail } from './templates/aporte-received.js'
export { sendLoginNewDeviceEmail, buildLoginNewDeviceEmail } from './templates/login-new-device.js'
export { sendAccountDeletedEmail, buildAccountDeletedEmail } from './templates/account-deleted.js'
```

- [ ] **Step 2: Verificar que el import unificado funciona**

```bash
node --input-type=module <<'EOF'
import {
  sendRoleChangedEmail, buildRoleChangedEmail,
  sendBotAlertEmail, buildBotAlertEmail,
  sendSubbotAlertEmail, buildSubbotAlertEmail,
  sendAporteReceivedEmail, buildAporteReceivedEmail,
  sendLoginNewDeviceEmail, buildLoginNewDeviceEmail,
  sendAccountDeletedEmail, buildAccountDeletedEmail,
} from './lib/email/index.js'
console.log('✅ 12 exports nuevos cargan correctamente')
EOF
```

Expected: `✅ 12 exports nuevos cargan correctamente`

- [ ] **Step 3: Agregar previews en `lib/email/preview.js`**

Dentro de la función `buildEmailPreview`, agregar 6 casos nuevos al switch **antes del `default`**:

```js
case 'role-changed': {
  const username = 'OguriAdmin'
  const oldRole = 'Usuario'
  const newRole = 'Administrador'
  const { html, subject } = buildRoleChangedEmail({ username, oldRole, newRole })
  return { template: 'role-changed', title: 'Rol Actualizado', subject, recipient: previewTo, html }
}
case 'bot-alert-disconnected': {
  const { html, subject } = buildBotAlertEmail({ botName: 'OguriBot', status: 'disconnected', reason: 'Timeout de conexión', since: '16/05/2026 14:32' })
  return { template: 'bot-alert-disconnected', title: 'Bot Desconectado', subject, recipient: previewTo, html }
}
case 'bot-alert-reconnected': {
  const { html, subject } = buildBotAlertEmail({ botName: 'OguriBot', status: 'reconnected' })
  return { template: 'bot-alert-reconnected', title: 'Bot Reconectado', subject, recipient: previewTo, html }
}
case 'subbot-alert': {
  const { html, subject } = buildSubbotAlertEmail({ subbotNumber: '+5491155555555', subbotName: 'Mac', status: 'disconnected', reason: 'QR expirado' })
  return { template: 'subbot-alert', title: 'Subbot Desconectado', subject, recipient: previewTo, html }
}
case 'aporte-received': {
  const { html, subject } = buildAporteReceivedEmail({ username: 'Juan Pérez', amount: '$2.500', concept: 'Mensualidad mayo 2026', date: '16/05/2026' })
  return { template: 'aporte-received', title: 'Aporte Recibido', subject, recipient: previewTo, html }
}
case 'login-new-device': {
  const { html, subject } = buildLoginNewDeviceEmail({ username: 'OguriAdmin', ip: '190.210.45.123', location: 'Buenos Aires, Argentina', device: 'Chrome 124 / Windows', time: '16/05/2026 14:55' })
  return { template: 'login-new-device', title: 'Acceso Nuevo Dispositivo', subject, recipient: previewTo, html }
}
case 'account-deleted': {
  const { html, subject } = buildAccountDeletedEmail({ username: 'OguriAdmin', deletedBy: 'Admin del sistema', reason: 'Solicitud del usuario' })
  return { template: 'account-deleted', title: 'Cuenta Eliminada', subject, recipient: previewTo, html }
}
```

También agregar los imports de `buildXxxEmail` al top del archivo `preview.js`:

```js
import { buildRoleChangedEmail } from './templates/role-changed.js'
import { buildBotAlertEmail } from './templates/bot-alert.js'
import { buildSubbotAlertEmail } from './templates/subbot-alert.js'
import { buildAporteReceivedEmail } from './templates/aporte-received.js'
import { buildLoginNewDeviceEmail } from './templates/login-new-device.js'
import { buildAccountDeletedEmail } from './templates/account-deleted.js'
```

- [ ] **Step 4: Correr TODOS los tests de la suite completa**

```bash
node --test test/email-config.test.mjs test/email-renderer.test.mjs test/email-service.test.mjs test/email-templates-new.test.mjs 2>&1 | tail -12
```

Expected:
```
# tests 61
# pass  61
# fail  0
```

- [ ] **Step 5: Commit final**

```bash
git add lib/email/index.js lib/email/preview.js
git commit -m "feat(email): wire 6 new templates — index exports + preview cases"
```
