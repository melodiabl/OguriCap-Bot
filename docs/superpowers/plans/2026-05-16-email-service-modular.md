# Email Service Modular — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dividir `lib/email-service.js` en módulos con responsabilidad única bajo `lib/email/`, eliminar el archivo original, y actualizar todos los importadores.

**Architecture:** Entry point `lib/email/index.js` re-exporta todo. Cada concern vive en su propio archivo: `config.js` (SMTP/brand), `renderer.js` (HTML), `providers/smtp.js` (nodemailer), `transport.js` (pool/cache), `service.js` (sendMail/verify), `templates/` (5 archivos), `preview.js`, `broadcast.js`. Sin wrapper de compatibilidad — todos los importadores migran directamente.

**Tech Stack:** Node.js ESM (`import/export`), nodemailer (ya instalado), `node:test` + `node:assert/strict` para tests.

---

## Mapa de archivos

| Acción | Archivo |
|--------|---------|
| Crear | `lib/email/config.js` |
| Crear | `lib/email/renderer.js` |
| Crear | `lib/email/providers/smtp.js` |
| Crear | `lib/email/providers/index.js` |
| Crear | `lib/email/transport.js` |
| Crear | `lib/email/service.js` |
| Crear | `lib/email/templates/registration.js` |
| Crear | `lib/email/templates/password-reset.js` |
| Crear | `lib/email/templates/welcome.js` |
| Crear | `lib/email/templates/notification.js` |
| Crear | `lib/email/templates/security-alert.js` |
| Crear | `lib/email/preview.js` |
| Crear | `lib/email/broadcast.js` |
| Crear | `lib/email/index.js` |
| Crear | `test/email-config.test.mjs` |
| Crear | `test/email-renderer.test.mjs` |
| Crear | `test/email-service.test.mjs` |
| Modificar | `lib/notification-system.js:3` |
| Modificar | `lib/task-scheduler.js:470` |
| Modificar | `api/routes/config.js:264,273,284,296` |
| Modificar | `api/routes/auth.js:88,167,194` |
| Modificar | `api/routes/broadcast.js:68,89,101,112,121` |
| Eliminar | `lib/email-service.js` |

---

## Task 1: `lib/email/config.js`

**Files:**
- Create: `lib/email/config.js`
- Test: `test/email-config.test.mjs`

- [ ] **Step 1: Escribir el test primero**

```js
// test/email-config.test.mjs
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

describe('getSmtpMode', () => {
  const { getSmtpMode } = await import('../lib/email/config.js')

  test('puerto 465 → implicit-tls', () => {
    assert.equal(getSmtpMode({ port: 465, secure: false }), 'implicit-tls')
  })
  test('secure true + puerto 587 → starttls', () => {
    assert.equal(getSmtpMode({ port: 587, secure: true }), 'starttls')
  })
  test('sin secure ni 465 → plain', () => {
    assert.equal(getSmtpMode({ port: 587, secure: false }), 'plain')
  })
  test('config null → plain', () => {
    assert.equal(getSmtpMode(null), 'plain')
  })
})

describe('getSmtpWarnings', () => {
  const { getSmtpWarnings } = await import('../lib/email/config.js')

  test('null config → aviso de host', () => {
    const w = getSmtpWarnings(null)
    assert.ok(w.length > 0)
    assert.ok(w[0].includes('host'))
  })
  test('sin credenciales → aviso', () => {
    const w = getSmtpWarnings({ host: 'smtp.test.com', port: 587, secure: false, user: '', pass: '' })
    assert.ok(w.some(m => m.includes('credenciales')))
  })
  test('config completa → sin warnings de credenciales', () => {
    const w = getSmtpWarnings({ host: 'h', port: 587, secure: false, user: 'u', pass: 'p', replyTo: 'r@r.com' })
    assert.ok(!w.some(m => m.includes('credenciales')))
  })
})

describe('getSmtpTransportHint', () => {
  const { getSmtpTransportHint } = await import('../lib/email/config.js')

  test('null → mensaje de configurar', () => {
    assert.ok(getSmtpTransportHint(null).includes('Configura'))
  })
  test('465 → TLS implícito', () => {
    assert.ok(getSmtpTransportHint({ port: 465, secure: false }).includes('TLS'))
  })
})

describe('getBrandConfig', () => {
  const { getBrandConfig } = await import('../lib/email/config.js')

  test('retorna objeto con keys requeridas', () => {
    const b = getBrandConfig()
    assert.ok(b.panelUrl)
    assert.ok(b.name)
    assert.ok(b.product)
    assert.ok(b.background)
    assert.ok(b.card)
  })
})
```

- [ ] **Step 2: Ejecutar el test — debe fallar (archivo no existe)**

```bash
node --test test/email-config.test.mjs 2>&1 | head -10
```
Esperado: error de módulo no encontrado.

- [ ] **Step 3: Crear `lib/email/config.js`**

```js
import fs from 'fs'
import path from 'path'

function readPanelSmtpConfig() {
  try {
    const mainConfigPath = path.join(process.cwd(), '.config', 'main.json')
    if (!fs.existsSync(mainConfigPath)) return null
    const raw = fs.readFileSync(mainConfigPath, 'utf8')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const emailCfg = parsed?.notifications?.email || null
    const smtpCfg = emailCfg?.smtp || null
    if (!smtpCfg || typeof smtpCfg !== 'object') return null
    return {
      enabled: emailCfg?.enabled,
      host: String(smtpCfg.host || '').trim(),
      port: smtpCfg.port,
      secure: typeof smtpCfg.secure === 'boolean' ? smtpCfg.secure : null,
      user: String(smtpCfg.user || '').trim(),
      pass: String(smtpCfg.pass || '').replace(/\s+/g, '').trim(),
      from: String(smtpCfg.from || '').trim(),
      replyTo: String(smtpCfg.replyTo || '').trim(),
    }
  } catch {
    return null
  }
}

export function getSmtpConfig() {
  const panelSmtp = readPanelSmtpConfig()
  const host = (panelSmtp?.host || process.env.SMTP_HOST || '').trim()
  const panelPortRaw = panelSmtp?.port == null ? '' : String(panelSmtp.port).trim()
  const envPortRaw = String(process.env.SMTP_PORT || '').trim()
  const port = Number(panelPortRaw || envPortRaw || 587)
  const envSecureRaw = String(process.env.SMTP_SECURE || '').trim().toLowerCase()
  const secure = typeof panelSmtp?.secure === 'boolean'
    ? panelSmtp.secure
    : envSecureRaw
      ? ['1', 'true', 'yes'].includes(envSecureRaw)
      : false
  const user = (panelSmtp?.user || process.env.SMTP_USER || '').trim()
  const pass = String(panelSmtp?.pass || process.env.SMTP_PASS || '').replace(/\s+/g, '').trim()
  const from = (panelSmtp?.from || process.env.SMTP_FROM || user || '').trim()
  const replyTo = (panelSmtp?.replyTo || process.env.SMTP_REPLY_TO || '').trim()
  if (!host) return null
  if (!Number.isFinite(port) || port <= 0) return null
  if (!from) return null
  return { host, port, secure, user, pass, from, replyTo }
}

export function getBrandConfig() {
  const panelUrl = (process.env.PANEL_URL || '').trim() || 'https://melodiaauris.qzz.io'
  const primary = (process.env.EMAIL_BRAND_PRIMARY || '').trim() || '#6366f1'
  const secondary = (process.env.EMAIL_BRAND_SECONDARY || '').trim() || '#7c3aed'
  const background = (process.env.EMAIL_BRAND_BG || '').trim() || '#0b1020'
  const card = (process.env.EMAIL_BRAND_CARD || '').trim() || '#111827'
  const name = (process.env.EMAIL_BRAND_NAME || '').trim() || 'Oguri Bot'
  const product = (process.env.EMAIL_BRAND_PRODUCT || '').trim() || 'Panel'
  return { panelUrl, primary, secondary, background, card, name, product }
}

export function getSmtpMode(config) {
  const port = Number(config?.port || 0)
  const wantsTls = Boolean(config?.secure)
  if (port === 465) return 'implicit-tls'
  if (wantsTls) return 'starttls'
  return 'plain'
}

export function getSmtpWarnings(config) {
  if (!config) return ['Configura el host SMTP para activar los correos.']
  const warnings = []
  const port = Number(config.port || 0)
  if (!config.user || !config.pass) warnings.push('Faltan credenciales SMTP para autenticación.')
  if (port === 465 && !config.secure) warnings.push('Puerto 465 detectado: conviene activar el modo seguro.')
  if (port === 587 && config.secure) warnings.push('Puerto 587 detectado: se usará STARTTLS automáticamente.')
  if (!config.replyTo) warnings.push('No definiste Reply-To; se usará el remitente por defecto.')
  return warnings
}

export function getSmtpTransportHint(config) {
  if (!config) return 'Configura el SMTP para ver recomendaciones.'
  const mode = getSmtpMode(config)
  if (mode === 'implicit-tls') return 'TLS implícito sobre 465.'
  if (mode === 'starttls') return 'STARTTLS sobre 587 o puerto similar.'
  return 'Conexión sin TLS explícito. Verifica si tu proveedor exige STARTTLS.'
}
```

- [ ] **Step 4: Ejecutar el test — debe pasar**

```bash
node --test test/email-config.test.mjs
```
Esperado: todos los tests en verde, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/email/config.js test/email-config.test.mjs
git commit -m "feat(email): add lib/email/config.js with smtp/brand config helpers"
```

---

## Task 2: `lib/email/renderer.js`

**Files:**
- Create: `lib/email/renderer.js`
- Test: `test/email-renderer.test.mjs`

- [ ] **Step 1: Escribir el test**

```js
// test/email-renderer.test.mjs
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, renderPanelEmail } from '../lib/email/renderer.js'

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
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

```bash
node --test test/email-renderer.test.mjs 2>&1 | head -10
```

- [ ] **Step 3: Crear `lib/email/renderer.js`**

```js
import { getBrandConfig } from './config.js'

export function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
  return String(text || '').replace(/[&<>"']/g, m => map[m])
}

export function renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText }) {
  const brand = getBrandConfig()
  const safePreheader = escapeHtml(preheader || '')
  const safeTitle = escapeHtml(title || '')
  const safeCtaText = escapeHtml(ctaText || '')
  const safeCtaUrl = String(ctaUrl || '').trim()

  const oguriPurple = '#5b3dad'
  const oguriLavender = '#b7a6e6'
  const oguriSilver = '#cbd5e1'

  return `
<!doctype html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:${brand.background};font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <div style="display:none;font-size:1px;color:transparent;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${safePreheader}
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${brand.background};">
      <tr>
        <td align="center" style="padding: 40px 10px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;border-collapse:separate;">
            <tr>
              <td style="padding-bottom: 20px; text-align: left;">
                <span style="color:${oguriSilver}; font-weight: 800; font-size: 20px; letter-spacing: -0.5px;">
                  <span style="color:${oguriPurple};">✦</span> ${brand.name.toUpperCase()}
                </span>
              </td>
            </tr>

            <tr>
              <td style="background-color:${brand.card}; border: 1px solid #2d3748; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                  <tr>
                    <td width="33.3%" height="4" style="background-color:${oguriPurple};"></td>
                    <td width="33.3%" height="4" style="background-color:${oguriSilver};"></td>
                    <td width="33.3%" height="4" style="background-color:${oguriLavender};"></td>
                  </tr>
                  <tr>
                    <td colspan="3" style="padding: 40px 30px;">
                      <h1 style="margin: 0 0 20px 0; color: #ffffff; font-size: 28px; font-weight: 800; line-height: 1.2;">
                        ${safeTitle}
                      </h1>
                      <div style="color: ${oguriSilver}; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                        ${contentHtml}
                      </div>

                      ${safeCtaUrl && safeCtaText ? `
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="border-radius: 8px; background-color: ${oguriPurple};">
                            <a href="${safeCtaUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
                              ${safeCtaText}
                            </a>
                          </td>
                        </tr>
                      </table>
                      ` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding-top: 30px; text-align: center;">
                <p style="margin: 0; color: #718096; font-size: 13px;">
                  &copy; ${new Date().getFullYear()} ${brand.name} &bull; El Monstruo de las Cenizas
                </p>
                <p style="margin: 10px 0 0 0; color: #4a5568; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
                  Powered by Oguri Power System
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim()
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

```bash
node --test test/email-renderer.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add lib/email/renderer.js test/email-renderer.test.mjs
git commit -m "feat(email): add lib/email/renderer.js with escapeHtml and renderPanelEmail"
```

---

## Task 3: `lib/email/providers/`

**Files:**
- Create: `lib/email/providers/smtp.js`
- Create: `lib/email/providers/index.js`

- [ ] **Step 1: Crear `lib/email/providers/smtp.js`**

```js
import { getSmtpMode } from '../config.js'

export class SmtpProvider {
  constructor(config) {
    this.config = config
  }

  getMode() {
    return getSmtpMode(this.config)
  }

  buildOptions() {
    const config = this.config
    const port = Number(config.port || 0)
    const auth = config.user && config.pass ? { user: config.user, pass: config.pass } : undefined
    const mode = this.getMode()

    const options = {
      host: config.host,
      port,
      secure: mode === 'implicit-tls',
      auth,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 5,
    }

    if (mode === 'starttls') options.requireTLS = true
    return options
  }

  async createTransporter() {
    const { default: nodemailer } = await import('nodemailer')
    return nodemailer.createTransport(this.buildOptions())
  }

  normalizeError(error) {
    const message = String(error?.message || error || '').trim()
    if (/wrong version number/i.test(message)) {
      return 'TLS/puerto incompatibles. Usa puerto 465 con seguro activado, o 587 con STARTTLS.'
    }
    return message || 'SMTP error'
  }
}
```

- [ ] **Step 2: Crear `lib/email/providers/index.js`**

```js
import { getSmtpConfig } from '../config.js'
import { SmtpProvider } from './smtp.js'

export function getActiveProvider() {
  const config = getSmtpConfig()
  if (!config) return null
  return new SmtpProvider(config)
}
```

- [ ] **Step 3: Verificar que los módulos se importan sin error**

```bash
node --input-type=module -e "
import { getActiveProvider } from './lib/email/providers/index.js'
import { SmtpProvider } from './lib/email/providers/smtp.js'
console.log('providers ok:', typeof getActiveProvider, typeof SmtpProvider)
"
```
Esperado: `providers ok: function function`

- [ ] **Step 4: Commit**

```bash
git add lib/email/providers/smtp.js lib/email/providers/index.js
git commit -m "feat(email): add providers/smtp.js (SmtpProvider) and providers/index.js"
```

---

## Task 4: `lib/email/transport.js`

**Files:**
- Create: `lib/email/transport.js`

- [ ] **Step 1: Crear `lib/email/transport.js`**

```js
import { getActiveProvider } from './providers/index.js'

let cache = { key: '', promise: null }

export function resetTransporterCache() {
  const previous = cache.promise
  cache = { key: '', promise: null }
  if (previous) {
    previous.then(t => t?.close?.()).catch(() => {})
  }
}

export async function getTransporter({ forceRefresh = false } = {}) {
  const provider = getActiveProvider()
  if (!provider) {
    resetTransporterCache()
    return null
  }

  const cacheKey = JSON.stringify(provider.config)

  if (forceRefresh || cache.key !== cacheKey || !cache.promise) {
    if (cache.key && cache.key !== cacheKey) resetTransporterCache()
    cache = {
      key: cacheKey,
      promise: provider.createTransporter().catch(err => {
        console.error('❌ Error al cargar nodemailer:', err.message)
        cache = { key: '', promise: null }
        return null
      }),
    }
  }

  return cache.promise
}
```

- [ ] **Step 2: Verificar importación**

```bash
node --input-type=module -e "
import { getTransporter, resetTransporterCache } from './lib/email/transport.js'
console.log('transport ok:', typeof getTransporter, typeof resetTransporterCache)
"
```
Esperado: `transport ok: function function`

- [ ] **Step 3: Commit**

```bash
git add lib/email/transport.js
git commit -m "feat(email): add lib/email/transport.js with nodemailer pool/cache"
```

---

## Task 5: `lib/email/service.js`

**Files:**
- Create: `lib/email/service.js`
- Test: `test/email-service.test.mjs`

- [ ] **Step 1: Escribir el test**

```js
// test/email-service.test.mjs
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRecipients, getEmailServiceStatus } from '../lib/email/service.js'

describe('normalizeRecipients', () => {
  test('filtra emails inválidos', () => {
    const result = normalizeRecipients(['valid@test.com', 'invalid', 'also@valid.org'])
    assert.deepEqual(result, ['valid@test.com', 'also@valid.org'])
  })
  test('acepta string único', () => {
    assert.deepEqual(normalizeRecipients('a@b.com'), ['a@b.com'])
  })
  test('deduplica', () => {
    assert.deepEqual(normalizeRecipients(['a@b.com', 'a@b.com']), ['a@b.com'])
  })
  test('separa por coma', () => {
    assert.deepEqual(normalizeRecipients('a@b.com,c@d.com'), ['a@b.com', 'c@d.com'])
  })
  test('ignora null/undefined', () => {
    assert.deepEqual(normalizeRecipients([null, undefined, 'good@email.com']), ['good@email.com'])
  })
  test('array vacío → array vacío', () => {
    assert.deepEqual(normalizeRecipients([]), [])
  })
})

describe('getEmailServiceStatus', () => {
  test('retorna objeto con keys esperadas', () => {
    const status = getEmailServiceStatus()
    assert.ok('configured' in status)
    assert.ok('warnings' in status)
    assert.ok('brand' in status)
    assert.ok(Array.isArray(status.warnings))
    assert.ok(typeof status.brand.name === 'string')
  })
  test('configured es boolean', () => {
    assert.equal(typeof getEmailServiceStatus().configured, 'boolean')
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

```bash
node --test test/email-service.test.mjs 2>&1 | head -10
```

- [ ] **Step 3: Crear `lib/email/service.js`**

```js
import { getSmtpConfig, getSmtpMode, getSmtpWarnings, getSmtpTransportHint, getBrandConfig } from './config.js'
import { getTransporter } from './transport.js'
import { getActiveProvider } from './providers/index.js'

function isValidEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())
}

export function normalizeRecipients(to) {
  const list = Array.isArray(to) ? to : [to]
  return list
    .flatMap(item => String(item || '').split(','))
    .map(email => email.trim())
    .filter((email, index, arr) => email && isValidEmailAddress(email) && arr.indexOf(email) === index)
}

function getSecurityAlertRecipients() {
  return normalizeRecipients([
    process.env.SECURITY_ALERT_EMAIL_TO,
    process.env.NOTIFICATION_EMAIL,
    process.env.ADMIN_EMAIL,
    process.env.SMTP_REPLY_TO,
    process.env.SMTP_USER,
  ])
}

export async function sendMail({ to, subject, html, text }) {
  const config = getSmtpConfig()
  if (!config) {
    console.warn('⚠️ SMTP no configurado, email no enviado')
    return { ok: false, skipped: true, reason: 'SMTP not configured' }
  }

  const transporter = await getTransporter()
  if (!transporter) {
    console.error('❌ Transporter SMTP no disponible')
    return { ok: false, skipped: true, reason: 'SMTP transporter unavailable' }
  }

  const validRecipients = normalizeRecipients(to)
  if (!validRecipients.length) {
    console.error('❌ No hay destinatarios válidos')
    return { ok: false, skipped: false, reason: 'Invalid recipients' }
  }

  const message = {
    from: config.from,
    to: validRecipients.join(', '),
    subject: subject || 'Notificación de Oguri Bot',
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    headers: {
      'X-Mailer': 'Oguri-Bot-Panel',
      'X-Priority': '3',
      'Importance': 'Normal',
    },
  }

  try {
    const info = await transporter.sendMail(message)
    console.log(`✅ Email enviado: ${info.messageId}`)
    return { ok: true, info, messageId: info.messageId }
  } catch (error) {
    const provider = getActiveProvider()
    const normalizedError = provider?.normalizeError(error) ?? String(error?.message || '')
    console.error('❌ Error al enviar email:', normalizedError)
    return { ok: false, skipped: false, reason: 'SMTP send failed', error: normalizedError, raw: String(error?.message || '') }
  }
}

export async function verifySmtp() {
  const config = getSmtpConfig()
  if (!config) return { ok: false, reason: 'SMTP not configured' }

  const transporter = await getTransporter({ forceRefresh: true })
  if (!transporter) return { ok: false, reason: 'Failed to create transporter' }

  try {
    await transporter.verify()
    return { ok: true, mode: getSmtpMode(config) }
  } catch (error) {
    const provider = getActiveProvider()
    const reason = provider?.normalizeError(error) ?? String(error?.message || '')
    return { ok: false, reason, raw: String(error?.message || '') }
  }
}

export async function sendTestEmail({ to = null } = {}) {
  const config = getSmtpConfig()
  if (!config) return { ok: false, skipped: true, reason: 'SMTP not configured' }

  const { renderPanelEmail, escapeHtml } = await import('./renderer.js')
  const brand = getBrandConfig()
  const recipient = to || config.user || config.from
  if (!recipient) return { ok: false, reason: 'No test recipient available' }

  const subject = `Prueba de configuración - ${brand.name}`
  const contentHtml = `
    Este es un mensaje de prueba enviado desde tu panel para confirmar que la configuración SMTP es correcta.<br /><br />
    Tu bot ahora puede enviar notificaciones, reportes y correos de seguridad a <strong style="color:#ffffff;">${escapeHtml(recipient)}</strong>.
  `.trim()

  const text =
    `¡Servicio de Email Activo! - ${brand.name}\n\n` +
    `Este es un mensaje de prueba para confirmar que la configuración SMTP funciona correctamente.\n` +
    `Destinatario: ${recipient}`

  const html = renderPanelEmail({
    subject,
    preheader: 'Mensaje de prueba del sistema.',
    title: '¡Servicio de Email Activo!',
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ir al panel',
  })

  return sendMail({ to: recipient, subject, html, text })
}

export function getEmailServiceStatus() {
  const config = getSmtpConfig()
  const brand = getBrandConfig()
  const warnings = getSmtpWarnings(config)

  return {
    configured: !!config,
    host: config?.host || null,
    port: config?.port || null,
    mode: config ? getSmtpMode(config) : null,
    hasAuth: Boolean(config?.user && config?.pass),
    user: config?.user || null,
    from: config?.from || null,
    replyTo: config?.replyTo || null,
    transportHint: getSmtpTransportHint(config),
    warnings,
    securityRecipients: getSecurityAlertRecipients(),
    brand: {
      name: brand.name,
      product: brand.product,
      panelUrl: brand.panelUrl,
    },
  }
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

```bash
node --test test/email-service.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add lib/email/service.js test/email-service.test.mjs
git commit -m "feat(email): add lib/email/service.js with sendMail, verifySmtp, getEmailServiceStatus"
```

---

## Task 6: `lib/email/templates/`

**Files:**
- Create: `lib/email/templates/registration.js`
- Create: `lib/email/templates/password-reset.js`
- Create: `lib/email/templates/welcome.js`
- Create: `lib/email/templates/notification.js`
- Create: `lib/email/templates/security-alert.js`

- [ ] **Step 1: Crear `lib/email/templates/registration.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendRegistrationEmail({ to, username }) {
  const brand = getBrandConfig()
  const safeUsername = typeof username === 'string' ? username.trim() : ''
  const subject = '¡Bienvenido a Oguri Bot! - Registro exitoso'

  const text =
    `Hola${safeUsername ? ` ${safeUsername}` : ''},\n\n` +
    `¡Tu cuenta fue creada correctamente en ${brand.name}!\n\n` +
    `Tu rol: Usuario\n\n` +
    `Ingresá al panel: ${brand.panelUrl}\n\n` +
    `Si vos no hiciste este registro, podés ignorar este email de forma segura.\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    Hola${safeUsername ? ` <strong style="color:#ffffff;">${escapeHtml(safeUsername)}</strong>` : ''}, ¡tu cuenta fue creada correctamente!<br /><br />
    <span style="color:#e2e8f0;">Tu rol: <strong style="color:#ffffff;">Usuario</strong></span><br /><br />
    Ya podés acceder al panel y comenzar a usar todas las funcionalidades del bot.
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: 'Tu cuenta fue creada correctamente.',
    title: '¡Bienvenido a Oguri Bot!',
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ir al panel',
  })

  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 2: Crear `lib/email/templates/password-reset.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendPasswordResetEmail({ to, username, token, expiresMinutes = 30 }) {
  const brand = getBrandConfig()
  const safeUsername = typeof username === 'string' ? username.trim() : ''
  const safeToken = String(token || '').trim()
  const resetUrl = `${brand.panelUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(safeToken)}`
  const subject = 'Restablecer contraseña - Oguri Bot'

  const text =
    `Hola${safeUsername ? ` ${safeUsername}` : ''},\n\n` +
    `Recibimos una solicitud para restablecer tu contraseña.\n\n` +
    `Abrí este link para crear una nueva contraseña (vence en ${expiresMinutes} minutos):\n${resetUrl}\n\n` +
    `Si vos no pediste esto, ignorá este email y tu contraseña no cambiará.\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    Hola${safeUsername ? ` <strong style="color:#ffffff;">${escapeHtml(safeUsername)}</strong>` : ''}.<br /><br />
    Recibimos una solicitud para restablecer tu contraseña.<br /><br />
    <strong style="color:#ffffff;">Este link vence en ${expiresMinutes} minutos.</strong><br /><br />
    Si no solicitaste este cambio, simplemente ignorá este email y tu contraseña permanecerá sin cambios.
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: `Restablecé tu contraseña (vence en ${expiresMinutes} min)`,
    title: 'Restablecer contraseña',
    contentHtml,
    ctaUrl: resetUrl,
    ctaText: 'Restablecer contraseña',
  })

  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 3: Crear `lib/email/templates/welcome.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendWelcomeEmail({ to, username, role = 'Usuario' }) {
  const brand = getBrandConfig()
  const safeUsername = escapeHtml(username || '')
  const safeRole = escapeHtml(role || 'Usuario')
  const subject = `¡Bienvenido al equipo de ${brand.name}!`

  const text =
    `Hola ${username},\n\n` +
    `¡Bienvenido al equipo de ${brand.name}!\n\n` +
    `Tu cuenta ha sido creada con el rol: ${role}\n\n` +
    `Accedé al panel: ${brand.panelUrl}\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const contentHtml = `
    Hola <strong style="color:#ffffff;">${safeUsername}</strong>,<br /><br />
    ¡Bienvenido al equipo de <strong style="color:#ffffff;">${escapeHtml(brand.name)}</strong>!<br /><br />
    Tu cuenta ha sido creada exitosamente con el rol: <strong style="color:#10b981;">${safeRole}</strong><br /><br />
    Ya podés acceder al panel de administración y comenzar a gestionar el bot.
  `.trim()

  const html = renderPanelEmail({
    subject,
    preheader: 'Tu cuenta ha sido creada exitosamente.',
    title: '¡Bienvenido al equipo!',
    contentHtml,
    ctaUrl: brand.panelUrl,
    ctaText: 'Acceder al panel',
  })

  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 4: Crear `lib/email/templates/notification.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendNotificationEmail({ to, title, message, priority = 'normal' }) {
  const brand = getBrandConfig()
  const rawTitle = String(title || 'Notificación')
  const rawMessage = String(message || '')
  const safeTitle = escapeHtml(rawTitle)
  const safeMessage = escapeHtml(rawMessage)
  const subject = `${brand.name} - ${rawTitle}`

  const priorityEmoji = { low: 'ℹ️', normal: '📢', high: '⚠️', critical: '🚨' }

  const text =
    `${priorityEmoji[priority] || '📢'} ${rawTitle}\n\n` +
    `${rawMessage}\n\n` +
    `Panel: ${brand.panelUrl}\n\n` +
    `Saludos,\nEl equipo de ${brand.name}`

  const html = renderPanelEmail({
    subject,
    preheader: rawMessage.slice(0, 100),
    title: safeTitle,
    contentHtml: safeMessage,
    ctaUrl: brand.panelUrl,
    ctaText: 'Ver en el panel',
  })

  return sendMail({ to, subject, html, text })
}
```

- [ ] **Step 5: Crear `lib/email/templates/security-alert.js`**

```js
import { getBrandConfig } from '../config.js'
import { renderPanelEmail, escapeHtml } from '../renderer.js'
import { sendMail } from '../service.js'

export async function sendSecurityAlertEmail({ to, subject, title, message, details = [], ctaUrl = '', ctaText = '' }) {
  const brand = getBrandConfig()
  const safeSubject = String(subject || 'Alerta de seguridad').trim() || 'Alerta de seguridad'
  const rawTitle = String(title || safeSubject).trim() || safeSubject
  const safeMessage = escapeHtml(message || '')

  const detailRows = Array.isArray(details)
    ? details
        .map(item => {
          const label = escapeHtml(item?.label || '')
          const value = escapeHtml(item?.value || '-')
          if (!label) return ''
          return `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">${label}</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">${value}</td></tr>`
        })
        .filter(Boolean)
        .join('')
    : ''

  const contentHtml = `
    <p style="margin:0 0 16px 0;">${safeMessage}</p>
    ${detailRows ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:8px;">${detailRows}</table>` : ''}
  `.trim()

  const textDetails = Array.isArray(details)
    ? details
        .map(item => {
          const label = String(item?.label || '').trim()
          const value = String(item?.value || '-').trim()
          return label ? `${label}: ${value}` : ''
        })
        .filter(Boolean)
        .join('\n')
    : ''

  const text = [message || '', textDetails, brand.panelUrl ? `Panel: ${brand.panelUrl}` : ''].filter(Boolean).join('\n\n')

  const html = renderPanelEmail({
    subject: safeSubject,
    preheader: message || 'Revisa este evento en el panel.',
    title: rawTitle,
    contentHtml,
    ctaUrl: ctaUrl || brand.panelUrl,
    ctaText: ctaText || 'Abrir panel',
  })

  return sendMail({ to, subject: safeSubject, html, text })
}
```

- [ ] **Step 6: Verificar que los 5 templates importan sin error**

```bash
node --input-type=module -e "
const mods = await Promise.all([
  import('./lib/email/templates/registration.js'),
  import('./lib/email/templates/password-reset.js'),
  import('./lib/email/templates/welcome.js'),
  import('./lib/email/templates/notification.js'),
  import('./lib/email/templates/security-alert.js'),
])
console.log('templates ok:', mods.map(m => Object.keys(m)).flat().join(', '))
"
```
Esperado: lista con los 5 nombres de función exportados.

- [ ] **Step 7: Commit**

```bash
git add lib/email/templates/
git commit -m "feat(email): add 5 email templates (registration, password-reset, welcome, notification, security-alert)"
```

---

## Task 7: `lib/email/preview.js`

**Files:**
- Create: `lib/email/preview.js`

- [ ] **Step 1: Crear `lib/email/preview.js`**

```js
import { getBrandConfig } from './config.js'
import { renderPanelEmail, escapeHtml } from './renderer.js'

function buildEmailPreview(template = 'test') {
  const brand = getBrandConfig()
  const previewTo = 'admin@ejemplo.com'

  switch (template) {
    case 'welcome': {
      const username = 'OguriAdmin'
      const role = 'Owner'
      const subject = `¡Bienvenido al equipo de ${brand.name}!`
      const contentHtml = `
        Hola <strong style="color:#ffffff;">${escapeHtml(username)}</strong>,<br /><br />
        ¡Bienvenido al equipo de <strong style="color:#ffffff;">${escapeHtml(brand.name)}</strong>!<br /><br />
        Tu cuenta ha sido creada exitosamente con el rol: <strong style="color:#10b981;">${escapeHtml(role)}</strong><br /><br />
        Ya podés acceder al panel de administración y comenzar a gestionar el bot.
      `.trim()
      return {
        template: 'welcome', title: 'Bienvenida', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'Tu cuenta ha sido creada exitosamente.', title: '¡Bienvenido al equipo!', contentHtml, ctaUrl: brand.panelUrl, ctaText: 'Acceder al panel' }),
      }
    }
    case 'role_updated': {
      const username = 'Juan Pérez'
      const oldRole = 'Usuario'
      const newRole = 'Administrador'
      const subject = `Tu rol ha cambiado en ${brand.name}`
      const contentHtml = `
        Hola <strong style="color:#ffffff;">${escapeHtml(username)}</strong>,<br /><br />
        Tu rol ha sido actualizado.<br /><br />
        Anterior: <strong style="color:#94a3b8;">${escapeHtml(oldRole)}</strong><br />
        Nuevo: <strong style="color:#10b981;">${escapeHtml(newRole)}</strong><br /><br />
        Ya podes acceder a las nuevas funcionalidades del panel.
      `.trim()
      return {
        template: 'role_updated', title: 'Rol Actualizado', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'Tu rol ha sido actualizado.', title: 'Rol Actualizado', contentHtml, ctaUrl: brand.panelUrl, ctaText: 'Ver perfil' }),
      }
    }
    case 'subbot_disconnected': {
      const subbotCode = '+5491155555555'
      const reason = 'Sesion cerrada'
      const subject = `Subbot desconectado - ${brand.name}`
      const contentHtml = `
        Hola <strong style="color:#ffffff;">Admin</strong>,<br /><br />
        Un subbot se ha desconectado.<br /><br />
        Numero: <strong style="color:#ffffff;">${escapeHtml(subbotCode)}</strong><br />
        Razon: <strong style="color:#94a3b8;">${escapeHtml(reason)}</strong><br /><br />
        Podes volver a conectarlo desde el panel.
      `.trim()
      return {
        template: 'subbot_disconnected', title: 'Subbot Desconectado', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'Un subbot se ha desconectado.', title: 'Subbot Desconectado', contentHtml, ctaUrl: `${brand.panelUrl}/subbots`, ctaText: 'Ver subbots' }),
      }
    }
    case 'password-reset': {
      const username = 'OguriAdmin'
      const token = 'preview-reset-token'
      const expiresMinutes = 30
      const resetUrl = `${brand.panelUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(token)}`
      const subject = 'Restablecer contraseña - Oguri Bot'
      const contentHtml = `
        Hola <strong style="color:#ffffff;">${escapeHtml(username)}</strong>.<br /><br />
        Recibimos una solicitud para restablecer tu contraseña.<br /><br />
        <strong style="color:#ffffff;">Este link vence en ${expiresMinutes} minutos.</strong><br /><br />
        Si no solicitaste este cambio, simplemente ignorá este email y tu contraseña permanecerá sin cambios.
      `.trim()
      return {
        template: 'password-reset', title: 'Password Reset', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: `Restablecé tu contraseña (vence en ${expiresMinutes} min)`, title: 'Restablecer contraseña', contentHtml, ctaUrl: resetUrl, ctaText: 'Restablecer contraseña' }),
      }
    }
    case 'security-alert': {
      const subject = 'Alerta de seguridad'
      return {
        template: 'security-alert', title: 'Alerta de seguridad', subject, recipient: previewTo,
        html: renderPanelEmail({
          subject, preheader: 'Revisa este evento en el panel.', title: 'Login sospechoso detectado',
          contentHtml: `
            <p style="margin:0 0 16px 0;">Se detectó un intento de acceso fuera del patrón habitual. Revisa la actividad reciente.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border-top:1px solid rgba(255,255,255,0.08);margin-top:16px;padding-top:8px;">
              <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">IP</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">181.23.44.10</td></tr>
              <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">Fecha</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">12/04/2026 21:14</td></tr>
              <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top;width:140px;">Actor</td><td style="padding:8px 0;color:#ffffff;font-size:13px;font-weight:600;">oguri-owner</td></tr>
            </table>
          `.trim(),
          ctaUrl: brand.panelUrl, ctaText: 'Abrir panel',
        }),
      }
    }
    case 'notification': {
      const subject = `${brand.name} - Notificación del sistema`
      return {
        template: 'notification', title: 'Notificación', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'El sistema generó una notificación importante.', title: 'Notificación del sistema', contentHtml: 'Se completó una tarea programada y el panel registró la actividad correctamente.', ctaUrl: brand.panelUrl, ctaText: 'Ver en el panel' }),
      }
    }
    case 'registration': {
      const subject = '¡Bienvenido a Oguri Bot! - Registro exitoso'
      return {
        template: 'registration', title: 'Registro exitoso', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'Tu cuenta fue creada correctamente.', title: '¡Bienvenido a Oguri Bot!', contentHtml: `Hola <strong style="color:#ffffff;">NuevoUsuario</strong>, ¡tu cuenta fue creada correctamente!<br /><br /><span style="color:#e2e8f0;">Tu rol: <strong style="color:#ffffff;">Usuario</strong></span><br /><br />Ya podés acceder al panel y comenzar a usar todas las funcionalidades del bot.`, ctaUrl: brand.panelUrl, ctaText: 'Ir al panel' }),
      }
    }
    default: {
      const subject = `Prueba de configuración - ${brand.name}`
      return {
        template: 'test', title: 'Email de prueba', subject, recipient: previewTo,
        html: renderPanelEmail({ subject, preheader: 'Mensaje de prueba del sistema.', title: '¡Servicio de Email Activo!', contentHtml: `Este es un mensaje de prueba enviado desde tu panel para confirmar que la configuración SMTP es correcta.<br /><br />Tu bot ahora puede enviar notificaciones, reportes y correos de seguridad a <strong style="color:#ffffff;">${previewTo}</strong>.`, ctaUrl: brand.panelUrl, ctaText: 'Ir al panel' }),
      }
    }
  }
}

function buildBroadcastPreview(type = 'announcement') {
  const brand = getBrandConfig()
  const previewTo = 'admin@ejemplo.com'

  switch (type) {
    case 'announcement': {
      const subject = 'Anuncio importante'
      const contentHtml = `
        <h3 style="color:#ffffff;margin:0 0 15px 0;">📢 Anuncio</h3>
        <p style="color:#94a3b8;margin:0 0 20px 0;">Tenemos algo importante que contarte.</p>
        <p style="color:#ffffff;margin:15px 0;">Este es un mensaje de prueba para el sistema de broadcast. Aquí puedes escribir cualquier announcement, actualización o comunicado para tus usuarios.</p>
        <p style="color:#94a3b8;margin:20px 0 0 0;">¿Tienes preguntas? Responde este email.</p>
      `.trim()
      return {
        template: 'broadcast_announcement', title: 'Anuncio', subject: `📢 ${brand.name} - Anuncio`, recipient: previewTo,
        html: renderPanelEmail({ subject: `📢 ${brand.name} - Anuncio`, preheader: 'Tenemos algo importante que contarte.', title: 'Anuncio Importante', contentHtml, ctaUrl: brand.panelUrl, ctaText: 'Ver más' }),
      }
    }
    case 'update': {
      const contentHtml = `
        <h3 style="color:#ffffff;margin:0 0 15px 0;">🎉 Nuevas funcionalidades</h3>
        <p style="color:#94a3b8;margin:0 0 20px 0;">We've been working on improving your bot.</p>
        <div style="background:#1e293b;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="color:#ffffff;margin:10px 0;"><strong>✨ Nuevo sistema de broadcast</strong></p>
          <p style="color:#94a3b8;margin:0 0 15px 0;">Envía notificaciones a todos tus usuarios</p>
          <p style="color:#ffffff;margin:10px 0;"><strong>🔔 Notificaciones push</strong></p>
          <p style="color:#94a3b8;margin:0;">Recibe alerts en tiempo real</p>
        </div>
      `.trim()
      return {
        template: 'broadcast_update', title: 'Novedades', subject: `🎉 ${brand.name} - Novedades`, recipient: previewTo,
        html: renderPanelEmail({ subject: `🎉 ${brand.name} - Novedades`, preheader: 'Nuevas funcionalidades disponibles.', title: 'Novedades del Sistema', contentHtml, ctaUrl: brand.panelUrl, ctaText: 'Ver actualizaciones' }),
      }
    }
    case 'alert': {
      const contentHtml = `
        <h3 style="color:#ffffff;margin:0 0 15px 0;">⚠️ Alerta</h3>
        <p style="color:#94a3b8;margin:0 0 20px 0;">Se ha detectado una alerta que requiere tu atención.</p>
        <div style="background:#7f1d1d;border-radius:12px;padding:20px;margin:20px 0;border:1px solid #dc2626;">
          <p style="color:#fca5a5;margin:5px 0;"><strong>Tipo:</strong> Advertencia</p>
          <p style="color:#fca5a5;margin:5px 0;"><strong>Severidad:</strong> Media</p>
          <p style="color:#fca5a5;margin:5px 0;"><strong>Descripción:</strong> Revisa los logs del sistema</p>
        </div>
        <p style="color:#94a3b8;margin:20px 0 0 0;">Ver detalles en el panel de administración.</p>
      `.trim()
      return {
        template: 'broadcast_alert', title: 'Alerta', subject: `⚠️ ${brand.name} - Alerta`, recipient: previewTo,
        html: renderPanelEmail({ subject: `⚠️ ${brand.name} - Alerta`, preheader: 'Se ha detectado una alerta en el sistema.', title: 'Alerta del Sistema', contentHtml, ctaUrl: brand.panelUrl, ctaText: 'Ver detalles' }),
      }
    }
    default:
      return buildEmailPreview('test')
  }
}

export function getEmailTemplatePreview(template = 'test') {
  if (template.startsWith('broadcast_')) {
    return buildBroadcastPreview(template.replace('broadcast_', ''))
  }
  return buildEmailPreview(template)
}
```

- [ ] **Step 2: Verificar importación**

```bash
node --input-type=module -e "
import { getEmailTemplatePreview } from './lib/email/preview.js'
const p = getEmailTemplatePreview('test')
console.log('preview ok:', p.template, typeof p.html)
"
```
Esperado: `preview ok: test string`

- [ ] **Step 3: Commit**

```bash
git add lib/email/preview.js
git commit -m "feat(email): add lib/email/preview.js with getEmailTemplatePreview"
```

---

## Task 8: `lib/email/broadcast.js`

**Files:**
- Create: `lib/email/broadcast.js`

- [ ] **Step 1: Crear `lib/email/broadcast.js`**

```js
import { getBrandConfig } from './config.js'
import { renderPanelEmail } from './renderer.js'
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
    contentHtml: `<p style="color:#94a3b8;">${prompt}</p>
    <p style="color:#64748b;font-size:12px;margin-top:20px;">
      Stats: ${stats.messages} msgs | ${stats.commands} comandos | ${stats.users} usuarios nuevos
    </p>`,
    source: 'manual',
  }
}
```

- [ ] **Step 2: Verificar importación**

```bash
node --input-type=module -e "
import { sendBroadcastEmail, sendPushBroadcast, sendFullBroadcast, generateBroadcastContent } from './lib/email/broadcast.js'
console.log('broadcast ok:', typeof sendBroadcastEmail, typeof sendPushBroadcast, typeof sendFullBroadcast, typeof generateBroadcastContent)
"
```
Esperado: `broadcast ok: function function function function`

- [ ] **Step 3: Commit**

```bash
git add lib/email/broadcast.js
git commit -m "feat(email): add lib/email/broadcast.js (email+push+AI)"
```

---

## Task 9: `lib/email/index.js` + smoke test

**Files:**
- Create: `lib/email/index.js`

- [ ] **Step 1: Crear `lib/email/index.js`**

```js
export * from './config.js'
export * from './renderer.js'
export * from './service.js'
export * from './preview.js'
export * from './broadcast.js'
export * from './templates/registration.js'
export * from './templates/password-reset.js'
export * from './templates/welcome.js'
export * from './templates/notification.js'
export * from './templates/security-alert.js'
export { getActiveProvider } from './providers/index.js'
export { SmtpProvider } from './providers/smtp.js'
```

- [ ] **Step 2: Smoke test — todas las exportaciones esperadas presentes**

```bash
node --input-type=module -e "
import * as email from './lib/email/index.js'
const required = [
  'getSmtpConfig', 'getBrandConfig', 'getSmtpMode', 'getSmtpWarnings', 'getSmtpTransportHint',
  'escapeHtml', 'renderPanelEmail',
  'sendMail', 'normalizeRecipients', 'verifySmtp', 'sendTestEmail', 'getEmailServiceStatus',
  'getEmailTemplatePreview',
  'sendBroadcastEmail', 'sendPushBroadcast', 'sendFullBroadcast', 'generateBroadcastContent',
  'sendRegistrationEmail', 'sendPasswordResetEmail', 'sendWelcomeEmail',
  'sendNotificationEmail', 'sendSecurityAlertEmail',
  'getActiveProvider', 'SmtpProvider',
]
const missing = required.filter(k => !(k in email))
if (missing.length) { console.error('FALTAN:', missing); process.exit(1) }
console.log('index.js ok — todas las exportaciones presentes (' + required.length + ')')
"
```
Esperado: `index.js ok — todas las exportaciones presentes (23)`

- [ ] **Step 3: Commit**

```bash
git add lib/email/index.js
git commit -m "feat(email): add lib/email/index.js — entry point que re-exporta todo"
```

---

## Task 10: Migrar todos los importadores

**Files:**
- Modify: `lib/notification-system.js`
- Modify: `lib/task-scheduler.js`
- Modify: `api/routes/config.js`
- Modify: `api/routes/auth.js`
- Modify: `api/routes/broadcast.js`

- [ ] **Step 1: Actualizar `lib/notification-system.js` (línea 3 — import estático)**

Cambiar:
```js
import { sendMail } from './email-service.js';
```
Por:
```js
import { sendMail } from './email/index.js';
```

- [ ] **Step 2: Actualizar `lib/task-scheduler.js` (línea 470 — import dinámico)**

Cambiar:
```js
const { sendMail, renderPanelEmail } = await import('./email-service.js');
```
Por:
```js
const { sendMail, renderPanelEmail } = await import('./email/index.js');
```

- [ ] **Step 3: Actualizar `api/routes/config.js` (4 imports dinámicos)**

Cambiar las 4 ocurrencias de `'../../lib/email-service.js'` → `'../../lib/email/index.js'`:

```js
// línea ~264
const { getEmailServiceStatus } = await import('../../lib/email/index.js')

// línea ~273
const { getEmailTemplatePreview } = await import('../../lib/email/index.js')

// línea ~284
const { verifySmtp } = await import('../../lib/email/index.js')

// línea ~296
const { sendTestEmail } = await import('../../lib/email/index.js')
```

- [ ] **Step 4: Actualizar `api/routes/auth.js` (3 imports dinámicos)**

Cambiar las 3 ocurrencias de `'../../lib/email-service.js'` → `'../../lib/email/index.js'`:

```js
// línea ~88
const { sendSecurityAlertEmail } = await import('../../lib/email/index.js')

// línea ~167
const { sendRegistrationEmail } = await import('../../lib/email/index.js')

// línea ~194
const { sendPasswordResetEmail } = await import('../../lib/email/index.js')
```

- [ ] **Step 5: Actualizar `api/routes/broadcast.js` (5 imports dinámicos)**

Cambiar las 5 ocurrencias de `'../../lib/email-service.js'` → `'../../lib/email/index.js'`:

```js
// línea ~68
const { sendBroadcastEmail } = await import('../../lib/email/index.js')

// línea ~89
const { getEmailServiceStatus } = await import('../../lib/email/index.js')

// línea ~101
const { sendTestEmail } = await import('../../lib/email/index.js')

// línea ~112
const { getEmailTemplatePreview } = await import('../../lib/email/index.js')

// línea ~121
const { renderPanelEmail, getBrandConfig } = await import('../../lib/email/index.js')
```

- [ ] **Step 6: Verificar que ningún archivo sigue apuntando a email-service**

```bash
grep -rn "email-service" lib/ api/ --include="*.js" | grep -v node_modules
```
Esperado: 0 resultados.

- [ ] **Step 7: Commit**

```bash
git add lib/notification-system.js lib/task-scheduler.js api/routes/config.js api/routes/auth.js api/routes/broadcast.js
git commit -m "refactor(email): migrate all importers from email-service.js to lib/email/index.js"
```

---

## Task 11: Eliminar `lib/email-service.js` + verificación final

**Files:**
- Delete: `lib/email-service.js`

- [ ] **Step 1: Eliminar el archivo**

```bash
rm lib/email-service.js
```

- [ ] **Step 2: Confirmar que no quedan referencias**

```bash
grep -rn "email-service" . --include="*.js" --include="*.ts" --include="*.tsx" --include="*.mjs" | grep -v node_modules | grep -v ".git"
```
Esperado: 0 resultados.

- [ ] **Step 3: Ejecutar todos los tests**

```bash
node --test test/email-config.test.mjs test/email-renderer.test.mjs test/email-service.test.mjs
```
Esperado: todos en verde.

- [ ] **Step 4: Smoke test del entry point final**

```bash
node --input-type=module -e "
import * as email from './lib/email/index.js'
const required = [
  'getSmtpConfig', 'getBrandConfig', 'getSmtpMode', 'getSmtpWarnings', 'getSmtpTransportHint',
  'escapeHtml', 'renderPanelEmail',
  'sendMail', 'normalizeRecipients', 'verifySmtp', 'sendTestEmail', 'getEmailServiceStatus',
  'getEmailTemplatePreview',
  'sendBroadcastEmail', 'sendPushBroadcast', 'sendFullBroadcast', 'generateBroadcastContent',
  'sendRegistrationEmail', 'sendPasswordResetEmail', 'sendWelcomeEmail',
  'sendNotificationEmail', 'sendSecurityAlertEmail',
  'getActiveProvider', 'SmtpProvider',
]
const missing = required.filter(k => !(k in email))
if (missing.length) { console.error('FALTAN:', missing); process.exit(1) }
console.log('todo ok:', required.length, 'exportaciones presentes')
"
```

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat(email): complete modular refactor — remove email-service.js, all imports migrated to lib/email/"
```
