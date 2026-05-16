# Email System — Renovación y Nuevos Templates

**Fecha:** 2026-05-17  
**Branch:** post-test  
**Scope:** renderer.js + 14 templates existentes + 7 nuevos templates

---

## Objetivo

Renovar el sistema de emails con un renderer que soporte headers temáticos por tipo de acción, mejorar el contenido de todos los templates existentes, y añadir 7 nuevos templates.

---

## 1. Renderer (`lib/email/renderer.js`)

### 1.1 Nuevo parámetro `type`

`renderPanelEmail()` acepta un nuevo parámetro opcional `type`:

```js
renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText, type = 'success' })
```

Valores: `'success'` | `'danger'` | `'warning'` | `'info'`

### 1.2 Paleta por tipo

| Tipo | Color principal | Gradiente header | Badge label | CTA gradiente |
|------|----------------|-----------------|-------------|---------------|
| `success` | `#25d366` | verde → teal | EXITOSO | `#25d366 → #2dd4bf` |
| `danger` | `#ff4d8d` | rosa → rojo | ACCIÓN REQUERIDA | `#ff4d8d → #e11d48` |
| `warning` | `#fbbf24` | dorado → ámbar | AVISO IMPORTANTE | `#fbbf24 → #f59e0b` |
| `info` | `#2dd4bf` | teal → lavanda | VERIFICACIÓN | `#2dd4bf → #818cf8` |

### 1.3 Estructura del header temático

Reemplaza la franja de 3 colores + `<h1>` actual por un bloque header:

```
┌─────────────────────────────────────┐  ← borde del tipo
│  [ícono 52×52]                      │  ← fondo con gradiente del tipo
│  [BADGE tipo]                       │
│  Título del email                   │  ← color del tipo
└─────────────────────────────────────┘
  Cuerpo del email (contentHtml)
  [CTA button — gradiente del tipo]
```

- Ícono: provisto por cada template como `icon` (emoji string)
- Si no se pasa `icon`, el header muestra solo badge + título
- Badge: texto fijo según tipo (tabla arriba)

### 1.4 `renderDataBlock()` — colores nuevos

Añadir `gold` y `lavender` a la paleta existente (green, teal, pink, gray):

- `gold`: bg `rgba(251,191,36,0.06)`, border `rgba(251,191,36,0.18)`, badge `#fbbf24`
- `lavender`: bg `rgba(129,140,248,0.06)`, border `rgba(129,140,248,0.18)`, badge `#818cf8`

### 1.5 Compatibilidad

Todos los templates existentes que llamen `renderPanelEmail` sin `type` siguen funcionando sin cambios (default `'success'`). La migración es incremental.

---

## 2. Templates existentes — renovación

Cada template recibe `type` explícito y contenido mejorado.

### `registration.js` — type: `success`, icon: `🎉`
- Añadir: `renderDataBlock` con rol asignado + fecha de registro
- Preheader más específico: "Cuenta creada el [fecha]"

### `welcome.js` — type: `success`, icon: `🚀`
- Añadir sección "Primeros pasos" como 3 bullets en HTML
- Datos: username, rol, fecha

### `password-reset.js` — type: `warning`, icon: `🔑`
- Tiempo restante en `renderDataBlock` con color `gold` y badge "EXPIRA EN X MIN"
- Aviso de seguridad en rojo al pie

### `login-new-device.js` — type: `danger`, icon: `🔐`
- Añadir bloque "¿No fuiste vos?" con 2 pasos de acción como lista HTML
- Datos existentes (IP, device, time) sin cambios

### `role-changed.js` — type: `info`, icon: `🔄`
- Añadir descripción breve del nuevo rol si se pasa `roleDescription`
- Parámetro `roleDescription` opcional

### `account-deleted.js` — type: `danger`, icon: `🗑️`
- Tono más empático en el texto
- Añadir parámetro `contactEmail` opcional para el pie

### `bot-alert.js` — type dinámico según `status`
- `disconnected` → `danger`
- `reconnected` → `success`
- `error` → `warning`
- Iconos: 🔴 / 🟢 / ⚠️ (ya existen como emoji en texto, moverlos al header)

### `subbot-alert.js` — idem bot-alert
- Mismo esquema de tipos dinámicos

### `aporte-received.js` — type: `success`, icon: `💚`
- Añadir parámetro `totalAccumulated` opcional → renderDataBlock adicional

### `aporte-aceptado.js` — type: `success`, icon: `✅`
- Añadir parámetro `creditDate` opcional

### `aporte-rechazado.js` — type: `danger`, icon: `❌`
- Añadir sección "¿Qué hacer ahora?" con 2 pasos

### `aporte-pendiente.js` — type: `warning`, icon: `⏳`
- Añadir parámetro `estimatedHours` opcional → renderDataBlock

### `notification.js` — type: `info`, icon dinámico según `priority`
- `critical` → type `danger`, `high` → type `warning`, `normal/low` → type `info`
- Icon: 🚨 / ⚠️ / 📢 / ℹ️

### `security-alert.js` — type: `danger`, icon: `🛡️`
- Tabla de detalles convertida a `renderDataBlock` en loop
- Eliminar la tabla HTML manual actual

---

## 3. Nuevos templates

### `maintenance-notice.js` — type: `warning`, icon: `🛠️`

```js
sendMaintenanceNoticeEmail({ to, startTime, durationMinutes, affectedServices = [] })
```

- `startTime`: string ISO o legible
- `affectedServices[]`: array de strings (Panel, Bot, API, etc.)
- renderDataBlocks: Inicio, Duración, Servicios afectados
- CTA: "Ver estado del sistema" → `brand.panelUrl`

### `account-suspended.js` — type: `danger`, icon: `🔒`

```js
sendAccountSuspendedEmail({ to, username, suspendedBy, reason = '', contactUrl = '' })
```

- renderDataBlocks: Suspendido por, Motivo
- CTA opcional: "Contactar soporte" si se pasa `contactUrl`

### `account-reactivated.js` — type: `success`, icon: `✅`

```js
sendAccountReactivatedEmail({ to, username, reactivatedBy, note = '' })
```

- renderDataBlock: Reactivado por
- Nota opcional como párrafo
- CTA: "Acceder al panel"

### `subbot-created.js` — type: `success`, icon: `🤖`

```js
sendSubbotCreatedEmail({ to, subbotName, subbotNumber, createdBy })
```

- renderDataBlocks: Nombre, Número, Creado por
- CTA: "Ver bots" → `brand.panelUrl/bot`

### `subbot-deleted.js` — type: `danger`, icon: `🤖`

```js
sendSubbotDeletedEmail({ to, subbotName, deletedBy, reason = '' })
```

- renderDataBlocks: Bot eliminado, Eliminado por, Motivo
- Sin CTA

### `two-factor-code.js` — type: `info`, icon: `🔑`

```js
sendTwoFactorCodeEmail({ to, username, code, expiresMinutes = 5 })
```

- El código se muestra en `renderDataBlock` con font monospace grande (32px, letter-spacing 8px)
- Badge: "EXPIRA EN X MIN"
- **Sin CTA** (no linkear nada en emails de código)
- Aviso al pie: "No compartas este código con nadie"

### `system-alert.js` — type dinámico, icon: `⚙️`

```js
sendSystemAlertEmail({ to, metric, value, threshold, since = '', level = 'warning' })
```

- `level`: `'warning'` | `'critical'` → mapea a type `warning` / `danger`
- renderDataBlocks: Métrica, Valor actual, Umbral, Desde
- Badge del datablock de valor: "CRÍTICO" (pink) o "ALTO" (gold) según `level`
- CTA: "Ver diagnósticos" → `brand.panelUrl`

---

## 4. Exports (`lib/email/index.js`)

Añadir exports para los 7 nuevos templates siguiendo el patrón existente:

```js
export { sendMaintenanceNoticeEmail, buildMaintenanceNoticeEmail } from './templates/maintenance-notice.js'
export { sendAccountSuspendedEmail, buildAccountSuspendedEmail } from './templates/account-suspended.js'
export { sendAccountReactivatedEmail, buildAccountReactivatedEmail } from './templates/account-reactivated.js'
export { sendSubbotCreatedEmail, buildSubbotCreatedEmail } from './templates/subbot-created.js'
export { sendSubbotDeletedEmail, buildSubbotDeletedEmail } from './templates/subbot-deleted.js'
export { sendTwoFactorCodeEmail, buildTwoFactorCodeEmail } from './templates/two-factor-code.js'
export { sendSystemAlertEmail, buildSystemAlertEmail } from './templates/system-alert.js'
```

---

## 5. Preview (`configuracion/page.tsx`)

Añadir las 7 entradas nuevas al array `EMAIL_PREVIEW_TEMPLATES` en el panel de configuración.

---

## 6. Orden de implementación

1. `renderer.js` — tipo + paleta + header temático (base de todo lo demás)
2. Templates existentes (en bloque, todos juntos)
3. Nuevos templates (en bloque)
4. `index.js` exports
5. Preview panel

---

## 7. Lo que NO cambia

- `service.js`, `transport.js`, `config.js`, `broadcast.js`, `providers/` — sin tocar
- Firmas de función de templates existentes: solo se añaden parámetros opcionales, todos con default
- Comportamiento de envío: `sendMail()` sigue siendo el único punto de salida
