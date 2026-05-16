# Email Service — Diseño Modular

**Fecha:** 2026-05-16  
**Estado:** Aprobado  
**Reemplaza:** `lib/email-service.js` (eliminado por completo)

---

## Problema

`lib/email-service.js` es un archivo monolítico de ~1160 líneas que mezcla:
config SMTP, gestión de transport, layout HTML, templates individuales, sistema de preview,
broadcast (email + push + AI) y estado/verificación. Agregar un template o un provider
obliga a tocar el mismo archivo, aumentando el riesgo de romper algo.

---

## Objetivo

Dividir el servicio en módulos con responsabilidad única, siguiendo el mismo patrón
de la API (`api/api.js` → `api/routes/` → `api/lib/`).
Eliminar `lib/email-service.js` por completo — sin wrapper de compatibilidad.
Todos los importadores actuales migran a `lib/email/index.js`.

---

## Estructura de archivos

```
lib/
  email/
    index.js              ← re-exporta todo (único punto de entrada público)
    config.js             ← getSmtpConfig, getBrandConfig, getSmtpWarnings, getSmtpTransportHint
    transport.js          ← buildTransportOptions, getTransporter, resetTransporterCache, cache
    renderer.js           ← renderPanelEmail, escapeHtml (layout base HTML de email)
    service.js            ← sendMail, verifySmtp, sendTestEmail, getEmailServiceStatus
    preview.js            ← getEmailTemplatePreview, buildEmailPreview, buildBroadcastPreview
    broadcast.js          ← sendBroadcastEmail, sendPushBroadcast, sendFullBroadcast, generateBroadcastContent
    providers/
      index.js            ← getActiveProvider() — carga el provider según config
      smtp.js             ← SmtpProvider: wrappea nodemailer con la config SMTP actual
    templates/
      registration.js     ← sendRegistrationEmail
      password-reset.js   ← sendPasswordResetEmail
      welcome.js          ← sendWelcomeEmail
      notification.js     ← sendNotificationEmail
      security-alert.js   ← sendSecurityAlertEmail
```

---

## Responsabilidades por módulo

### `config.js`
- Lee `main.json` + variables de entorno
- Expone: `getSmtpConfig()`, `getBrandConfig()`, `getSmtpWarnings()`, `getSmtpTransportHint()`, `getSecurityAlertRecipients()`
- Sin side effects, sin imports de otros módulos del email

### `transport.js`
- Importa `config.js` y `providers/index.js`
- Gestiona el pool de conexiones nodemailer (cache por hash de config)
- Expone: `getTransporter()`, `resetTransporterCache()`

### `renderer.js`
- Importa `config.js` (solo para `getBrandConfig`)
- Expone: `renderPanelEmail({ subject, preheader, title, contentHtml, ctaUrl, ctaText })`, `escapeHtml(text)`
- Produce el HTML base con colores Oguri Cap

### `providers/smtp.js`
- Clase `SmtpProvider` con método `send(message)`
- Hoy usa nodemailer internamente
- En el futuro: `providers/sendgrid.js`, `providers/mailgun.js` con la misma interfaz

### `providers/index.js`
- `getActiveProvider()` — lee config y retorna el provider correspondiente
- Hoy siempre retorna `SmtpProvider`; en el futuro lee `config.provider` del panel

### `templates/*.js`
- Cada archivo exporta una función: `sendXxxEmail({ to, ...params })`
- Importa `renderer.js` para `renderPanelEmail` + `escapeHtml`
- Importa `service.js` para `sendMail`
- No tiene estado propio

### `service.js`
- Importa `transport.js`, `config.js`, `providers/index.js`
- Expone: `sendMail()`, `verifySmtp()`, `sendTestEmail()`, `getEmailServiceStatus()`
- `sendMail` normaliza destinatarios, construye el mensaje y delega al transporter

### `preview.js`
- Importa `renderer.js` y `config.js`
- Genera HTML de preview sin enviar nada
- Expone: `getEmailTemplatePreview(template)`, `buildEmailPreview(template)`, `buildBroadcastPreview(type)`

### `broadcast.js`
- Importa `service.js`, `renderer.js`, `config.js`
- Expone: `sendBroadcastEmail()`, `sendPushBroadcast()`, `sendFullBroadcast()`, `generateBroadcastContent()`

### `index.js`
- Re-exporta todo desde los módulos anteriores
- Es el único archivo que los consumidores (`api/routes/config.js`, `api/routes/broadcast.js`, etc.) deben importar

---

## Migración de importadores

| Archivo actual importador | Cambia `from` |
|---|---|
| `api/routes/config.js` | `../../lib/email-service.js` → `../../lib/email/index.js` |
| `api/routes/broadcast.js` | `../../lib/email-service.js` → `../../lib/email/index.js` |
| `api/routes/auth.js` | si importa → `../../lib/email/index.js` |
| `api/routes/usuarios.js` | si importa → `../../lib/email/index.js` |

`lib/email-service.js` se elimina. No se deja wrapper.

---

## Flujo de datos (envío de email)

```
sendXxxEmail()          [templates/xxx.js]
  └─ renderPanelEmail() [renderer.js]
  └─ sendMail()         [service.js]
       └─ getTransporter() [transport.js]
            └─ getActiveProvider() [providers/index.js]
                 └─ SmtpProvider   [providers/smtp.js]
       └─ getSmtpConfig()  [config.js]
```

---

## Restricciones

- Ningún módulo importa desde `lib/email-service.js` (ese archivo se borra)
- Templates no importan entre sí
- `config.js` no importa ningún otro módulo del email
- `renderer.js` solo importa `config.js`
- Orden de dependencias: `config` → `renderer` → `providers` → `transport` → `service` → `templates` → `preview` → `broadcast` → `index`

---

## Tests / verificación

- Después de la migración: `node -e "import('./lib/email/index.js').then(m => console.log(Object.keys(m)))"` debe listar todas las exportaciones
- Buscar `email-service` en el repo — debe dar 0 resultados
- Las rutas `/api/config/email/*` deben seguir funcionando

---

## Out of scope

- UI del frontend (sin cambios en esta iteración)
- Nuevos providers (SendGrid, Mailgun) — la arquitectura los soporta pero no se implementan ahora
- Tests automatizados
