# Perfil de Usuario — Página /perfil

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear la página `/perfil` con 4 tabs (Cuenta, Dispositivos, Notificaciones, Seguridad), implementar detección de nuevos dispositivos en el login, y almacenar preferencias de notificación por evento en el JSON de metadata del usuario.

**Architecture:** El metadata JSONB del usuario en Postgres ya existe — se extiende con `known_devices[]` y `notification_prefs{}`. En cada login se calcula un fingerprint SHA-256 (IP + User-Agent), se compara con los dispositivos conocidos del usuario, y si es nuevo se envía el email de alerta y se registra el dispositivo. La página `/perfil` llama a endpoints REST nuevos (`/api/profile/*`) con JWT, y el Header.tsx vincula el avatar al perfil.

**Tech Stack:** Node.js ESM, PostgreSQL JSONB, `crypto` built-in, Next.js App Router, React, Tailwind CSS, lucide-react, Framer Motion, `node --test` (tests de backend)

---

## Estructura de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `api/lib/pg-usuarios.js` | Modificar | Añadir `pgGetUserMetadata`, `pgUpdateUserMetadata`, `pgAddKnownDevice`, `pgRevokeDevice` |
| `api/routes/profile.js` | Crear | Endpoints `/api/profile/*` (me, devices, notifications) |
| `api/api.js` | Modificar | Registrar ruta `/api/profile/` |
| `api/routes/auth.js` | Modificar | Detección de nuevo dispositivo al login exitoso |
| `test/profile-api.test.mjs` | Crear | Tests TDD para pg-usuarios nuevas funciones |
| `frontend-next/src/services/profileApi.ts` | Crear | Cliente API para endpoints de perfil |
| `frontend-next/src/components/profile/AccountTab.tsx` | Crear | Tab Cuenta: avatar + email + cambiar contraseña |
| `frontend-next/src/components/profile/DevicesTab.tsx` | Crear | Tab Dispositivos: lista de dispositivos con revocar |
| `frontend-next/src/components/profile/NotificationsTab.tsx` | Crear | Tab Notificaciones: toggles por evento |
| `frontend-next/src/components/profile/SecurityTab.tsx` | Crear | Tab Seguridad: info de sesión + historial |
| `frontend-next/src/app/(dashboard)/perfil/page.tsx` | Crear | Página principal con tabs |
| `frontend-next/src/components/layout/Header.tsx` | Modificar | Avatar → link a /perfil |
| `frontend-next/src/app/(dashboard)/configuracion/page.tsx` | Modificar | Añadir 3 templates de aporte faltantes |

---

## Task 0: Añadir templates de aporte faltantes en configuracion

**Files:**
- Modify: `frontend-next/src/app/(dashboard)/configuracion/page.tsx:82-99`

- [ ] **Step 1: Añadir las 3 entradas al array EMAIL_PREVIEW_TEMPLATES**

Reemplazar en `configuracion/page.tsx` el bloque `EMAIL_PREVIEW_TEMPLATES`:

```ts
const EMAIL_PREVIEW_TEMPLATES = [
  { id: 'test',                   label: 'Prueba' },
  { id: 'registration',           label: 'Registro' },
  { id: 'welcome',                label: 'Bienvenida' },
  { id: 'password-reset',         label: 'Reset contraseña' },
  { id: 'security-alert',         label: 'Alerta seguridad' },
  { id: 'notification',           label: 'Notificación' },
  { id: 'role-changed',           label: 'Cambio de rol' },
  { id: 'bot-alert-disconnected', label: 'Bot offline' },
  { id: 'bot-alert-reconnected',  label: 'Bot reconectado' },
  { id: 'subbot-alert',           label: 'Subbot offline' },
  { id: 'aporte-received',        label: 'Aporte recibido' },
  { id: 'aporte-aceptado',        label: 'Aporte aceptado' },
  { id: 'aporte-rechazado',       label: 'Aporte rechazado' },
  { id: 'aporte-pendiente',       label: 'Aporte pendiente' },
  { id: 'login-new-device',       label: 'Acceso nuevo dispositivo' },
  { id: 'account-deleted',        label: 'Cuenta eliminada' },
  { id: 'broadcast_announcement', label: 'Anuncio' },
  { id: 'broadcast_update',       label: 'Novedades' },
  { id: 'broadcast_alert',        label: 'Alerta broadcast' },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add frontend-next/src/app/\(dashboard\)/configuracion/page.tsx
git commit -m "feat(configuracion): add aporte-aceptado, aporte-rechazado, aporte-pendiente to email preview list"
```

---

## Task 1: Extender pg-usuarios con funciones de metadata

**Files:**
- Modify: `api/lib/pg-usuarios.js`
- Create: `test/profile-api.test.mjs`

- [ ] **Step 1: Escribir los tests fallidos**

Crear `test/profile-api.test.mjs`:

```js
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

// Mock del pool de PG
let _metadata = { email: 'test@test.com' }
const mockPool = {
  query: async (sql, params) => {
    if (sql.includes('SELECT metadata')) {
      return { rows: [{ metadata: _metadata }] }
    }
    if (sql.includes('UPDATE usuarios SET metadata')) {
      const newMeta = JSON.parse(params[0])
      _metadata = { ..._metadata, ...newMeta }
      return { rows: [{ metadata: _metadata }] }
    }
    return { rows: [] }
  }
}

before(() => {
  global.db = { pool: mockPool }
})

describe('pgGetUserMetadata', () => {
  it('returns metadata object for existing user', async () => {
    const { pgGetUserMetadata } = await import('../api/lib/pg-usuarios.js')
    const meta = await pgGetUserMetadata('testuser')
    assert.equal(meta.email, 'test@test.com')
  })

  it('returns empty object when user not found', async () => {
    const mockEmpty = { query: async () => ({ rows: [] }) }
    global.db = { pool: mockEmpty }
    const { pgGetUserMetadata } = await import('../api/lib/pg-usuarios.js')
    const meta = await pgGetUserMetadata('ghost')
    assert.deepEqual(meta, {})
    global.db = { pool: mockPool }
  })
})

describe('pgUpdateUserMetadata', () => {
  it('merges new fields into existing metadata', async () => {
    const { pgUpdateUserMetadata } = await import('../api/lib/pg-usuarios.js')
    await pgUpdateUserMetadata('testuser', { notification_prefs: { login_new_device: false } })
    assert.equal(_metadata.notification_prefs?.login_new_device, false)
  })
})

describe('pgAddKnownDevice', () => {
  it('adds a device to known_devices array', async () => {
    const { pgAddKnownDevice } = await import('../api/lib/pg-usuarios.js')
    const device = { hash: 'abc123', ip: '1.2.3.4', browser: 'Chrome', os: 'Windows', ua: 'Mozilla/5.0', first_seen: new Date().toISOString(), last_seen: new Date().toISOString() }
    await pgAddKnownDevice('testuser', device)
    assert.ok(Array.isArray(_metadata.known_devices))
    assert.equal(_metadata.known_devices[0].hash, 'abc123')
  })

  it('updates last_seen if device hash already exists', async () => {
    _metadata.known_devices = [{ hash: 'abc123', ip: '1.2.3.4', last_seen: '2020-01-01T00:00:00Z' }]
    const { pgAddKnownDevice } = await import('../api/lib/pg-usuarios.js')
    const newTime = new Date().toISOString()
    await pgAddKnownDevice('testuser', { hash: 'abc123', ip: '1.2.3.4', last_seen: newTime })
    assert.equal(_metadata.known_devices.length, 1)
    assert.equal(_metadata.known_devices[0].last_seen, newTime)
  })
})

describe('pgRevokeDevice', () => {
  it('removes device by hash', async () => {
    _metadata.known_devices = [{ hash: 'abc123' }, { hash: 'def456' }]
    const { pgRevokeDevice } = await import('../api/lib/pg-usuarios.js')
    await pgRevokeDevice('testuser', 'abc123')
    assert.equal(_metadata.known_devices.length, 1)
    assert.equal(_metadata.known_devices[0].hash, 'def456')
  })
})
```

- [ ] **Step 2: Verificar que los tests fallan**

```bash
cd /home/OguriCap-Bot && node --test test/profile-api.test.mjs 2>&1 | head -30
```

Esperado: `SyntaxError` o `ReferenceError` — las funciones no existen aún.

- [ ] **Step 3: Implementar las funciones en pg-usuarios.js**

Añadir al final de `api/lib/pg-usuarios.js`, antes del `export function normalizeUser`:

```js
export async function pgGetUserMetadata(username) {
  try {
    const { rows } = await pool().query(
      'SELECT metadata FROM usuarios WHERE username = $1 LIMIT 1', [username]
    )
    if (!rows[0]) return {}
    return typeof rows[0].metadata === 'object' ? (rows[0].metadata || {}) : {}
  } catch { return {} }
}

export async function pgUpdateUserMetadata(username, patch) {
  try {
    // Lee metadata actual, hace merge superficial, guarda
    const current = await pgGetUserMetadata(username)
    const merged = { ...current, ...patch }
    await pool().query(
      `UPDATE usuarios SET metadata = $1::jsonb WHERE username = $2`,
      [JSON.stringify(merged), username]
    )
  } catch {}
}

export async function pgAddKnownDevice(username, device) {
  try {
    const meta = await pgGetUserMetadata(username)
    const devices = Array.isArray(meta.known_devices) ? meta.known_devices : []
    const idx = devices.findIndex(d => d.hash === device.hash)
    if (idx >= 0) {
      devices[idx] = { ...devices[idx], ...device }
    } else {
      devices.push(device)
    }
    // Mantener máximo 20 dispositivos (los más recientes)
    if (devices.length > 20) devices.splice(0, devices.length - 20)
    await pgUpdateUserMetadata(username, { known_devices: devices })
  } catch {}
}

export async function pgRevokeDevice(username, hash) {
  try {
    const meta = await pgGetUserMetadata(username)
    const devices = (meta.known_devices || []).filter(d => d.hash !== hash)
    await pgUpdateUserMetadata(username, { known_devices: devices })
  } catch {}
}
```

- [ ] **Step 4: Correr los tests y verificar que pasan**

```bash
cd /home/OguriCap-Bot && node --test test/profile-api.test.mjs 2>&1
```

Esperado: `✓ 5 tests passed`

- [ ] **Step 5: Commit**

```bash
git add api/lib/pg-usuarios.js test/profile-api.test.mjs
git commit -m "feat(pg): add pgGetUserMetadata, pgUpdateUserMetadata, pgAddKnownDevice, pgRevokeDevice"
```

---

## Task 2: Crear api/routes/profile.js

**Files:**
- Create: `api/routes/profile.js`

Los endpoints de este archivo son:
- `GET /api/profile/me` — devuelve info del usuario autenticado (email, rol, last_login, login_ip)
- `GET /api/profile/devices` — lista `known_devices` del usuario
- `DELETE /api/profile/devices/:hash` — revoca un dispositivo por hash
- `GET /api/profile/notifications` — devuelve `notification_prefs`
- `PUT /api/profile/notifications` — guarda `notification_prefs`

- [ ] **Step 1: Crear el archivo**

```js
// api/routes/profile.js
import { json, readJson, getJwtAuth, safeString } from '../middleware/core.js'
import { pgGetUserMetadata, pgUpdateUserMetadata, pgRevokeDevice } from '../lib/pg-usuarios.js'
import { pgFindUser } from '../lib/pg-usuarios.js'

const DEFAULT_NOTIF_PREFS = {
  login_new_device:  true,
  aporte_received:   true,
  aporte_aceptado:   true,
  aporte_rechazado:  true,
  aporte_pendiente:  true,
  role_changed:      true,
}

export async function handleProfile({ req, res, url }) {
  const method = req.method.toUpperCase()
  const pathname = url.pathname

  const auth = await getJwtAuth(req)
  if (!auth.ok) return json(res, auth.status, { error: auth.error })
  const username = safeString(auth.user?.username)

  // GET /api/profile/me
  if (pathname === '/api/profile/me' && method === 'GET') {
    const user = await pgFindUser(username)
    if (!user) return json(res, 404, { error: 'Usuario no encontrado' })
    return json(res, 200, {
      username: user.username,
      email: user.email || null,
      rol: user.rol,
      last_login: user.last_login || null,
      login_ip: user.login_ip || null,
      fecha_registro: user.fecha_registro || null,
    })
  }

  // GET /api/profile/devices
  if (pathname === '/api/profile/devices' && method === 'GET') {
    const meta = await pgGetUserMetadata(username)
    const devices = (meta.known_devices || []).map(d => ({
      hash: d.hash,
      ip: d.ip,
      browser: d.browser || 'Desconocido',
      os: d.os || 'Desconocido',
      first_seen: d.first_seen,
      last_seen: d.last_seen,
    }))
    return json(res, 200, { devices })
  }

  // DELETE /api/profile/devices/:hash
  const deviceDeleteMatch = pathname.match(/^\/api\/profile\/devices\/([a-f0-9]{8,32})$/)
  if (deviceDeleteMatch && method === 'DELETE') {
    const hash = deviceDeleteMatch[1]
    await pgRevokeDevice(username, hash)
    return json(res, 200, { ok: true })
  }

  // GET /api/profile/notifications
  if (pathname === '/api/profile/notifications' && method === 'GET') {
    const meta = await pgGetUserMetadata(username)
    const prefs = { ...DEFAULT_NOTIF_PREFS, ...(meta.notification_prefs || {}) }
    return json(res, 200, { prefs })
  }

  // PUT /api/profile/notifications
  if (pathname === '/api/profile/notifications' && method === 'PUT') {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') return json(res, 400, { error: 'Body inválido' })
    // Sólo permite las keys conocidas, valor booleano
    const prefs = {}
    for (const key of Object.keys(DEFAULT_NOTIF_PREFS)) {
      if (key in body) prefs[key] = Boolean(body[key])
    }
    await pgUpdateUserMetadata(username, { notification_prefs: prefs })
    return json(res, 200, { ok: true, prefs: { ...DEFAULT_NOTIF_PREFS, ...prefs } })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
```

- [ ] **Step 2: Commit**

```bash
git add api/routes/profile.js
git commit -m "feat(api): add /api/profile/* endpoints (me, devices, notifications)"
```

---

## Task 3: Registrar la ruta en api.js

**Files:**
- Modify: `api/api.js`

- [ ] **Step 1: Añadir import al bloque de imports**

En `api/api.js`, justo después de la última línea de import de routes (actualmente `import { handleSupport }...`), añadir:

```js
import { handleProfile }         from './routes/profile.js'
```

- [ ] **Step 2: Añadir dispatch en el bloque de rutas**

En el bloque donde están los `return await handle...`, añadir antes del catch-all o al final de los `if` de pathname:

```js
if (pathname.startsWith('/api/profile'))                                          return await handleProfile(ctx)
```

- [ ] **Step 3: Verificar con curl (requiere servidor corriendo)**

```bash
# En otra terminal: node /home/OguriCap-Bot/index.js &
# Luego:
curl -s -H "Authorization: Bearer INVALID" http://localhost:3001/api/profile/me
# Esperado: {"error":"..."} con status 401
```

- [ ] **Step 4: Commit**

```bash
git add api/api.js
git commit -m "feat(api): register /api/profile route handler"
```

---

## Task 4: Detección de nuevo dispositivo en login

**Files:**
- Modify: `api/routes/auth.js`

La lógica se añade en el bloque `setImmediate(async () => { ... })` que ya existe al final del handler de login, justo después de `await pgUpdateUserLogin(username, clientIp)`.

- [ ] **Step 1: Añadir helper de fingerprint al inicio del archivo auth.js**

Añadir después de los imports existentes en `api/routes/auth.js`:

```js
import { createHash } from 'node:crypto'

function deviceFingerprint(ip, ua) {
  const normalized = safeString(ua).replace(/\s+/g, ' ').trim().slice(0, 300)
  return createHash('sha256').update(`${ip}|${normalized}`).digest('hex').slice(0, 16)
}

function parseBrowserOS(ua) {
  const s = safeString(ua)
  let browser = 'Navegador'
  let os = 'Sistema operativo'
  if (/Edg\//.test(s)) browser = 'Edge'
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera'
  else if (/Chrome\//.test(s)) browser = 'Chrome'
  else if (/Safari\//.test(s) && !/Chrome/.test(s)) browser = 'Safari'
  else if (/Firefox\//.test(s)) browser = 'Firefox'
  else if (/MSIE|Trident/.test(s)) browser = 'Internet Explorer'
  if (/Windows NT/.test(s)) os = 'Windows'
  else if (/Android/.test(s)) os = 'Android'
  else if (/iPhone|iPad/.test(s)) os = 'iOS'
  else if (/Mac OS X/.test(s)) os = 'macOS'
  else if (/Linux/.test(s)) os = 'Linux'
  return { browser, os }
}
```

- [ ] **Step 2: Añadir detección de dispositivo en el setImmediate del login**

Buscar el bloque `setImmediate(async () => {` en `auth.js`. Dentro de él, después de `await pgUpdateUserLogin(username, clientIp)`, añadir:

```js
        // Detección de nuevo dispositivo
        try {
          const { pgGetUserMetadata, pgAddKnownDevice } = await import('../lib/pg-usuarios.js')
          const meta = await pgGetUserMetadata(username)
          const devices = meta.known_devices || []
          const notifPrefs = meta.notification_prefs || {}
          const hash = deviceFingerprint(clientIp, userAgent)
          const isNew = !devices.some(d => d.hash === hash)
          const { browser, os } = parseBrowserOS(userAgent)
          const now = new Date().toISOString()
          await pgAddKnownDevice(username, {
            hash, ip: clientIp, browser, os, ua: safeString(userAgent).slice(0, 300),
            first_seen: isNew ? now : undefined,
            last_seen: now,
          })
          if (isNew && notifPrefs.login_new_device !== false) {
            const userEmail = meta.email || null
            if (userEmail) {
              const { sendLoginNewDeviceEmail } = await import('../../lib/email/index.js')
              void sendLoginNewDeviceEmail({
                to: userEmail,
                username,
                ip: clientIp,
                location: '-',
                device: `${browser} en ${os}`,
                time: new Date().toLocaleString('es-ES', { timeZone: 'America/Santo_Domingo' }),
              }).catch(() => {})
            }
          }
        } catch {}
```

- [ ] **Step 3: Commit**

```bash
git add api/routes/auth.js
git commit -m "feat(auth): detect new login device, store in metadata, send email alert"
```

---

## Task 5: Cliente API de perfil en el frontend

**Files:**
- Create: `frontend-next/src/services/profileApi.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// frontend-next/src/services/profileApi.ts
import api from './api';

export interface Device {
  hash: string;
  ip: string;
  browser: string;
  os: string;
  first_seen: string;
  last_seen: string;
}

export interface NotifPrefs {
  login_new_device: boolean;
  aporte_received: boolean;
  aporte_aceptado: boolean;
  aporte_rechazado: boolean;
  aporte_pendiente: boolean;
  role_changed: boolean;
}

export interface ProfileMe {
  username: string;
  email: string | null;
  rol: string;
  last_login: string | null;
  login_ip: string | null;
  fecha_registro: string | null;
}

export const profileApi = {
  getMe: (): Promise<ProfileMe> =>
    api.get('/api/profile/me').then(r => r.data),

  getDevices: (): Promise<{ devices: Device[] }> =>
    api.get('/api/profile/devices').then(r => r.data),

  revokeDevice: (hash: string): Promise<void> =>
    api.delete(`/api/profile/devices/${hash}`).then(() => undefined),

  getNotifications: (): Promise<{ prefs: NotifPrefs }> =>
    api.get('/api/profile/notifications').then(r => r.data),

  updateNotifications: (prefs: Partial<NotifPrefs>): Promise<{ prefs: NotifPrefs }> =>
    api.put('/api/profile/notifications', prefs).then(r => r.data),
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend-next/src/services/profileApi.ts
git commit -m "feat(frontend): add profileApi service client"
```

---

## Task 6: AccountTab — datos de cuenta y avatar

**Files:**
- Create: `frontend-next/src/components/profile/AccountTab.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client';
import * as React from 'react';
import { User, Mail, Shield, Clock, MapPin } from 'lucide-react';
import { ProfileAvatar } from '@/components/user/ProfileAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { profileApi, ProfileMe } from '@/services/profileApi';
import { cn } from '@/lib/utils';

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-white/[0.06] last:border-0">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#25d366]/10 border border-[#25d366]/15">
        <Icon className="h-4 w-4 text-[#25d366]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{value || '—'}</p>
      </div>
    </div>
  );
}

export function AccountTab() {
  const { user } = useAuth();
  const [me, setMe] = React.useState<ProfileMe | null>(null);

  React.useEffect(() => {
    profileApi.getMe().then(setMe).catch(() => {});
  }, []);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : null;

  return (
    <div className="space-y-6">
      {/* Avatar + identidad */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative">
          <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-[#25d366]/20 via-[#2dd4bf]/10 to-[#ff4d8d]/10 blur-xl" />
          <div className="relative">
            <ProfileAvatar editable size="lg" />
          </div>
        </div>
        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-black tracking-tight text-foreground">{user?.username}</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#25d366]/20 bg-[#25d366]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#a7f3c7]">
            <Shield className="h-3 w-3" />
            {user?.rol}
          </span>
          <p className="mt-2 text-xs text-muted">Haz clic en el avatar para cambiar tu foto de perfil.</p>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-2xl border border-white/10 bg-[#0f1a14]/60 p-4">
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#25d366]">Información de la cuenta</p>
        <InfoRow icon={User} label="Usuario" value={user?.username ?? null} />
        <InfoRow icon={Mail} label="Email" value={me?.email ?? null} />
        <InfoRow icon={Shield} label="Rol asignado" value={me?.rol ?? null} />
        <InfoRow icon={Clock} label="Último acceso" value={formatDate(me?.last_login ?? null)} />
        <InfoRow icon={MapPin} label="Última IP" value={me?.login_ip ?? null} />
        <InfoRow icon={Clock} label="Miembro desde" value={formatDate(me?.fecha_registro ?? null)} />
      </div>

      {/* Tip */}
      <div className="rounded-xl border border-[#2dd4bf]/15 bg-[#2dd4bf]/5 p-4 text-sm text-[#2dd4bf]">
        <strong className="font-black">Tip:</strong> Para cambiar tu contraseña ve a <span className="font-mono text-xs">Configuración → Seguridad</span>. Para actualizar tu email contacta a un administrador.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-next/src/components/profile/AccountTab.tsx
git commit -m "feat(profile): add AccountTab component"
```

---

## Task 7: DevicesTab — dispositivos conocidos

**Files:**
- Create: `frontend-next/src/components/profile/DevicesTab.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client';
import * as React from 'react';
import { Monitor, Smartphone, Globe, Trash2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Device, profileApi } from '@/services/profileApi';
import { notify } from '@/lib/notif';
import { cn } from '@/lib/utils';

function DeviceIcon({ os }: { os: string }) {
  if (/android|ios|iphone|ipad/i.test(os)) return <Smartphone className="h-5 w-5" />;
  return <Monitor className="h-5 w-5" />;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'Ahora mismo';
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `Hace ${days} día${days !== 1 ? 's' : ''}`;
}

export function DevicesTab() {
  const [devices, setDevices] = React.useState<Device[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [revoking, setRevoking] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { devices } = await profileApi.getDevices();
      setDevices(devices.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()));
    } catch { notify.error('No se pudieron cargar los dispositivos'); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const revoke = async (hash: string) => {
    setRevoking(hash);
    try {
      await profileApi.revokeDevice(hash);
      setDevices(prev => prev.filter(d => d.hash !== hash));
      notify.success('Dispositivo eliminado');
    } catch { notify.error('No se pudo revocar el dispositivo'); }
    finally { setRevoking(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-foreground">Dispositivos conocidos</h3>
          <p className="text-xs text-muted mt-0.5">Dispositivos desde los que has iniciado sesión. Revoca los que no reconozcas.</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition-colors">
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Actualizar
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Globe className="h-10 w-10 text-muted/40" />
          <p className="text-sm font-semibold text-muted">No hay dispositivos registrados aún.</p>
          <p className="text-xs text-muted/60">Se registran automáticamente al iniciar sesión.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {devices.map((device, i) => (
            <div key={device.hash} className={cn(
              'group flex items-center gap-4 rounded-2xl border p-4 transition-all',
              i === 0
                ? 'border-[#25d366]/25 bg-[#25d366]/5'
                : 'border-white/[0.07] bg-white/[0.025] hover:border-white/12'
            )}>
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
                i === 0 ? 'border-[#25d366]/20 bg-[#25d366]/10 text-[#25d366]' : 'border-white/10 bg-white/[0.04] text-muted'
              )}>
                <DeviceIcon os={device.os} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground truncate">{device.browser} — {device.os}</span>
                  {i === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#25d366]/25 bg-[#25d366]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#a7f3c7]">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      Este dispositivo
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                  <span>IP: {device.ip}</span>
                  <span>·</span>
                  <span>Último acceso: {timeAgo(device.last_seen)}</span>
                  <span>·</span>
                  <span>Registrado: {new Date(device.first_seen).toLocaleDateString('es-ES')}</span>
                </div>
              </div>
              {i > 0 && (
                <button
                  onClick={() => revoke(device.hash)}
                  disabled={revoking === device.hash}
                  className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted opacity-0 transition-all group-hover:opacity-100 hover:border-[#ff4d8d]/30 hover:bg-[#ff4d8d]/10 hover:text-[#ff4d8d] disabled:opacity-40"
                  title="Revocar dispositivo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Aviso de seguridad */}
      <div className="rounded-xl border border-[#ff4d8d]/15 bg-[#ff4d8d]/5 p-4">
        <p className="text-xs text-[#ff9fbd]">
          <strong className="font-black">Seguridad:</strong> Si ves un dispositivo que no reconoces, revócalo y cambia tu contraseña inmediatamente. Los dispositivos se registran con IP y navegador en cada inicio de sesión.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-next/src/components/profile/DevicesTab.tsx
git commit -m "feat(profile): add DevicesTab with revoke support"
```

---

## Task 8: NotificationsTab — toggles por evento de email

**Files:**
- Create: `frontend-next/src/components/profile/NotificationsTab.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client';
import * as React from 'react';
import { Bell, Smartphone, Package, CheckCircle, XCircle, Clock, UserCog, Loader2 } from 'lucide-react';
import { NotifPrefs, profileApi } from '@/services/profileApi';
import { Switch } from '@/components/ui/Switch';
import { notify } from '@/lib/notif';

interface EventConfig {
  key: keyof NotifPrefs;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const EVENTS: EventConfig[] = [
  { key: 'login_new_device',  label: 'Nuevo dispositivo',    description: 'Recibe un aviso cuando tu cuenta se use en un dispositivo que no habías usado antes.',                icon: Smartphone,  color: '#ff4d8d' },
  { key: 'role_changed',      label: 'Cambio de rol',        description: 'Notificación cuando un administrador cambia tu rol en el sistema.',                                    icon: UserCog,     color: '#2dd4bf' },
  { key: 'aporte_received',   label: 'Aporte recibido',      description: 'Cuando alguien envía un aporte a tu cuenta para revisión.',                                            icon: Package,     color: '#25d366' },
  { key: 'aporte_aceptado',   label: 'Aporte aceptado',      description: 'Cuando un administrador acepta uno de tus aportes.',                                                   icon: CheckCircle, color: '#25d366' },
  { key: 'aporte_rechazado',  label: 'Aporte rechazado',     description: 'Cuando un administrador rechaza uno de tus aportes con motivo.',                                       icon: XCircle,     color: '#ff4d8d' },
  { key: 'aporte_pendiente',  label: 'Aporte pendiente',     description: 'Recordatorio cuando tienes un aporte pendiente de resolución.',                                        icon: Clock,       color: '#f59e0b' },
];

export function NotificationsTab() {
  const [prefs, setPrefs] = React.useState<NotifPrefs | null>(null);
  const [saving, setSaving] = React.useState<keyof NotifPrefs | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    profileApi.getNotifications()
      .then(r => setPrefs(r.prefs))
      .catch(() => notify.error('No se pudieron cargar las preferencias'))
      .finally(() => setLoading(false));
  }, []);

  const toggle = async (key: keyof NotifPrefs) => {
    if (!prefs || saving) return;
    const newVal = !prefs[key];
    setPrefs(p => p ? { ...p, [key]: newVal } : p);
    setSaving(key);
    try {
      const result = await profileApi.updateNotifications({ [key]: newVal });
      setPrefs(result.prefs);
    } catch {
      setPrefs(p => p ? { ...p, [key]: !newVal } : p);
      notify.error('No se pudo guardar la preferencia');
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-foreground">Notificaciones por email</h3>
        <p className="text-xs text-muted mt-0.5">Activa o desactiva el email para cada tipo de evento. Los cambios se guardan automáticamente.</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {EVENTS.map(e => <div key={e.key} className="h-20 animate-pulse rounded-2xl bg-white/[0.04]" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {EVENTS.map(event => {
            const Icon = event.icon;
            const enabled = prefs?.[event.key] ?? true;
            const isSaving = saving === event.key;
            return (
              <div key={event.key} className="flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 transition-colors hover:border-white/12">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"
                  style={{ borderColor: `${event.color}22`, background: `${event.color}10` }}>
                  <Icon className="h-4 w-4" style={{ color: event.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-foreground">{event.label}</p>
                  <p className="mt-0.5 text-xs text-muted leading-relaxed">{event.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => toggle(event.key)}
                    disabled={isSaving}
                    aria-label={`Activar notificación de ${event.label}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-[#25d366]/15 bg-[#25d366]/5 p-4">
        <p className="flex items-start gap-2 text-xs text-[#a7f3c7]">
          <Bell className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Las notificaciones se envían al email configurado en tu cuenta. Si no tienes email, los envíos quedan desactivados aunque los toggles estén activos.</span>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-next/src/components/profile/NotificationsTab.tsx
git commit -m "feat(profile): add NotificationsTab with per-event email toggles"
```

---

## Task 9: SecurityTab — sesión activa e historial

**Files:**
- Create: `frontend-next/src/components/profile/SecurityTab.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
'use client';
import * as React from 'react';
import { ShieldCheck, LogOut, Key, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { profileApi, ProfileMe } from '@/services/profileApi';
import { notify } from '@/lib/notif';

export function SecurityTab() {
  const { logout } = useAuth();
  const [me, setMe] = React.useState<ProfileMe | null>(null);

  React.useEffect(() => {
    profileApi.getMe().then(setMe).catch(() => {});
  }, []);

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) : '—';

  const handleLogout = () => {
    notify.info('Cerrando sesión...');
    setTimeout(logout, 500);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-bold text-foreground">Seguridad de la cuenta</h3>
        <p className="text-xs text-muted mt-0.5">Revisa tu sesión activa y gestiona el acceso a tu cuenta.</p>
      </div>

      {/* Sesión activa */}
      <div className="rounded-2xl border border-[#25d366]/20 bg-[#25d366]/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#25d366]" />
          <span className="text-sm font-black text-[#a7f3c7] uppercase tracking-[0.14em]">Sesión activa</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[11px] text-muted uppercase tracking-[0.14em] font-bold">Último acceso</p>
            <p className="mt-0.5 font-semibold text-foreground">{formatDate(me?.last_login ?? null)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted uppercase tracking-[0.14em] font-bold">IP registrada</p>
            <p className="mt-0.5 font-semibold text-foreground font-mono text-sm">{me?.login_ip || '—'}</p>
          </div>
        </div>
      </div>

      {/* Acciones */}
      <div className="space-y-2">
        <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2dd4bf]/15 bg-[#2dd4bf]/8">
            <Key className="h-4 w-4 text-[#2dd4bf]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Cambiar contraseña</p>
            <p className="text-xs text-muted">Ve a Configuración del panel para cambiar tu contraseña.</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ff4d8d]/15 bg-[#ff4d8d]/8">
            <Lock className="h-4 w-4 text-[#ff4d8d]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Dispositivos de confianza</p>
            <p className="text-xs text-muted">Gestiona los dispositivos en el tab "Dispositivos".</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-4 rounded-2xl border border-[#ff4d8d]/20 bg-[#ff4d8d]/5 p-4 text-left transition-colors hover:border-[#ff4d8d]/35 hover:bg-[#ff4d8d]/8"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#ff4d8d]/20 bg-[#ff4d8d]/10">
            <LogOut className="h-4 w-4 text-[#ff4d8d]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#ff9fbd]">Cerrar sesión</p>
            <p className="text-xs text-[#ff4d8d]/60">Finaliza tu sesión en este dispositivo.</p>
          </div>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-next/src/components/profile/SecurityTab.tsx
git commit -m "feat(profile): add SecurityTab component"
```

---

## Task 10: Página /perfil con tabs

**Files:**
- Create: `frontend-next/src/app/(dashboard)/perfil/page.tsx`

- [ ] **Step 1: Crear el archivo de página**

```tsx
'use client';
import * as React from 'react';
import { User, Monitor, Bell, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { AccountTab } from '@/components/profile/AccountTab';
import { DevicesTab } from '@/components/profile/DevicesTab';
import { NotificationsTab } from '@/components/profile/NotificationsTab';
import { SecurityTab } from '@/components/profile/SecurityTab';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'cuenta',          label: 'Cuenta',          icon: User,    Component: AccountTab },
  { id: 'dispositivos',    label: 'Dispositivos',     icon: Monitor, Component: DevicesTab },
  { id: 'notificaciones',  label: 'Notificaciones',   icon: Bell,    Component: NotificationsTab },
  { id: 'seguridad',       label: 'Seguridad',        icon: Shield,  Component: SecurityTab },
] as const;

type TabId = typeof TABS[number]['id'];

export default function PerfilPage() {
  const [activeTab, setActiveTab] = React.useState<TabId>('cuenta');
  const ActiveComponent = TABS.find(t => t.id === activeTab)?.Component ?? AccountTab;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Mi Perfil</h1>
        <p className="mt-1 text-sm text-muted">Gestiona tu cuenta, dispositivos y preferencias de notificación.</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Sidebar tabs — desktop */}
        <nav className="hidden lg:flex lg:w-52 lg:shrink-0 lg:flex-col lg:gap-1 lg:rounded-2xl lg:border lg:border-white/10 lg:bg-[#0f1a14]/60 lg:p-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all',
                  active
                    ? 'bg-[#25d366]/12 text-[#25d366] border border-[#25d366]/20'
                    : 'text-muted hover:bg-white/[0.04] hover:text-foreground border border-transparent'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Tabs horizontales — mobile */}
        <div className="flex gap-1 overflow-x-auto pb-1 lg:hidden">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all whitespace-nowrap',
                  active
                    ? 'bg-[#25d366]/12 text-[#25d366] border border-[#25d366]/20'
                    : 'border border-white/10 bg-white/[0.03] text-muted hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Contenido del tab activo */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-[#0f1a14]/40 p-5 sm:p-6"
        >
          <ActiveComponent />
        </motion.div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "frontend-next/src/app/(dashboard)/perfil/page.tsx"
git commit -m "feat(frontend): add /perfil page with Account, Devices, Notifications, Security tabs"
```

---

## Task 11: Header — ProfileAvatar enlaza a /perfil

**Files:**
- Modify: `frontend-next/src/components/layout/Header.tsx`

La sección del avatar en el header (línea ~222) está dentro de un `<div>`. Se reemplaza por un `<Link>` de Next.js que navega a `/perfil`.

- [ ] **Step 1: Añadir el import de Link**

Añadir al bloque de imports de Header.tsx:

```tsx
import Link from 'next/link';
```

- [ ] **Step 2: Envolver la sección del avatar en un Link**

Localizar este bloque en Header.tsx (alrededor de la línea 222):

```tsx
<div className="hidden xl:flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] px-2.5 py-1.5">
  <ProfileAvatar editable size="sm" />
  <div className="min-w-0">
    <p className="truncate text-sm font-semibold text-foreground">{user?.username || 'Usuario'}</p>
    <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--text-secondary))]">{user?.rol || 'sesion activa'}</p>
  </div>
</div>
```

Reemplazarlo por:

```tsx
<Link
  href="/perfil"
  className="hidden xl:flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.045] px-2.5 py-1.5 transition-colors hover:border-[#25d366]/30 hover:bg-[#25d366]/5"
>
  <ProfileAvatar size="sm" />
  <div className="min-w-0">
    <p className="truncate text-sm font-semibold text-foreground">{user?.username || 'Usuario'}</p>
    <p className="truncate text-[11px] font-medium uppercase tracking-[0.18em] text-[rgb(var(--text-secondary))]">{user?.rol || 'sesion activa'}</p>
  </div>
</Link>
```

Nota: se elimina `editable` del `ProfileAvatar` aquí — la edición queda en la propia página `/perfil`.

- [ ] **Step 3: Commit**

```bash
git add frontend-next/src/components/layout/Header.tsx
git commit -m "feat(header): link profile avatar to /perfil page"
```

---

## Self-Review

### Spec coverage
- ✅ Página `/perfil` con tabs: Cuenta, Dispositivos, Notificaciones, Seguridad
- ✅ Detección de nuevo dispositivo en login (Task 4)
- ✅ Almacenamiento de `known_devices` y `notification_prefs` en metadata JSONB
- ✅ API REST para dispositivos + notificaciones
- ✅ Email automático en nuevo dispositivo (respeta preferencia `login_new_device`)
- ✅ Templates de aporte faltantes en configuracion (Task 0)
- ✅ Header enlaza al perfil
- ✅ Tests TDD para funciones de pg-usuarios (Task 1)

### Placeholder scan
- Sin TBD, TODO, ni "similar a Task N"
- Todos los pasos tienen código completo

### Type consistency
- `NotifPrefs` definida en `profileApi.ts` y usada en `NotificationsTab.tsx` — ✅
- `Device` definida en `profileApi.ts` y usada en `DevicesTab.tsx` — ✅
- `ProfileMe` definida en `profileApi.ts` y usada en `AccountTab.tsx` y `SecurityTab.tsx` — ✅
- `pgAddKnownDevice` firma: `(username: string, device: object)` — usada igual en auth.js — ✅
- `pgRevokeDevice` firma: `(username: string, hash: string)` — usada igual en profile.js — ✅
