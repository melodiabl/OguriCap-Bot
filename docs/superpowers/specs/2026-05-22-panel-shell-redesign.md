# Panel Shell Redesign — OguriCap Bot

**Fecha:** 2026-05-22  
**Scope:** Rediseño visual del shell global del panel Next.js  
**Enfoque:** Shell first — sidebar, header, layout base, tokens

---

## Resumen

Rediseño completo del shell del panel admin de OguriCap-Bot. El objetivo es pasar del estilo actual (icon-only sidebar, tokens oguri-* multicolor, diseño abierto) a un estilo **Dashboard Pro** inspirado en Linear/Notion: sidebar expandido con texto, paleta Zinc-950 como base y `#25d366` como único acento de color.

El cambio del shell impacta visualmente las 20 páginas del panel sin tocar su lógica interna.

---

## Decisiones de diseño

| Decisión | Valor |
|---|---|
| Estilo | Dashboard Pro (Linear / Notion) |
| Paleta base | Zinc-950 / Zinc-900 / Zinc-800 / Zinc-700 |
| Acento único | `#25d366` (verde WhatsApp) |
| Sidebar | Expandido con labels, colapsable a icon-only |
| Header | Breadcrumb + búsqueda ⌘K + notificaciones |
| Tipografía | system-ui (sin cambio de fuente), jerarquía más limpia |
| Animaciones | Mantener Framer Motion, reducir glows y gradientes decorativos |

---

## Tokens de diseño

### Reemplazo de tokens en `tailwind.config.ts` y `globals.css`

```css
/* BASE */
--bg-base:     #09090b;   /* zinc-950 — fondo raíz */
--bg-surface:  #0c0c0e;   /* zinc-900 — sidebar, cards, panels */
--bg-elevated: #18181b;   /* zinc-800 — hover states, inputs */
--border:      #27272a;   /* zinc-700 — bordes generales */

/* TEXTO */
--text-primary:   #fafafa;  /* zinc-50 */
--text-secondary: #a1a1aa;  /* zinc-400 */
--text-muted:     #71717a;  /* zinc-500 */
--text-ghost:     #3f3f46;  /* zinc-700 */

/* ACENTO — único color de marca */
--accent:        #25d366;
--accent-subtle: rgba(37, 211, 102, 0.15);
--accent-ghost:  rgba(37, 211, 102, 0.08);
--accent-border: rgba(37, 211, 102, 0.25);
```

Los tokens `oguri-purple`, `oguri-lavender`, `oguri-blue`, `oguri-cyan`, `oguri-gold` se deprecan como colores de UI. Se mantienen únicamente como semántica de estado (danger, warning, info) pero sin protagonismo visual.

Los `shadow-glow-*` multicolor se eliminan. El único glow activo es `0 0 14px rgba(37,211,102,0.25)` para el acento.

---

## Sidebar

### Estructura

```
┌─────────────────────────────┐
│  [O] OguriCap    v1.8.2     │  ← brand header
├─────────────────────────────┤
│  CONTROL CENTRAL            │  ← section label
│  ■ Dashboard          (act) │
│  □ Estado del Bot           │
│  □ SubBots              [7] │  ← badge de conteo
│  □ Broadcast                │
│  □ Configuración            │
│                             │
│  COMUNIDAD                  │
│  □ Usuarios Panel           │
│  □ Usuarios Comunidad       │
│  □ Grupos                   │
│  □ Gestión Global           │
│  □ Proveedores              │
│                             │
│  OPERACIÓN                  │
│  □ Aportes                  │
│  □ Pedidos              [3] │
│  □ Multimedia               │
│  □ Plugins                  │
│  □ Tareas                   │
│                             │
│  MONITOREO                  │
│  □ Alertas              [!] │
│  □ Recursos                 │
│  □ Logs                     │
│  □ Analytics                │
│  □ AI Chat                  │
├─────────────────────────────┤
│  [avatar] melodiabl  Admin  │  ← user footer
└─────────────────────────────┘
```

### Especificaciones

- **Ancho expandido:** 220px
- **Ancho colapsado:** 52px (solo iconos, tooltips al hover)
- **Toggle:** botón `⟨` en el borde derecho del sidebar, persistido en `localStorage`
- **Item activo:** `background: var(--bg-elevated)`, texto `--text-primary`, sin borde izquierdo de color (reemplaza el estilo actual con glow)
- **Item hover:** `background: var(--bg-elevated)` con transición 100ms
- **Section labels:** `text-xs uppercase tracking-widest text-ghost`, no clickeables
- **Badges:** pills pequeños `bg-accent-subtle text-accent`, solo cuando `count > 0`
- **Alertas activas:** badge rojo en "Alertas" cuando hay alertas sin leer
- **Brand header:** ícono cuadrado verde con letra "O", nombre + versión
- **User footer:** avatar circular + nombre + rol. Click → página `/perfil`
- **Mobile:** sidebar como drawer (comportamiento actual, sin cambio)

---

## Header / Topbar

### Estructura

```
┌──────────────────────────────────────────────────────┐
│  Control Central / Dashboard    [🔍 Buscar... ⌘K] [🔔] │
└──────────────────────────────────────────────────────┘
```

### Especificaciones

- **Altura:** 44px
- **Background:** `var(--bg-surface)` con `border-bottom: 1px solid var(--border)`
- **Breadcrumb izquierda:** `sección / página-actual` — sección en `--text-ghost`, página en `--text-primary`
- **Búsqueda:** input fantasma `w-56`, decorativo en esta fase (placeholder "Buscar..." + kbd `⌘K`). La command palette es una feature separada fuera de este spec.
- **Notificaciones:** ícono campana, dot verde cuando hay no leídas (reusa `NotificationDropdown` existente)
- **Sin avatar en header** — el usuario ya está en el footer del sidebar

---

## Layout de página

### Estructura base

```
┌──sidebar 220px──┬───────── main content ─────────────┐
│                 │  ┌─── header 44px ───────────────┐  │
│                 │  └───────────────────────────────┘  │
│                 │  ┌─── page content ───────────────┐  │
│                 │  │   padding: 24px 28px            │  │
│                 │  │                                 │  │
│                 │  └───────────────────────────────┘  │
└─────────────────┴────────────────────────────────────┘
```

- **Page padding:** `px-7 py-6` (28px / 24px)
- **Page title:** `text-xl font-bold tracking-tight text-primary`
- **Page subtitle:** `text-xs uppercase tracking-widest text-ghost mt-0.5`
- **Max content width:** sin límite (full width del área disponible)
- **Card backgrounds:** `var(--bg-surface)` con `border: 1px solid var(--border)`
- **Sin glassmorphism** en componentes de datos (solo permitido en modales y overlays)

---

## Componentes impactados

### Cambios directos (shell)
| Componente | Cambio |
|---|---|
| `components/layout/Sidebar.tsx` | Rediseño completo — expandido con labels |
| `components/layout/Header.tsx` | Rediseño — breadcrumb + search + notif |
| `components/layout/MainLayout.tsx` | Ajuste de widths y padding |
| `tailwind.config.ts` | Nuevos tokens Zinc, deprecar oguri-* multicolor |
| `app/globals.css` | Variables CSS nuevas |

### Cambios de componentes UI (segunda fase)
| Componente | Cambio |
|---|---|
| `components/ui/Card.tsx` | Fondo surface, borde zinc |
| `components/ui/Button.tsx` | Variantes con tokens nuevos |
| `components/ui/Badge.tsx` | Solo accent + semánticos |
| `components/ui/DashboardCard.tsx` | Zinc surface, menos glows |
| `components/ui/StatusBadge.tsx` | Unificar colores semánticos |

### Sin cambios en esta fase
- Lógica de páginas (hooks, API calls, state)
- `contexts/` — sin cambios
- `services/` — sin cambios
- Animaciones Framer Motion existentes (solo reducción de glows decorativos)

---

## Arquitectura de tokens en Tailwind

Los nuevos tokens se agregan como extensiones en `tailwind.config.ts`:

```ts
// Nuevo zinc palette como bg/surface principal
zinc: { 950: '#09090b', 900: '#18181b', ... }  // ya existe en TW v3

// Acento único
accent: {
  DEFAULT: 'rgb(var(--accent))',
  subtle:  'rgba(37,211,102,0.15)',
  ghost:   'rgba(37,211,102,0.08)',
  border:  'rgba(37,211,102,0.25)',
}

// Mantener oguri-* solo para semántica de estado
// oguri-danger (rojo), oguri-warning (gold) — sin cambio
// oguri-purple, oguri-cyan, oguri-lavender, oguri-blue — DEPRECATED
```

---

## Estrategia de implementación

**Orden de trabajo:**

1. **Tokens** — actualizar `tailwind.config.ts` y `globals.css` con nueva paleta Zinc + acento
2. **Sidebar** — rediseño completo de `Sidebar.tsx` (componente aislado, bajo riesgo)
3. **Header** — rediseño de `Header.tsx` y `MainLayout.tsx`
4. **DashboardCard + Card** — adaptar a nuevos tokens
5. **Resto de componentes UI** — Button, Badge, StatusBadge, etc.

Cada paso es reversible y testeable de forma aislada. El sidebar y header son los cambios de mayor impacto visual.

---

## Qué NO cambia

- La estructura de rutas y páginas
- La lógica de permisos (`usePermissions`, `NAV_ITEMS`)
- Los contextos de Socket, Auth, Bot, etc.
- Las animaciones de Framer Motion base
- Los efectos de `NavParticles` — se mantienen pero con opacidad reducida al 40% para no competir con la sobriedad Zinc
- El comportamiento mobile (drawer)

---

## Criterio de éxito

- El panel se ve como una herramienta pro (Linear/Notion) a primera vista
- El verde `#25d366` es el único color que "salta" visualmente
- Sidebar siempre muestra qué sección y qué página está activa, sin necesidad de hover
- El header orienta al usuario con breadcrumb en todo momento
- Las 20 páginas se benefician del cambio sin modificar su código interno
