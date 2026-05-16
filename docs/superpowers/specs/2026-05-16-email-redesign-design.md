# Email Redesign + Nuevos Templates — Design Spec

## Goal

Refactorizar el renderer de emails para usar la paleta real del panel (verde/teal/rosa, fondo casi negro) y el diseño v2 aprobado. Agregar 6 nuevos templates. Todos los templates existentes heredan el nuevo visual sin cambiar su API pública.

## Diseño visual aprobado (v2)

**Paleta:**
- Primary: `#25d366` (verde WhatsApp)
- Secondary: `#2dd4bf` (teal)
- Accent: `#ff4d8d` (rosa/energy)
- Background: `#060807`
- Card bg: `linear-gradient(160deg, #0f1a14 0%, #0c1410 100%)`
- Card border: `rgba(37,211,102,0.22)`
- Card glow: `0 0 60px rgba(37,211,102,0.07)`
- Text primary: `#f2f6f3`
- Text muted: `#84968e`
- Text body: `#b2c5ba`

**Estructura del email:**
1. Logo pill centrado: `✦ OGURICAP BOT` + tagline "El Monstruo de las Cenizas"
2. Card con borde redondeado 20px, glow verde, sombra profunda oscura
3. Barra tricolor 4px: verde → teal → rosa
4. Cuerpo: emoji hero (44px) + título 32px/900 + subtítulo + separador gradient + texto + bloques de dato + CTA
5. Bloques de dato: fondo `rgba(color, 0.06)`, borde `rgba(color, 0.18)`, border-radius 12px, badge de estado pill
6. CTA: gradient verde→teal, border-radius 12px, glow `0 4px 24px rgba(37,211,102,0.4)`
7. Footer: "© YEAR OguriCap Bot · El Monstruo de las Cenizas" + "Powered by Oguri Power System"

## Arquitectura

### Archivos modificados

- `lib/email/renderer.js` — refactorizar `renderPanelEmail()` con el nuevo diseño. Misma firma pública. Eliminar colores morados hardcodeados. Agregar `renderDataBlock({ label, value, badge, badgeColor })` helper interno para los bloques de dato reutilizables.
- `lib/email/config.js` — agregar colores de marca al objeto `getBrandConfig()`: `green`, `teal`, `pink`, `bg`, `cardBg`.
- `lib/email/index.js` — re-exportar los 6 nuevos templates.
- `lib/email/preview.js` — agregar previews para los 6 nuevos templates.

### Archivos nuevos

- `lib/email/templates/role-changed.js`
- `lib/email/templates/bot-alert.js`
- `lib/email/templates/subbot-alert.js`
- `lib/email/templates/aporte-received.js`
- `lib/email/templates/login-new-device.js`
- `lib/email/templates/account-deleted.js`

### Tests

- `test/email-renderer.test.mjs` — actualizar tests de colores (verde en vez de morado), agregar tests del nuevo helper `renderDataBlock`.
- `test/email-templates-new.test.mjs` — smoke tests de los 6 nuevos templates: retornan string HTML, contienen datos del usuario, subject correcto.

## Templates existentes — cambios

Solo cambia el visual (renderer). La API (función, parámetros, exports) no cambia.

| Template | Función | Sin cambios de API |
|---|---|---|
| registration | `sendRegistrationEmail({ to, username })` | ✓ |
| password-reset | `sendPasswordResetEmail({ to, username, token, expiresMinutes })` | ✓ |
| welcome | `sendWelcomeEmail({ to, username, role })` | ✓ |
| notification | `sendNotificationEmail({ to, title, message, priority })` | ✓ |
| security-alert | `sendSecurityAlertEmail({ to, subject, title, message, details, ctaUrl, ctaText })` | ✓ |

## Nuevos templates

### `role-changed.js`
```js
sendRoleChangedEmail({ to, username, oldRole, newRole })
```
- Emoji: 🔑
- Título: "Tu rol cambió, {username}"
- Bloques: "Rol anterior" (muted/gris) + "Nuevo rol" (verde)
- CTA: "Ver mi perfil"
- Tono: informativo, positivo si es upgrade, neutro si es downgrade

### `bot-alert.js`
```js
sendBotAlertEmail({ to, botName, status, reason = '', since = '' })
```
- `status`: `'disconnected'` | `'reconnected'` | `'error'`
- Emoji: 🔴 disconnected / 🟢 reconnected / ⚠️ error
- Título: "{botName} se desconectó" / "{botName} reconectado"
- Bloque: motivo + desde cuándo
- CTA: "Ver estado del bot"
- Tono: urgente si disconnected, tranquilizador si reconnected

### `subbot-alert.js`
```js
sendSubbotAlertEmail({ to, subbotNumber, subbotName = '', status, reason = '' })
```
- `status`: `'disconnected'` | `'reconnected'`
- Emoji: 🤖
- Título: "Subbot {subbotNumber} {status}"
- Bloque: número, motivo
- CTA: "Gestionar subbots"

### `aporte-received.js`
```js
sendAporteReceivedEmail({ to, username, amount, concept = '', date = '' })
```
- Emoji: 💚
- Título: "¡Recibiste un aporte!"
- Bloques: de quién, monto (verde destacado), concepto, fecha
- CTA: "Ver aportes"
- Tono: celebratorio, cálido

### `login-new-device.js`
```js
sendLoginNewDeviceEmail({ to, username, ip, location = '', device = '', time = '' })
```
- Emoji: 🔐
- Título: "Acceso desde un dispositivo nuevo"
- Bloques: IP, ubicación, dispositivo, hora — en tabla de detalle
- CTA: "Revisar mi cuenta"
- Aviso: "Si no fuiste vos, cambiá tu contraseña de inmediato"
- Tono: alerta pero no alarmista

### `account-deleted.js`
```js
sendAccountDeletedEmail({ to, username, deletedBy = 'el sistema', reason = '' })
```
- Emoji: 🗑️
- Título: "Tu cuenta fue eliminada"
- Bloque: quién la eliminó, motivo (si hay)
- Sin CTA (la cuenta no existe más)
- Tono: informativo, claro, sin drama

## Tono de escritura (todos los templates)

- Tuteo argentino (`vos`, `podés`, `avisanos`)
- Frases cortas, sin jerga técnica
- Números y datos en bloques visuales, no en párrafos
- El aviso de seguridad al pie siempre presente, siempre discreto
